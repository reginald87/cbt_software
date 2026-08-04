from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, UserSession

class CustomUserAdmin(UserAdmin):
    """Custom admin interface for User model"""
    
    list_display = ('username', 'email', 'get_full_name', 'user_type', 'identifier', 'department', 'is_active')
    list_filter = ('user_type', 'department', 'is_active', 'is_staff')
    search_fields = ('username', 'email', 'first_name', 'last_name', 'matric_number', 'jamb_number')
    ordering = ('-date_joined',)
    
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'email', 'profile_picture')}),
        ('BMU Information', {
            'fields': (
                'user_type',
                'matric_number',
                'jamb_number',
                'department',
                'course',
                'year_of_entry',
            )
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Important Dates', {'fields': ('last_login', 'date_joined')}),
        ('Status', {'fields': ('is_first_login', 'temporary_password')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'first_name', 'last_name', 'email',
                'user_type', 'matric_number', 'jamb_number',
                'department', 'course', 'year_of_entry',
                'password1', 'password2',
            ),
        }),
    )
    
    def get_form(self, request, obj=None, **kwargs):
        """Customize the form for adding/editing users"""
        form = super().get_form(request, obj, **kwargs)
        
        if obj is None:  # Adding a new user
            # Remove username from the form - it will be auto-generated
            if 'username' in form.base_fields:
                del form.base_fields['username']
        else:  # Editing existing user
            # Make username read-only for existing users
            form.base_fields['username'].disabled = True
        
        return form
    
    def save_model(self, request, obj, form, change):
        """Auto-generate username on creation"""
        if not change:  # Creating new user
            obj.username = obj.generate_username()
        super().save_model(request, obj, form, change)
    def get_full_name(self, obj):
        return obj.get_full_name()
    get_full_name.short_description = 'Full Name'
    
    def identifier(self, obj):
        return obj.identifier
    identifier.short_description = 'Identifier'


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = ['user_display', 'ip_address', 'is_active', 'is_exam_session', 'login_time', 'logout_time']
    list_filter = ['is_active', 'is_exam_session', 'login_time']
    search_fields = ['user__username', 'user__email', 'ip_address']
    readonly_fields = ['session_key', 'login_time', 'last_activity', 'user_agent']
    
    fieldsets = (
        ('Session Info', {
            'fields': ('user', 'session_key', 'ip_address', 'user_agent')
        }),
        ('Timing', {
            'fields': ('login_time', 'last_activity', 'logout_time')
        }),
        ('Status', {
            'fields': ('is_active', 'is_exam_session')
        }),
    )
    
    def user_display(self, obj):
        return f"{obj.user.get_full_name()} ({obj.user.username})"
    user_display.short_description = 'User'
    
    def has_add_permission(self, request):
        return False


admin.site.register(User, CustomUserAdmin)