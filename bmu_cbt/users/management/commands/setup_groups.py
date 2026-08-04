from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from exams.models import Exam, Question, ExamSession
from results.models import Result


class Command(BaseCommand):
    help = 'Set up initial user groups and permissions for BMU CBT'
    
    def handle(self, *args, **options):
        # Define groups and their permissions
        groups_config = {
            'matriculated_students': {
                'permissions': [
                    ('exams', 'exam', 'can_take_exam'),
                    ('results', 'result', 'can_view_own_results'),
                ],
                'description': 'Matriculated students with full access to exams'
            },
            '100level_students': {
                'permissions': [
                    ('exams', 'exam', 'can_take_exam'),
                    ('results', 'result', 'can_view_own_results'),
                ],
                'description': '100 Level students with access to exams'
            },
            'intending_students': {
                'permissions': [
                    ('exams', 'exam', 'can_take_exam'),
                    ('results', 'result', 'can_view_own_results'),
                ],
                'description': 'Intending students with limited exam access'
            },
            'exam_officers': {
                'permissions': [
                    ('exams', 'exam', 'add_exam'),
                    ('exams', 'exam', 'change_exam'),
                    ('exams', 'exam', 'view_exam'),
                    ('exams', 'question', 'add_question'),
                    ('exams', 'question', 'change_question'),
                    ('exams', 'question', 'view_question'),
                    ('results', 'result', 'view_result'),
                    ('results', 'result', 'export_results'),
                ],
                'description': 'Exam officers who can manage exams and view results'
            },
            'invigilators': {
                'permissions': [
                    ('exams', 'examsession', 'view_examsession'),
                    ('exams', 'examsession', 'change_examsession'),
                ],
                'description': 'Invigilators who can monitor active exams'
            },
        }
        
        created_count = 0
        updated_count = 0
        
        for group_name, config in groups_config.items():
            group, created = Group.objects.get_or_create(name=group_name)
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created group: {group_name}'))
                created_count += 1
            else:
                self.stdout.write(self.style.WARNING(f'Group already exists: {group_name}'))
                updated_count += 1
            
            # Clear existing permissions
            group.permissions.clear()
            
            # Add new permissions
            for app_label, model_name, permission_codename in config.get('permissions', []):
                try:
                    content_type = ContentType.objects.get(
                        app_label=app_label,
                        model=model_name
                    )
                    permission = Permission.objects.get(
                        content_type=content_type,
                        codename=permission_codename
                    )
                    group.permissions.add(permission)
                    self.stdout.write(f'  Added permission: {permission_codename}')
                except ContentType.DoesNotExist:
                    self.stdout.write(self.style.ERROR(f'  ContentType not found: {app_label}.{model_name}'))
                except Permission.DoesNotExist:
                    self.stdout.write(self.style.ERROR(f'  Permission not found: {permission_codename}'))
            
            # Set description if provided
            if 'description' in config:
                # Django Group model doesn't have a description field by default
                # You could add one via a custom model if needed
                pass
        
        self.stdout.write(self.style.SUCCESS(
            f'\nSetup complete: Created {created_count} groups, Updated {updated_count} groups'
        ))
        
        # Create default permissions for models if they don't exist
        self.stdout.write('\nChecking model permissions...')
        self.create_model_permissions()
    
    def create_model_permissions(self):
        """Ensure default permissions exist for our models"""
        from django.contrib.auth.management import create_permissions
        
        # Import apps to ensure models are registered
        from django.apps import apps
        
        for app_config in apps.get_app_configs():
            if app_config.name in ['users', 'exams', 'results']:
                create_permissions(app_config, verbosity=0)
                self.stdout.write(f'Created permissions for {app_config.name}')