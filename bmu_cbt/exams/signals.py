"""
Signal handlers for the exams app
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver


# We'll add exam-specific signals later in Phase 2