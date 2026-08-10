from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
import random
from users.models import User


class ExamCategory(models.Model):
    """Categories/Subjects for exams"""
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, null=True)
    code = models.CharField(max_length=10, unique=True, help_text="e.g., BIO101, CHM201")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Exam Category'
        verbose_name_plural = 'Exam Categories'
        ordering = ['name']
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class Exam(models.Model):
    """Exam model - represents an exam/test"""
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('closed', 'Closed'),
    )
    
    DIFFICULTY_CHOICES = (
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    )
    
    title = models.CharField(max_length=300)
    category = models.ForeignKey(ExamCategory, on_delete=models.PROTECT, related_name='exams')
    description = models.TextField(blank=True, null=True)
    instructions = models.TextField(blank=True, null=True, help_text="Exam instructions for students")
    
    # Exam Configuration
    duration_minutes = models.IntegerField(
        default=60,
        validators=[MinValueValidator(5), MaxValueValidator(480)],
        help_text="Duration in minutes (5-480)"
    )
    total_questions = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text="Total number of questions in the exam"
    )
    questions_per_paper = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1)],
        help_text="Number of questions randomly drawn from the question bank for each student's paper. Leave blank to use all questions."
    )
    passing_score = models.IntegerField(
        default=50,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Minimum percentage to pass"
    )
    difficulty_level = models.CharField(
        max_length=10,
        choices=DIFFICULTY_CHOICES,
        default='medium'
    )
    
    # Exam Settings
    show_answers = models.BooleanField(
        default=False,
        help_text="Show correct answers after exam submission"
    )
    show_score = models.BooleanField(
        default=True,
        help_text="Show score after exam submission"
    )
    shuffle_questions = models.BooleanField(
        default=True,
        help_text="Randomize question order for each student"
    )
    shuffle_options = models.BooleanField(
        default=True,
        help_text="Randomize answer options for each question"
    )
    allow_review = models.BooleanField(
        default=True,
        help_text="Allow students to review answered questions"
    )
    
    # Availability
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )
    start_date = models.DateTimeField(help_text="When exam becomes available")
    end_date = models.DateTimeField(help_text="When exam closes")
    
    # Admin fields
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='exams_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-start_date']
        verbose_name = 'Exam'
        verbose_name_plural = 'Exams'
    
    def __str__(self):
        return f"{self.title} ({self.category.code})"
    
    def is_active(self):
        """Check if exam is currently active"""
        now = timezone.now()
        return (self.status == 'published' and 
                self.start_date <= now <= self.end_date)
    
    def is_available(self):
        """Check if exam is available to take"""
        now = timezone.now()
        return (self.status == 'published' and 
                self.start_date <= now <= self.end_date)

    def draw_paper(self, paper_size=None, rng=None):
        """Randomly draw a paper from the exam's question bank.

        Each student's paper is drawn independently when they start the exam.
        Without `questions_per_paper` the whole bank is the paper. Pass a
        seeded `random.Random` as `rng` for a deterministic draw.
        """
        pool = list(self.questions.all())
        if not pool:
            return []
        if paper_size is None:
            paper_size = self.questions_per_paper or len(pool)
        paper_size = max(1, min(int(paper_size), len(pool)))
        rng = rng or random
        rng.shuffle(pool)
        return pool[:paper_size]


class Question(models.Model):
    """Questions for exams"""
    QUESTION_TYPE_CHOICES = (
        ('multiple', 'Multiple Choice'),
        ('true_false', 'True/False'),
        ('fill_blank', 'Fill in the Blank'),
        ('short', 'Short Answer'),
        ('math', 'Mathematical'),
        ('chemistry', 'Chemistry Equation'),
        ('physics', 'Physics Diagram'),
        ('biology', 'Biology Diagram'),
        ('comprehension', 'Comprehension'),
    )
    
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(
        max_length=20,
        choices=QUESTION_TYPE_CHOICES,
        default='multiple'
    )
    marks = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Points for this question"
    )
    order = models.IntegerField(
        default=0,
        help_text="Order of question in exam"
    )
    
    # Comprehension passage support
    comprehension_passage = models.TextField(
        blank=True,
        null=True,
        help_text="Shared passage for comprehension questions (will be shown for all questions in the same group)"
    )
    comprehension_group = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Group identifier for questions sharing the same passage"
    )
    
    # Fill in the blank specific fields
    correct_answer = models.TextField(
        blank=True,
        null=True,
        help_text="Correct answer for fill-in-the-blank questions"
    )
    
    # Math and Science specific fields
    latex_content = models.TextField(
        blank=True,
        null=True,
        help_text="LaTeX content for math and science questions"
    )
    
    diagram_image = models.ImageField(
        upload_to='question_diagrams/',
        blank=True,
        null=True,
        help_text="Diagram for physics and other science questions"
    )
    
    # Shared image reference (for questions that reference the same image)
    shared_image = models.ForeignKey(
        'QuestionImage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='referenced_questions',
        help_text="Reference to a shared image that can be used by multiple questions"
    )
    
    equation_type = models.CharField(
        max_length=20,
        choices=[
            ('algebraic', 'Algebraic'),
            ('chemical', 'Chemical'),
            ('physics', 'Physics'),
            ('statistical', 'Statistical')
        ],
        blank=True,
        null=True,
        help_text="Type of equation for math/science questions"
    )
    
    # Question Options (for detailed explanations)
    explanation = models.TextField(
        blank=True,
        null=True,
        help_text="Explanation shown after exam (if enabled)"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['exam', 'order']
        verbose_name = 'Question'
        verbose_name_plural = 'Questions'
        unique_together = ('exam', 'order')
    
    def __str__(self):
        return f"{self.exam.title} - Q{self.order}: {self.question_text[:50]}"
    
    def get_shared_passage(self):
        """Get the shared passage for this question's comprehension group"""
        if self.comprehension_group:
            # Find the first question in this group that has a passage
            passage_question = Question.objects.filter(
                exam=self.exam,
                comprehension_group=self.comprehension_group,
                comprehension_passage__isnull=False
            ).first()
            return passage_question.comprehension_passage if passage_question else None
        return None


class QuestionImage(models.Model):
    """Shared images that can be referenced by multiple questions"""
    title = models.CharField(
        max_length=200,
        help_text="Title or description of the image"
    )
    image = models.ImageField(
        upload_to='shared_question_images/',
        help_text="Image file that can be referenced by multiple questions"
    )
    caption = models.TextField(
        blank=True,
        null=True,
        help_text="Caption or description for the image"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_images'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['title']
        verbose_name = 'Question Image'
        verbose_name_plural = 'Question Images'
    
    def __str__(self):
        return f"{self.title}"


class Answer(models.Model):
    """Answer options for multiple choice questions"""
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answers')
    answer_text = models.TextField()
    is_correct = models.BooleanField(
        default=False,
        help_text="Mark this as the correct answer"
    )
    order = models.IntegerField(
        default=0,
        help_text="Display order of answer option"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['question', 'order']
        verbose_name = 'Answer Option'
        verbose_name_plural = 'Answer Options'
        unique_together = ('question', 'order')
    
    def __str__(self):
        return f"Q{self.question.order} - {self.answer_text[:50]}"
