from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    """Append-only log of important actions for security and accountability."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
    )
    username = models.CharField(
        max_length=150,
        blank=True,
        default='anonymous',
        help_text="Snapshot of the username (kept if the user is later deleted)",
    )
    action = models.CharField(
        max_length=100,
        help_text="Machine-readable action code, e.g. 'exam.create'",
    )
    action_label = models.CharField(
        max_length=200,
        blank=True,
        help_text="Human-readable summary of the action",
    )
    model_name = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=50, blank=True)
    details = models.TextField(
        blank=True,
        help_text="JSON string with extra context (IDs, field changes, etc.)",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['action']),
            models.Index(fields=['username']),
        ]

    def __str__(self):
        return f"{self.action} by {self.username} @ {self.created_at}"
