from django.contrib import admin
from .models import ExamAttempt, StudentAnswer


class StudentAnswerInline(admin.TabularInline):
    model = StudentAnswer
    extra = 0
    readonly_fields = ['question', 'answered_at', 'is_correct', 'marks_obtained']
    fields = ['question', 'selected_answer', 'is_correct', 'marks_obtained', 'time_spent_seconds']
    can_delete = False


@admin.register(ExamAttempt)
class ExamAttemptAdmin(admin.ModelAdmin):
    list_display = ['student_name', 'exam', 'status', 'percentage', 'grade', 'start_time']
    list_filter = ['status', 'exam', 'is_passed', 'start_time', 'grade']
    search_fields = ['student__username', 'student__first_name', 'student__last_name', 'exam__title']
    readonly_fields = ['student', 'exam', 'start_time', 'submitted_at', 'total_marks', 'percentage', 'grade']
    inlines = [StudentAnswerInline]
    
    fieldsets = (
        ('Attempt Details', {
            'fields': ('student', 'exam', 'status')
        }),
        ('Timing', {
            'fields': ('start_time', 'submitted_at', 'time_taken_seconds')
        }),
        ('Scoring', {
            'fields': ('total_marks', 'percentage', 'grade', 'is_passed'),
            'classes': ('wide',)
        }),
        ('Metadata', {
            'fields': ('ip_address', 'user_agent'),
            'classes': ('collapse',)
        }),
    )
    
    def student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username
    student_name.short_description = 'Student'
    
    def has_add_permission(self, request):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(StudentAnswer)
class StudentAnswerAdmin(admin.ModelAdmin):
    list_display = ['attempt', 'question_short', 'is_correct', 'marks_obtained', 'answered_at']
    list_filter = ['is_correct', 'attempt__exam', 'answered_at']
    search_fields = ['attempt__student__username', 'question__question_text']
    readonly_fields = ['attempt', 'question', 'answered_at', 'last_updated']
    
    fieldsets = (
        ('Answer Details', {
            'fields': ('attempt', 'question', 'selected_answer', 'short_answer')
        }),
        ('Grading', {
            'fields': ('is_correct', 'marks_obtained')
        }),
        ('Timing', {
            'fields': ('answered_at', 'last_updated', 'time_spent_seconds')
        }),
    )
    
    def question_short(self, obj):
        return f"Q{obj.question.order}: {obj.question.question_text[:50]}"
    question_short.short_description = 'Question'
    
    def has_add_permission(self, request):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
