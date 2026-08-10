from django.db import models, transaction
from django.db.models import Sum
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from users.models import User
from exams.models import Exam, Question, Answer


class ExamAttempt(models.Model):
    """Records each time a student attempts an exam"""
    STATUS_CHOICES = (
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('graded', 'Graded'),
    )
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exam_attempts')
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='attempts')
    batch = models.ForeignKey(
        'exams.ExamBatch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attempts',
        help_text="The batch this attempt belongs to"
    )
    
    # Attempt Details
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    
    # Scoring
    total_marks = models.FloatField(
        null=True,
        blank=True,
        help_text="Total marks obtained"
    )
    percentage = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Percentage score"
    )
    grade = models.CharField(
        max_length=2,
        blank=True,
        null=True,
        help_text="Letter grade (A, B, C, D, E, F)"
    )
    is_passed = models.BooleanField(
        default=False,
        help_text="Whether student passed the exam"
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='in_progress'
    )
    
    # Security Monitoring
    tab_switch_count = models.IntegerField(
        default=0,
        help_text="Number of tab switches during exam"
    )
    
    # Metadata
    time_taken_seconds = models.IntegerField(
        null=True,
        blank=True,
        help_text="Actual time spent on exam in seconds"
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = 'Exam Attempt'
        verbose_name_plural = 'Exam Attempts'
        ordering = ['-start_time']
        unique_together = ('student', 'exam', 'start_time')
    
    def __str__(self):
        return f"{self.student.get_full_name()} - {self.exam.title}"
    
    def calculate_score(self):
        """Calculate the total score for this attempt"""
        with transaction.atomic():
            total = self.exam.questions.aggregate(total=Sum('marks'))['total'] or 0
            total_marks = total
            obtained_marks = 0

            for answer in self.answers.select_related('question').all():
                if answer.question and answer.is_correct:
                    obtained_marks += answer.question.marks

            if total_marks > 0:
                self.total_marks = obtained_marks
                self.percentage = round((obtained_marks / total_marks) * 100, 2)
                self.is_passed = self.percentage >= self.exam.passing_score
                self.grade = self.get_grade(self.percentage)
                self.status = 'graded'
                self.save()

        return self.total_marks, self.percentage
    
    def get_grade(self, percentage):
        """Get letter grade based on percentage"""
        from django.conf import settings
        
        grading_scale = settings.BMU_CONFIG.get('GRADING_SCALE', {
            'A': 70, 'B': 60, 'C': 50, 'D': 45, 'E': 40, 'F': 0,
        })
        
        for grade, min_score in sorted(grading_scale.items(), key=lambda x: x[1], reverse=True):
            if percentage >= min_score:
                return grade
        return 'F'


class StudentAnswer(models.Model):
    """Records individual student answers"""
    attempt = models.ForeignKey(ExamAttempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_answer = models.ForeignKey(
        Answer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Selected answer option"
    )
    short_answer = models.TextField(
        blank=True,
        null=True,
        help_text="Text answer for short answer and fill-in-the-blank questions"
    )
    
    # True/False specific field
    boolean_answer = models.BooleanField(
        null=True,
        blank=True,
        help_text="True/False answer"
    )
    
    # Auto-grading
    is_correct = models.BooleanField(
        default=False,
        help_text="Whether answer is correct (auto-calculated)"
    )
    marks_obtained = models.FloatField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Marks obtained for this question"
    )
    
    # Metadata
    answered_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)
    time_spent_seconds = models.IntegerField(
        default=0,
        help_text="Time spent on this question in seconds"
    )
    
    class Meta:
        verbose_name = 'Student Answer'
        verbose_name_plural = 'Student Answers'
        ordering = ['question__order']
        unique_together = ('attempt', 'question')
    
    def __str__(self):
        return f"{self.attempt.student.username} - {self.question.exam.title} - Q{self.question.order}"
    
    def grade_answer(self):
        """Auto-grade the answer"""
        if self.question.question_type == 'multiple' and self.selected_answer:
            self.is_correct = self.selected_answer.is_correct
            if self.is_correct:
                self.marks_obtained = self.question.marks
            else:
                self.marks_obtained = 0
        elif self.question.question_type == 'true_false' and self.boolean_answer is not None:
            if self.question.correct_answer:
                correct_bool = self.question.correct_answer.strip().lower() in ('true', 't', '1', 'yes')
                self.is_correct = self.boolean_answer == correct_bool
            else:
                # Find the correct answer from the Answer objects
                correct_answer = self.question.answers.filter(is_correct=True).first()
                if correct_answer:
                    correct_bool = correct_answer.answer_text.strip().lower() in ('true', 't', '1', 'yes')
                    self.is_correct = self.boolean_answer == correct_bool
                else:
                    self.is_correct = False
            self.marks_obtained = self.question.marks if self.is_correct else 0
        elif self.question.question_type == 'fill_blank' and self.short_answer:
            if hasattr(self.question, 'correct_answer') and self.question.correct_answer:
                self.is_correct = self.short_answer.strip().lower() == self.question.correct_answer.strip().lower()
            else:
                self.is_correct = False
            
            if self.is_correct:
                self.marks_obtained = self.question.marks
            else:
                self.marks_obtained = 0
        elif self.question.question_type == 'short':
            self.is_correct = False
            self.marks_obtained = 0
        elif self.question.question_type in ('math', 'chemistry', 'physics', 'biology'):
            # Science questions with answer options use MCQ-style grading
            if self.selected_answer:
                self.is_correct = self.selected_answer.is_correct
                self.marks_obtained = self.question.marks if self.is_correct else 0
            elif self.short_answer and self.question.correct_answer:
                self.is_correct = self.short_answer.strip().lower() == self.question.correct_answer.strip().lower()
                self.marks_obtained = self.question.marks if self.is_correct else 0
            else:
                self.is_correct = False
                self.marks_obtained = 0
        elif self.question.question_type == 'comprehension':
            # Comprehension questions use MCQ-style grading (they have answer options)
            if self.selected_answer:
                self.is_correct = self.selected_answer.is_correct
                self.marks_obtained = self.question.marks if self.is_correct else 0
            else:
                self.is_correct = False
                self.marks_obtained = 0
        else:
            self.is_correct = False
            self.marks_obtained = 0
        
        self.save()
        return self.is_correct


class Notification(models.Model):
    """System notifications for admin users"""
    TYPE_CHOICES = (
        ('exam_attempt', 'New Exam Attempt'),
        ('security_alert', 'Security Alert'),
        ('grade_complete', 'Grading Complete'),
        ('system', 'System Notification'),
    )
    
    PRIORITY_CHOICES = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    )
    
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='system')
    title = models.CharField(max_length=200)
    message = models.TextField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Optional references
    exam = models.ForeignKey('exams.Exam', on_delete=models.CASCADE, null=True, blank=True)
    student = models.ForeignKey('users.User', on_delete=models.CASCADE, null=True, blank=True)
    attempt = models.ForeignKey('ExamAttempt', on_delete=models.CASCADE, null=True, blank=True)
    
    class Meta:
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"
