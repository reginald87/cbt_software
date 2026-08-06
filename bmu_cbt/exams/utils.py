"""
Bulk import utilities for exams
"""
import csv
import io
from datetime import datetime
from django.db import transaction
from django.db.models import Count
from django.utils.dateparse import parse_datetime
from django.conf import settings
from exams.models import Exam, ExamCategory, Question, Answer
from users.models import User


def _bulk_create_batches(model, objects, batch_size=None):
    """Create objects in batches to avoid huge single INSERT statements."""
    if batch_size is None:
        batch_size = getattr(settings, 'BULK_CREATE_BATCH_SIZE', 500)
    for start in range(0, len(objects), batch_size):
        model.objects.bulk_create(objects[start:start + batch_size])


def validate_exam_row(row, row_number):
    """Validate a single row from exam CSV"""
    errors = []
    
    # Required fields
    required_fields = ['title', 'category_code', 'description', 'duration_minutes', 'passing_score', 'start_date', 'end_date']
    for field in required_fields:
        if not row.get(field, '').strip():
            errors.append(f"Row {row_number}: {field} is required")
    
    # Validate numeric fields
    try:
        duration = int(row.get('duration_minutes', 0))
        if duration <= 0:
            errors.append(f"Row {row_number}: Duration must be positive")
    except ValueError:
        errors.append(f"Row {row_number}: Invalid duration format")
    
    try:
        passing_score = int(row.get('passing_score', 0))
        if passing_score < 0 or passing_score > 100:
            errors.append(f"Row {row_number}: Passing score must be 0-100")
    except ValueError:
        errors.append(f"Row {row_number}: Invalid passing score format")
    
    # Validate dates
    try:
        start_date = parse_datetime(row.get('start_date', ''))
        end_date = parse_datetime(row.get('end_date', ''))
        if start_date and end_date and start_date >= end_date:
            errors.append(f"Row {row_number}: End date must be after start date")
    except ValueError:
        errors.append(f"Row {row_number}: Invalid date format. Use YYYY-MM-DD HH:MM:SS")
    
    return errors


def import_exams_from_csv(csv_file, user):
    """
    Import exams from CSV file
    Expected CSV format:
    title,category_code,description,duration_minutes,passing_score,start_date,end_date,status,show_answers,show_score,shuffle_questions,shuffle_options,allow_review
    """
    try:
        # Decode file if it's bytes
        if isinstance(csv_file, bytes):
            csv_file = csv_file.decode('utf-8')
        
        # Create file-like object from string
        csv_io = io.StringIO(csv_file)
        
        # Read CSV
        reader = csv.DictReader(csv_io)
        rows = list(reader)
        
        if not rows:
            return {'success': False, 'message': 'CSV file is empty', 'imported': 0}
        
        imported_count = 0
        errors = []
        categories = {}  # code -> ExamCategory (cached to avoid repeated lookups)
        exams_to_create = []
        
        for row_number, row in enumerate(rows, 1):
            # Skip empty rows
            if not any(row.values()):
                continue
            
            # Validate row
            row_errors = validate_exam_row(row, row_number)
            if row_errors:
                errors.extend(row_errors)
                continue
            
            try:
                # Get or create category (cached per unique code)
                category_code = row['category_code'].strip()
                category = categories.get(category_code)
                if category is None:
                    category, _ = ExamCategory.objects.get_or_create(
                        code=category_code,
                        defaults={
                            'name': row.get('category_name', category_code.title()),
                            'description': row.get('category_description', '')
                        }
                    )
                    categories[category_code] = category
                
                # Parse dates
                start_date = parse_datetime(row.get('start_date', ''))
                end_date = parse_datetime(row.get('end_date', ''))
                
                # Create exam (saved in bulk at the end)
                exam = Exam(
                    title=row['title'].strip(),
                    category=category,
                    description=row.get('description', '').strip(),
                    instructions=row.get('instructions', '').strip(),
                    duration_minutes=int(row['duration_minutes']),
                    passing_score=int(row['passing_score']),
                    start_date=start_date,
                    end_date=end_date,
                    status='draft',
                    show_answers=row.get('show_answers', 'true').lower() == 'true',
                    show_score=row.get('show_score', 'true').lower() == 'true',
                    shuffle_questions=row.get('shuffle_questions', 'false').lower() == 'true',
                    shuffle_options=row.get('shuffle_options', 'false').lower() == 'true',
                    allow_review=row.get('allow_review', 'true').lower() == 'true',
                    created_by=user,
                    total_questions=0  # Will be updated when questions are added
                )
                
                exams_to_create.append(exam)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {row_number}: {str(e)}")
        
        with transaction.atomic():
            _bulk_create_batches(Exam, exams_to_create)
        
        return {
            'success': len(errors) == 0,
            'message': f"Successfully imported {imported_count} exams" if len(errors) == 0 else f"Imported {imported_count} exams with {len(errors)} errors",
            'imported': imported_count,
            'errors': errors
        }
        
    except Exception as e:
        return {
            'success': False,
            'message': f"Error processing CSV file: {str(e)}",
            'imported': 0,
            'errors': [str(e)]
        }


def validate_questions_row(row, row_number):
    """Validate a single row from questions CSV"""
    errors = []
    
    # Required fields
    required_fields = ['exam_title', 'question_text', 'question_type', 'marks']
    for field in required_fields:
        if not row.get(field, '').strip():
            errors.append(f"Row {row_number}: {field} is required")
    
    # Validate question type
    question_type = row.get('question_type', '').strip().lower()
    if question_type not in ['multiple', 'true_false', 'short_answer']:
        errors.append(f"Row {row_number}: Question type must be 'multiple', 'true_false', or 'short_answer'")
    
    # Validate marks
    try:
        marks = int(row.get('marks', 0))
        if marks <= 0:
            errors.append(f"Row {row_number}: Marks must be positive")
    except ValueError:
        errors.append(f"Row {row_number}: Invalid marks format")
    
    correct_answer = row.get('correct_answer', '').strip()

    # For multiple choice, validate answer options + correct answer
    if question_type == 'multiple':
        answer_options_str = row.get('answer_options', '')
        answer_options = (
            [opt.strip() for opt in answer_options_str.split('|') if opt.strip()]
            if answer_options_str
            else []
        )

        if len(answer_options) < 2:
            errors.append(f"Row {row_number}: Multiple choice questions need at least 2 answer options")

        if not correct_answer:
            errors.append(f"Row {row_number}: correct_answer is required for multiple choice questions")
        elif correct_answer not in answer_options:
            errors.append(f"Row {row_number}: Correct answer must be one of the answer options")

    # For true/false, validate correct answer
    if question_type == 'true_false':
        if not correct_answer:
            errors.append(f"Row {row_number}: correct_answer is required for true/false questions")
        elif correct_answer.lower() not in ['true', 'false']:
            errors.append(f"Row {row_number}: correct_answer must be 'true' or 'false' for true/false questions")

    # For short answers, correct_answer may be empty (manual marking or rubric-based)
    
    return errors


def import_questions_from_csv(csv_file, user):
    """
    Import questions from CSV file
    Expected CSV format:
    exam_id (optional),exam_title,question_text,question_type,marks,answer_options,correct_answer,explanation
    """
    try:
        # Decode file if it's bytes
        if isinstance(csv_file, bytes):
            csv_file = csv_file.decode('utf-8')
        
        # Create file-like object from string
        csv_io = io.StringIO(csv_file)
        
        # Read CSV
        reader = csv.DictReader(csv_io)
        rows = list(reader)
        
        if not rows:
            return {'success': False, 'message': 'CSV file is empty', 'imported': 0}
        
        imported_count = 0
        errors = []
        
        # Caches to avoid repeated DB lookups/counts for rows referencing the
        # same exam.
        exam_cache = {}          # key ('id', value) / ('title', value) -> Exam
        next_orders = {}         # exam_id -> next order number
        questions_to_create = [] # in-memory Question objects (bulk-created)
        answers_to_create = []   # in-memory Answer objects (bulk-created)
        
        for row_number, row in enumerate(rows, 1):
            # Skip empty rows
            if not any(row.values()):
                continue
            
            # Validate row
            row_errors = validate_questions_row(row, row_number)
            if row_errors:
                errors.extend(row_errors)
                continue
            
            try:
                # Get exam (cached)
                exam = None
                exam_id_value = (row.get('exam_id') or '').strip()
                if exam_id_value:
                    cache_key = ('id', exam_id_value)
                    exam = exam_cache.get(cache_key)
                    if exam is None:
                        exam = Exam.objects.filter(id=exam_id_value).first()
                        if exam is not None:
                            exam_cache[cache_key] = exam

                if exam is None:
                    exam_title = row['exam_title'].strip()
                    cache_key = ('title', exam_title)
                    exam = exam_cache.get(cache_key)
                    if exam is None:
                        exam = Exam.objects.filter(title=exam_title).order_by('-id').first()
                        if exam is not None:
                            exam_cache[cache_key] = exam

                if exam is None:
                    raise Exam.DoesNotExist("Exam not found")
                
                question_type = row['question_type'].strip().lower()
                
                # Assign order using an in-memory counter (one initial COUNT per
                # exam instead of a COUNT query for every row).
                if exam.id not in next_orders:
                    next_orders[exam.id] = Question.objects.filter(exam=exam).count() + 1
                order = next_orders[exam.id]
                next_orders[exam.id] += 1
                
                # Create question (bulk-created at the end)
                question = Question(
                    exam=exam,
                    question_text=row['question_text'].strip(),
                    question_type=question_type,
                    marks=int(row['marks']),
                    explanation=row.get('explanation', '').strip(),
                    order=order
                )
                questions_to_create.append(question)
                
                # Create answers for multiple choice questions
                if question_type == 'multiple':
                    answer_options_str = row.get('answer_options', '')
                    answer_options = [opt.strip() for opt in answer_options_str.split('|') if opt.strip()] if answer_options_str else []
                    correct_answer = row.get('correct_answer', '').strip()
                    
                    for i, option_text in enumerate(answer_options):
                        answers_to_create.append(Answer(
                            question=question,
                            answer_text=option_text,
                            is_correct=(option_text == correct_answer),
                            order=i + 1
                        ))

                if question_type == 'true_false':
                    correct_answer = row.get('correct_answer', '').strip().lower()
                    answers_to_create.append(Answer(
                        question=question,
                        answer_text='True',
                        is_correct=(correct_answer == 'true'),
                        order=1,
                    ))
                    answers_to_create.append(Answer(
                        question=question,
                        answer_text='False',
                        is_correct=(correct_answer == 'false'),
                        order=2,
                    ))
                
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {row_number}: {str(e)}")
        
        with transaction.atomic():
            # Bulk create questions first so they receive IDs, then answers.
            _bulk_create_batches(Question, questions_to_create)
            _bulk_create_batches(Answer, answers_to_create)
            
            # Update exam question counts once per exam
            for exam_id, next_order in next_orders.items():
                Exam.objects.filter(id=exam_id).update(total_questions=next_order - 1)
        
        return {
            'success': len(errors) == 0,
            'message': f"Successfully imported {imported_count} questions" if len(errors) == 0 else f"Imported {imported_count} questions with {len(errors)} errors",
            'imported': imported_count,
            'errors': errors
        }
        
    except Exception as e:
        return {
            'success': False,
            'message': f"Error processing CSV file: {str(e)}",
            'imported': 0,
            'errors': [str(e)]
        }


def generate_exam_template():
    """Generate CSV template for exam import"""
    template = [
        ['title', 'category_code', 'category_name', 'description', 'instructions', 
         'duration_minutes', 'passing_score', 'start_date', 'end_date', 'status',
         'show_answers', 'show_score', 'shuffle_questions', 'shuffle_options', 'allow_review'],
        ['Sample Exam', 'MATH', 'Mathematics', 'Basic mathematics exam', 'Read all questions carefully',
         '60', '70', '2026-02-05 09:00:00', '2026-02-05 11:00:00', 'active',
         'true', 'true', 'false', 'false', 'true']
    ]
    
    return template


def generate_questions_template():
    """Generate CSV template for questions import"""
    template = [
        ['exam_title', 'question_text', 'question_type', 'marks', 'answer_options', 'correct_answer', 'explanation'],
        ['Sample Exam', 'What is 2+2?', 'multiple', '5', '3|4|5|6', '5', 'Basic addition problem'],
        ['Sample Exam', 'The sky is blue', 'true_false', '2', '', 'true', 'Basic observation'],
        ['Sample Exam', 'Explain gravity', 'short_answer', '10', '', '', 'Physics concept explanation']
    ]
    
    return template
