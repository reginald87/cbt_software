from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'action', 'username', 'action_label', 'ip_address')
    list_filter = ('action', 'created_at')
    search_fields = ('username', 'action', 'action_label', 'details')
    readonly_fields = [f.name for f in AuditLog._meta.fields]
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
