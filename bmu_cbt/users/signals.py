"""
Signal handlers for the users app
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import Group
from .models import User


@receiver(post_save, sender=User)
def assign_user_group(sender, instance, created, **kwargs):
    """
    Assign users to appropriate groups based on their user_type
    when they are created.
    """
    if created:
        group_name = None
        
        # Map user_type to group names
        if instance.user_type == 'matriculated':
            group_name = 'matriculated_students'
        elif instance.user_type == '100level':
            group_name = '100level_students'
        elif instance.user_type == 'intending':
            group_name = 'intending_students'
        
        # Assign to group if group exists
        if group_name:
            try:
                group = Group.objects.get(name=group_name)
                instance.groups.add(group)
            except Group.DoesNotExist:
                # Group doesn't exist yet, we'll create it in a management command
                pass


@receiver(post_save, sender=User)
def send_welcome_email(sender, instance, created, **kwargs):
    """
    Send welcome email with credentials when a user is created
    (Admin will print credentials instead for security)
    """
    if created and instance.email:
        # In production, you would send an email here
        # For now, we'll just log it or handle via admin export
        pass


@receiver(post_save, sender=User)
def ensure_username_format(sender, instance, **kwargs):
    """
    Ensure username follows BMU-XXXX format
    """
    if instance.username and not instance.username.startswith('BMU-'):
        # Generate a proper username if it doesn't follow format
        # This shouldn't happen with our generation logic, but just in case
        new_username = instance.generate_username()
        if instance.username != new_username:
            instance.username = new_username
            instance.save()


@receiver(post_save, sender=User)
def log_user_creation(sender, instance, created, **kwargs):
    """
    Log user creation for auditing purposes
    """
    if created:
        print(f"User created: {instance.username} ({instance.get_full_name()})")
        print(f"  Type: {instance.get_user_type_display()}")
        print(f"  Identifier: {instance.identifier}")
        print(f"  Department: {instance.department}")