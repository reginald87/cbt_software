from ninja import Router, Query, File
from ninja.errors import HttpError
from ninja.files import UploadedFile
from django.shortcuts import get_object_or_404
from pydantic import BaseModel
from typing import List, Optional
from exams.models import Exam, ExamCategory, Question, Answer
from exams.utils import import_exams_from_csv, import_questions_from_csv, generate_exam_template, generate_questions_template
from utils.decorators import admin_required_ninja
from bmu_cbt.ninja_auth import JWTAuth
from audit.logger import record_audit
from datetime import datetime
from django.utils import timezone
import random
import hashlib

router = Router(auth=JWTAuth())


def _shuffle_seed(*parts):
    """Deterministic shuffle seed so the same student always gets the same order,
    but different students get different orders."""
    raw = '-'.join(str(p) for p in parts)
    return int(hashlib.sha256(raw.encode()).hexdigest()[:8], 16)


def _to_model_exam_status(api_status: Optional[str]) -> Optional[str]:
    if api_status is None:
        return None
    s = api_status.strip().lower()
    if s == 'active':
        return 'published'
    return s


def _to_api_exam_status(model_status: Optional[str]) -> str:
    s = (model_status or '').strip().lower()
    if s == 'published':
        return 'active'
    return s


# ==================== Schemas ====================

class AnswerSchema(BaseModel):
    id: int
    answer_text: str
    order: int


class QuestionSchema(BaseModel):
    id: int
    question_text: str
    question_type: str
    marks: int
    order: int
    explanation: Optional[str] = None
    correct_answer: Optional[str] = None
    latex_content: Optional[str] = None
    diagram_image: Optional[str] = None
    equation_type: Optional[str] = None
    comprehension_passage: Optional[str] = None
    comprehension_group: Optional[str] = None
    shared_image: Optional[dict] = None
    answers: List[AnswerSchema] = []

class ExamCategorySchema(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None


class ExamCategoryCreateSchema(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class ExamListSchema(BaseModel):
    id: int
    title: str
    category: ExamCategorySchema
    description: Optional[str] = None
    duration_minutes: int
    total_questions: int
    status: str
    start_date: str
    end_date: str
    server_time: str


class ExamDetailSchema(BaseModel):
    id: int
    title: str
    category: ExamCategorySchema
    description: Optional[str] = None
    instructions: Optional[str] = None
    duration_minutes: int
    total_questions: int
    passing_score: int
    status: str
    start_date: str
    end_date: str
    server_time: str
    show_answers: bool
    show_score: bool
    shuffle_questions: bool
    shuffle_options: bool
    allow_review: bool
    questions: List[QuestionSchema] = []


# Admin-only variant that also exposes which answer is correct.
# Used by the Exam Builder so the correct answer survives edits.
class AnswerAdminSchema(AnswerSchema):
    is_correct: Optional[bool] = None


class QuestionAdminSchema(QuestionSchema):
    answers: List[AnswerAdminSchema] = []


class ExamAdminDetailSchema(ExamDetailSchema):
    questions: List[QuestionAdminSchema] = []


class ExamCreateSchema(BaseModel):
    title: str
    category_id: int
    description: Optional[str] = None
    instructions: Optional[str] = None
    duration_minutes: int
    passing_score: int
    start_date: str
    end_date: str
    show_answers: bool = True
    show_score: bool = True
    shuffle_questions: bool = False
    shuffle_options: bool = False
    allow_review: bool = True
    total_questions: Optional[int] = None
    difficulty_level: Optional[str] = None
    status: Optional[str] = None


class ExamStatusUpdateSchema(BaseModel):
    status: str


# ==================== Endpoints ====================

@router.get("/categories/", response=List[dict])
def list_categories(request):
    """Get all exam categories"""
    categories = ExamCategory.objects.all()
    return [
        {"id": cat.id, "name": cat.name, "code": cat.code, "description": cat.description}
        for cat in categories
    ]


@router.post("/categories/", response=ExamCategorySchema)
@admin_required_ninja
def create_category(request, category_data: ExamCategoryCreateSchema):
    """Create a new exam category (admin only)"""
    name = category_data.name.strip()
    code = category_data.code.strip().upper()

    if not name:
        raise HttpError(400, "Category name is required")
    if not code:
        raise HttpError(400, "Category code is required")

    if ExamCategory.objects.filter(name__iexact=name).exists():
        raise HttpError(400, f"A category named '{name}' already exists")
    if ExamCategory.objects.filter(code__iexact=code).exists():
        raise HttpError(400, f"Category code '{code}' is already in use")

    category = ExamCategory.objects.create(
        name=name,
        code=code,
        description=(category_data.description or '').strip(),
    )
    record_audit(
        request,
        'category.create',
        label=f"Category '{category.name}' ({category.code}) created",
        model_name='ExamCategory',
        object_id=category.id,
        details={'name': category.name, 'code': category.code},
    )
    return {
        "id": category.id,
        "name": category.name,
        "code": category.code,
        "description": category.description,
    }


@router.get("/categories/{category_id}/", response=ExamCategorySchema)
def get_category(request, category_id: int):
    """Get a specific exam category"""
    return get_object_or_404(ExamCategory, id=category_id)

@router.get("/", response=List[ExamListSchema])
def list_exams(request, status: Optional[str] = Query(None)):
    """Get all available exams, optionally filtered by status"""
    exams = Exam.objects.select_related('category').all()

    user = getattr(request, 'user', None)
    if not user or not getattr(user, 'is_superuser', False):
        exams = exams.filter(status__in=['published', 'active'])
    
    if status:
        exams = exams.filter(status=_to_model_exam_status(status))

    return [
        {
            'id': exam.id,
            'title': exam.title,
            'category': {
                'id': exam.category.id,
                'code': exam.category.code,
                'name': exam.category.name,
                'description': exam.category.description,
            },
            'description': exam.description,
            'duration_minutes': exam.duration_minutes,
            'total_questions': exam.total_questions,
            'status': _to_api_exam_status(exam.status),
            'start_date': exam.start_date.isoformat() if exam.start_date else '',
            'end_date': exam.end_date.isoformat() if exam.end_date else '',
            'server_time': timezone.now().isoformat(),
        }
        for exam in exams
    ]


@router.get("/current/", response=Optional[ExamListSchema])
def get_current_exam(request):
    now = timezone.now()

    exam = (
        Exam.objects.select_related('category')
        .filter(status__in=['published', 'active'], start_date__lte=now, end_date__gte=now)
        .order_by('start_date')
        .first()
    )

    if not exam:
        return None

    return {
        'id': exam.id,
        'title': exam.title,
        'category': {
            'id': exam.category.id,
            'code': exam.category.code,
            'name': exam.category.name,
            'description': exam.category.description,
        },
        'description': exam.description,
        'duration_minutes': exam.duration_minutes,
        'total_questions': exam.total_questions,
        'status': _to_api_exam_status(exam.status),
        'start_date': exam.start_date.isoformat() if exam.start_date else '',
        'end_date': exam.end_date.isoformat() if exam.end_date else '',
        'server_time': timezone.now().isoformat(),
    }


@router.get("/{exam_id}/", response=ExamAdminDetailSchema)
def get_exam_detail(request, exam_id: int):
    """Get detailed exam information including all questions and answers.

    Admin callers also receive `is_correct` on each answer so the Exam
    Builder can reopen and re-save without losing the correct answer.
    """
    exam = get_object_or_404(Exam, id=exam_id)
    is_admin = getattr(request.user, 'is_superuser', False)
    
    # Prepare questions with answers
    exam_dict = {
        'id': exam.id,
        'title': exam.title,
        'category': {
            'id': exam.category.id,
            'code': exam.category.code,
            'name': exam.category.name,
            'description': exam.category.description,
        },
        'description': exam.description,
        'instructions': exam.instructions,
        'duration_minutes': exam.duration_minutes,
        'total_questions': exam.total_questions,
        'passing_score': exam.passing_score,
        'status': _to_api_exam_status(exam.status),
        'start_date': exam.start_date.isoformat(),
        'end_date': exam.end_date.isoformat(),
        'server_time': timezone.now().isoformat(),
        'show_answers': exam.show_answers,
        'show_score': exam.show_score,
        'shuffle_questions': exam.shuffle_questions,
        'shuffle_options': exam.shuffle_options,
        'allow_review': exam.allow_review,
        'questions': [
            {
                'id': q.id,
                'question_text': q.question_text,
                'question_type': q.question_type,
                'marks': q.marks,
                'order': q.order,
                'explanation': q.explanation if is_admin else None,
                'answers': [
                    {
                        'id': a.id,
                        'answer_text': a.answer_text,
                        'order': a.order,
                        'is_correct': a.is_correct if is_admin else None,
                    }
                    for a in q.answers.all().order_by('order')
                ]
            }
            for q in exam.questions.all().order_by('order')
        ]
    }
    
    return exam_dict


@router.get("/{exam_id}/admin-detail/")
@admin_required_ninja
def get_exam_admin_detail(request, exam_id: int):
    """Admin-only exam detail including correct answers for review."""
    exam = get_object_or_404(Exam, id=exam_id)

    return {
        'id': exam.id,
        'title': exam.title,
        'category': {
            'id': exam.category.id,
            'code': exam.category.code,
            'name': exam.category.name,
            'description': exam.category.description,
        },
        'description': exam.description,
        'instructions': exam.instructions,
        'duration_minutes': exam.duration_minutes,
        'total_questions': exam.total_questions,
        'passing_score': exam.passing_score,
        'status': _to_api_exam_status(exam.status),
        'start_date': exam.start_date.isoformat(),
        'end_date': exam.end_date.isoformat(),
        'server_time': timezone.now().isoformat(),
        'show_answers': exam.show_answers,
        'show_score': exam.show_score,
        'shuffle_questions': exam.shuffle_questions,
        'shuffle_options': exam.shuffle_options,
        'allow_review': exam.allow_review,
        'questions': [
            {
                'id': q.id,
                'question_text': q.question_text,
                'question_type': q.question_type,
                'marks': q.marks,
                'order': q.order,
                'explanation': q.explanation,
                'answers': [
                    {
                        'id': a.id,
                        'answer_text': a.answer_text,
                        'order': a.order,
                        'is_correct': a.is_correct,
                    }
                    for a in q.answers.all().order_by('order')
                ],
            }
            for q in exam.questions.all().order_by('order')
        ],
    }

@router.get("/{exam_id}/questions/", response=List[QuestionSchema])
def get_exam_questions(request, exam_id: int):
    """Get all questions for an exam"""
    exam = get_object_or_404(Exam, id=exam_id)
    questions = list(exam.questions.all().order_by('order').prefetch_related('answers', 'shared_image'))
    is_admin = getattr(request.user, 'is_superuser', False)

    # Share comprehension passages across questions in the same group
    passage_cache = {}
    for q in questions:
        if q.comprehension_group:
            if q.comprehension_group not in passage_cache:
                passage_cache[q.comprehension_group] = q.get_shared_passage()
            q._shared_passage = passage_cache[q.comprehension_group]
        else:
            q._shared_passage = None

    # Shuffle questions and answer options per-student when enabled (admins always see canonical order)
    if not is_admin:
        user_id = getattr(request.user, 'id', 0)

        if exam.shuffle_questions:
            rng = random.Random(_shuffle_seed(exam_id, user_id))
            rng.shuffle(questions)

        if exam.shuffle_options:
            for q in questions:
                q._shuffled_answers = list(q.answers.all())
                rng = random.Random(_shuffle_seed(exam_id, user_id, q.id))
                rng.shuffle(q._shuffled_answers)
        else:
            for q in questions:
                q._shuffled_answers = None

    return [
        {
            'id': q.id,
            'question_text': q.question_text,
            'question_type': q.question_type,
            'marks': q.marks,
            'order': q.order,
            'explanation': q.explanation if is_admin else None,
            'correct_answer': q.correct_answer if is_admin else None,
            'latex_content': q.latex_content,
            'diagram_image': q.diagram_image.url if q.diagram_image else None,
            'equation_type': q.equation_type,
            'comprehension_passage': getattr(q, '_shared_passage', None) or q.comprehension_passage,
            'comprehension_group': q.comprehension_group,
            'shared_image': {
                'id': q.shared_image.id,
                'title': q.shared_image.title,
                'image': q.shared_image.image.url if q.shared_image.image else None,
                'caption': q.shared_image.caption
            } if q.shared_image else None,
            'answers': [{'id': a.id, 'answer_text': a.answer_text, 'order': a.order} for a in (getattr(q, '_shuffled_answers', None) or list(q.answers.all().order_by('order')))],
        }
        for q in questions
    ]


@router.post("/")
def create_exam(request, exam_data: ExamCreateSchema):
    """Create a new exam (admin only)"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    try:
        # Parse datetime strings
        start_date = datetime.fromisoformat(exam_data.start_date.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(exam_data.end_date.replace('Z', '+00:00'))
        
        # Get category
        category = get_object_or_404(ExamCategory, id=exam_data.category_id)
        
        # Create exam
        exam = Exam.objects.create(
            title=exam_data.title,
            category=category,
            description=exam_data.description,
            instructions=exam_data.instructions,
            duration_minutes=exam_data.duration_minutes,
            passing_score=exam_data.passing_score,
            start_date=start_date,
            end_date=end_date,
            show_answers=exam_data.show_answers,
            show_score=exam_data.show_score,
            shuffle_questions=exam_data.shuffle_questions,
            shuffle_options=exam_data.shuffle_options,
            allow_review=exam_data.allow_review,
            status='draft',  # New exams start as draft
            total_questions=0  # Will be updated when questions are added
        )

        record_audit(
            request,
            'exam.create',
            label=f"Exam '{exam.title}' created",
            model_name='Exam',
            object_id=exam.id,
            details={'category': category.name, 'duration_minutes': exam.duration_minutes},
        )
        
        # Return as dictionary
        return {
            'id': exam.id,
            'title': exam.title,
            'category': {
                'id': exam.category.id,
                'code': exam.category.code,
                'name': exam.category.name,
                'description': exam.category.description,
            },
            'description': exam.description,
            'duration_minutes': exam.duration_minutes,
            'total_questions': exam.total_questions,
            'status': exam.status,
            'start_date': exam.start_date.isoformat(),
            'end_date': exam.end_date.isoformat(),
        }
        
    except Exception as e:
        raise HttpError(400, f"Error creating exam: {str(e)}")


# Question schemas for creation/update
class QuestionCreateSchema(BaseModel):
    question_text: str
    question_type: str
    marks: int
    order: int
    correct_answer: Optional[str] = None
    latex_content: Optional[str] = None
    diagram_image: Optional[str] = None
    equation_type: Optional[str] = None
    explanation: Optional[str] = None
    comprehension_passage: Optional[str] = None
    comprehension_group: Optional[str] = None
    shared_image_id: Optional[int] = None
    answers: List[dict] = []


@router.post("/{exam_id}/questions/")
@admin_required_ninja
def create_question(request, exam_id: int, question_data: QuestionCreateSchema):
    """Create a new question for an exam"""
    exam = get_object_or_404(Exam, id=exam_id)
    
    try:
        # Create question
        question = Question.objects.create(
            exam=exam,
            question_text=question_data.question_text,
            question_type=question_data.question_type,
            marks=question_data.marks,
            order=question_data.order,
            correct_answer=question_data.correct_answer,
            latex_content=question_data.latex_content,
            diagram_image=question_data.diagram_image,
            equation_type=question_data.equation_type,
            explanation=question_data.explanation,
            comprehension_passage=question_data.comprehension_passage,
            comprehension_group=question_data.comprehension_group,
            shared_image_id=question_data.shared_image_id
        )
        
        # Create answer options if provided
        if question_data.answers:
            for answer_data in question_data.answers:
                Answer.objects.create(
                    question=question,
                    answer_text=answer_data.get('answer_text', ''),
                    is_correct=answer_data.get('is_correct', False),
                    order=answer_data.get('order', 0)
                )
        
        # Update exam question count
        exam.total_questions = exam.questions.count()
        exam.save()

        record_audit(
            request,
            'question.create',
            label=f"Question added to exam '{exam.title}'",
            model_name='Question',
            object_id=question.id,
            details={'exam_id': exam.id, 'question_type': question.question_type},
        )
        
        return {
            'id': question.id,
            'message': 'Question created successfully'
        }
    except Exception as e:
        raise HttpError(400, f"Error creating question: {str(e)}")


@router.post("/{exam_id}/questions/bulk/")
@admin_required_ninja
def bulk_create_questions(request, exam_id: int, questions_data: List[QuestionCreateSchema]):
    """Replace all questions for an exam (frontend always sends the full list)"""
    exam = get_object_or_404(Exam, id=exam_id)
    
    try:
        # Remove existing questions so repeated saves don't duplicate them
        exam.questions.all().delete()

        created_questions = []
        
        for question_data in questions_data:
            # Create question
            question = Question.objects.create(
                exam=exam,
                question_text=question_data.question_text,
                question_type=question_data.question_type,
                marks=question_data.marks,
                order=question_data.order,
                correct_answer=question_data.correct_answer,
                latex_content=question_data.latex_content,
                diagram_image=question_data.diagram_image,
                equation_type=question_data.equation_type,
                explanation=question_data.explanation,
                comprehension_passage=question_data.comprehension_passage,
                comprehension_group=question_data.comprehension_group,
                shared_image_id=question_data.shared_image_id
            )
            
            # Create answer options if provided
            if question_data.answers:
                for answer_data in question_data.answers:
                    Answer.objects.create(
                        question=question,
                        answer_text=answer_data.get('answer_text', ''),
                        is_correct=answer_data.get('is_correct', False),
                        order=answer_data.get('order', 0)
                    )
            
            created_questions.append(question)
        
        # Update exam question count
        exam.total_questions = len(created_questions)
        exam.save()

        record_audit(
            request,
            'question.bulk_update',
            label=f"Bulk updated {len(created_questions)} questions for exam '{exam.title}'",
            model_name='Exam',
            object_id=exam.id,
            details={'question_count': len(created_questions)},
        )
        
        return {
            'message': f'{len(created_questions)} questions created successfully',
            'question_ids': [q.id for q in created_questions]
        }
    except Exception as e:
        raise HttpError(400, f"Error creating questions: {str(e)}")


@router.put("/{exam_id}/questions/{question_id}/")
@admin_required_ninja
def update_question(request, exam_id: int, question_id: int, question_data: QuestionCreateSchema):
    """Update an existing question"""
    exam = get_object_or_404(Exam, id=exam_id)
    question = get_object_or_404(Question, id=question_id, exam=exam)
    
    try:
        # Update question fields
        question.question_text = question_data.question_text
        question.question_type = question_data.question_type
        question.marks = question_data.marks
        question.order = question_data.order
        question.correct_answer = question_data.correct_answer
        question.latex_content = question_data.latex_content
        question.diagram_image = question_data.diagram_image
        question.equation_type = question_data.equation_type
        question.explanation = question_data.explanation
        question.comprehension_passage = question_data.comprehension_passage
        question.comprehension_group = question_data.comprehension_group
        question.shared_image_id = question_data.shared_image_id
        question.save()
        
        # Update answer options
        if question_data.answers is not None:
            # Delete existing answers
            question.answers.all().delete()
            
            # Create new answers
            for answer_data in question_data.answers:
                Answer.objects.create(
                    question=question,
                    answer_text=answer_data.get('answer_text', ''),
                    is_correct=answer_data.get('is_correct', False),
                    order=answer_data.get('order', 0)
                )

        record_audit(
            request,
            'question.update',
            label=f"Question #{question.id} updated in exam '{exam.title}'",
            model_name='Question',
            object_id=question.id,
            details={'exam_id': exam.id},
        )
        
        return {
            'id': question.id,
            'message': 'Question updated successfully'
        }
    except Exception as e:
        raise HttpError(400, f"Error updating question: {str(e)}")


@router.delete("/{exam_id}/questions/{question_id}/")
@admin_required_ninja
def delete_question(request, exam_id: int, question_id: int):
    """Delete a question"""
    exam = get_object_or_404(Exam, id=exam_id)
    question = get_object_or_404(Question, id=question_id, exam=exam)
    
    try:
        question.delete()
        
        # Update exam question count and re-order remaining questions
        remaining_questions = exam.questions.all().order_by('order')
        for idx, q in enumerate(remaining_questions):
            q.order = idx
            q.save()
        
        exam.total_questions = remaining_questions.count()
        exam.save()

        record_audit(
            request,
            'question.delete',
            label=f"Question #{question_id} deleted from exam '{exam.title}'",
            model_name='Question',
            object_id=question_id,
            details={'exam_id': exam.id},
        )
        
        return {'message': 'Question deleted successfully'}
    except Exception as e:
        raise HttpError(400, f"Error deleting question: {str(e)}")


@router.put("/{exam_id}/")
@admin_required_ninja
def update_exam(request, exam_id: int, exam_data: ExamCreateSchema):
    """Update an existing exam (admin only)"""
    try:
        exam = get_object_or_404(Exam, id=exam_id)
        
        # Update exam fields
        exam.title = exam_data.title
        exam.description = exam_data.description
        exam.instructions = exam_data.instructions
        exam.duration_minutes = exam_data.duration_minutes
        exam.passing_score = exam_data.passing_score
        exam.total_questions = exam_data.total_questions if exam_data.total_questions is not None else exam.total_questions
        exam.shuffle_questions = exam_data.shuffle_questions
        exam.shuffle_options = exam_data.shuffle_options
        exam.show_answers = exam_data.show_answers
        exam.show_score = exam_data.show_score
        exam.allow_review = exam_data.allow_review
        if exam_data.category_id:
            exam.category_id = exam_data.category_id
        if exam_data.start_date:
            exam.start_date = exam_data.start_date
        if exam_data.end_date:
            exam.end_date = exam_data.end_date
        
        # Update status if provided
        if exam_data.status:
            exam.status = _to_model_exam_status(exam_data.status)
        
        exam.save()

        record_audit(
            request,
            'exam.update',
            label=f"Exam '{exam.title}' updated",
            model_name='Exam',
            object_id=exam.id,
        )
        
        return {
            "id": exam.id,
            "status": _to_api_exam_status(exam.status),
            "message": "Exam updated successfully"
        }
    except Exception as e:
        raise HttpError(400, f"Error updating exam: {str(e)}")


@router.patch("/{exam_id}/status/")
@admin_required_ninja
def update_exam_status(request, exam_id: int, payload: ExamStatusUpdateSchema):
    exam = get_object_or_404(Exam, id=exam_id)

    new_status = _to_model_exam_status(payload.status)
    if new_status == 'draft':
        from results.models import ExamAttempt as EA
        in_progress = EA.objects.filter(exam=exam, status='in_progress').count()
        if in_progress > 0:
            raise HttpError(400, f"Cannot close exam: {in_progress} student(s) are still taking it.")
    if new_status not in ['draft', 'published']:
        raise HttpError(400, "Invalid status. Allowed: draft, active")

    if new_status == 'published':
        question_count = Question.objects.filter(exam=exam).count()
        if question_count <= 0:
            raise HttpError(400, "Cannot publish an exam with no questions")

    exam.status = new_status
    exam.save(update_fields=['status'])

    record_audit(
        request,
        'exam.status_change',
        label=f"Exam '{exam.title}' status changed to {_to_api_exam_status(exam.status)}",
        model_name='Exam',
        object_id=exam.id,
        details={'status': _to_api_exam_status(exam.status)},
    )

    return {
        "id": exam.id,
        "status": _to_api_exam_status(exam.status),
    }


@router.post("/upload-diagram/")
@admin_required_ninja
def upload_diagram(request, image: UploadedFile = File(...)):
    """Upload diagram/image for questions"""
    try:
        from django.core.files.storage import default_storage
        from django.conf import settings
        import os
        import uuid
        
        # Generate unique filename
        file_extension = os.path.splitext(image.name)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # Save file
        file_path = default_storage.save(f'question_diagrams/{unique_filename}', image)
        
        # Return the file URL
        file_url = default_storage.url(file_path)
        
        return {
            "success": True,
            "filename": file_url,
            "message": "Diagram uploaded successfully"
        }
    except Exception as e:
        raise HttpError(400, f"Error uploading diagram: {str(e)}")


# ==================== Bulk Import Endpoints ====================

@router.post("/bulk/import/exams/")
@admin_required_ninja
def import_exams(request, csv_file: UploadedFile = File(...)):
    """Import exams from CSV file (admin only)"""
    try:
        # Read file content
        csv_content = csv_file.read().decode('utf-8')
        
        # Import exams
        result = import_exams_from_csv(csv_content, request.user)
        
        if result['success']:
            record_audit(
                request,
                'exam.bulk_import',
                label=f"Bulk imported {result['imported']} exams from CSV",
                details={'imported': result['imported'], 'errors': len(result.get('errors', []))},
            )
            return {
                "message": result['message'],
                "imported": result['imported'],
                "errors": result.get('errors', [])
            }
        else:
            raise HttpError(400, result['message'])
            
    except Exception as e:
        raise HttpError(400, f"Error processing file: {str(e)}")


@router.post("/bulk/import/questions/")
@admin_required_ninja
def import_questions(request, csv_file: UploadedFile = File(...)):
    """Import questions from CSV file (admin only)"""
    try:
        # Read file content
        csv_content = csv_file.read().decode('utf-8')
        
        # Import questions
        result = import_questions_from_csv(csv_content, request.user)
        
        if result['success']:
            record_audit(
                request,
                'question.bulk_import',
                label=f"Bulk imported {result['imported']} questions from CSV",
                details={'imported': result['imported'], 'errors': len(result.get('errors', []))},
            )
            return {
                "message": result['message'],
                "imported": result['imported'],
                "errors": result.get('errors', [])
            }
        else:
            raise HttpError(400, result['message'])
            
    except Exception as e:
        raise HttpError(400, f"Error processing file: {str(e)}")


@router.get("/bulk/templates/exams/")
@admin_required_ninja
def export_exam_template(request):
    """Download CSV template for exam import"""
    import csv
    from django.http import HttpResponse
    
    template = generate_exam_template()
    
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="exam_import_template.csv"'
    
    writer = csv.writer(response)
    writer.writerows(template)
    
    return response


@router.get("/bulk/templates/questions/")
@admin_required_ninja
def export_questions_template(request):
    """Download CSV template for questions import"""
    import csv
    from django.http import HttpResponse
    
    template = generate_questions_template()
    
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="questions_import_template.csv"'
    
    writer = csv.writer(response)
    writer.writerows(template)
    
    return response
