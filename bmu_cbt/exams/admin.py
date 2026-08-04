from django.contrib import admin
from .models import ExamCategory, Exam, Question, Answer


@admin.register(ExamCategory)
class ExamCategoryAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'created_at']
    search_fields = ['name', 'code']
    list_filter = ['created_at']


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 4
    fields = ['order', 'answer_text', 'is_correct']
    ordering = ['order']


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1
    fields = ['order', 'question_text', 'question_type', 'marks']
    ordering = ['order']


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'status', 'start_date', 'end_date', 'duration_minutes']
    list_filter = ['status', 'category', 'difficulty_level', 'start_date']
    search_fields = ['title', 'category__name']
    readonly_fields = ['created_by', 'created_at', 'updated_at']
    inlines = [QuestionInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'category', 'description', 'instructions')
        }),
        ('Configuration', {
            'fields': ('duration_minutes', 'total_questions', 'passing_score', 'difficulty_level')
        }),
        ('Settings', {
            'fields': ('show_answers', 'show_score', 'shuffle_questions', 'shuffle_options', 'allow_review')
        }),
        ('Availability', {
            'fields': ('status', 'start_date', 'end_date')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not obj.created_by:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['exam', 'order', 'question_text_short', 'question_type', 'marks']
    list_filter = ['exam', 'question_type', 'created_at']
    search_fields = ['exam__title', 'question_text', 'latex_content']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [AnswerInline]
    
    fieldsets = (
        ('Question Details', {
            'fields': ('exam', 'order', 'question_text', 'question_type', 'marks')
        }),
        ('Math & Science Fields', {
            'fields': ('latex_content', 'diagram_image', 'equation_type'),
            'classes': ('collapse',)
        }),
        ('Additional', {
            'fields': ('explanation',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def question_text_short(self, obj):
        return obj.question_text[:50] + '...' if len(obj.question_text) > 50 else obj.question_text
    question_text_short.short_description = 'Question'


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ['question', 'order', 'answer_text_short', 'is_correct']
    list_filter = ['is_correct', 'question__exam']
    search_fields = ['question__question_text', 'answer_text']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Answer Details', {
            'fields': ('question', 'order', 'answer_text', 'is_correct')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def answer_text_short(self, obj):
        return obj.answer_text[:50] + '...' if len(obj.answer_text) > 50 else obj.answer_text
    answer_text_short.short_description = 'Answer Text'
