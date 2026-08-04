from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
import getpass

User = get_user_model()


class Command(BaseCommand):
    help = 'Create a superuser with BMU User fields'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Creating BMU Superuser'))
        
        # Get username
        while True:
            username = input('\nUsername: ').strip()
            if not username:
                self.stdout.write(self.style.ERROR('Username cannot be blank.'))
                continue
            if User.objects.filter(username=username).exists():
                self.stdout.write(self.style.ERROR('Username already exists.'))
                continue
            break
        
        # Get email
        while True:
            email = input('Email address: ').strip()
            if not email:
                self.stdout.write(self.style.ERROR('Email cannot be blank.'))
                continue
            if User.objects.filter(email=email).exists():
                self.stdout.write(self.style.ERROR('Email already exists.'))
                continue
            break
        
        # Get password
        password = None
        while True:
            password = getpass.getpass('Password: ')
            if not password:
                self.stdout.write(self.style.ERROR('Password cannot be blank.'))
                continue
            password_confirm = getpass.getpass('Password (again): ')
            if password != password_confirm:
                self.stdout.write(self.style.ERROR("Passwords don't match. Try again."))
                continue
            break
        
        # Get department (required)
        while True:
            department = input('\nDepartment: ').strip()
            if not department:
                self.stdout.write(self.style.ERROR('Department cannot be blank.'))
                continue
            break
        
        # Get user type
        self.stdout.write('\nSelect user type:')
        self.stdout.write('1) Matriculated Student')
        self.stdout.write('2) 100 Level Student')
        self.stdout.write('3) Intending Student')
        
        choices = {'1': 'matriculated', '2': '100level', '3': 'intending'}
        while True:
            choice = input('Enter choice (1-3): ').strip()
            if choice in choices:
                user_type = choices[choice]
                break
            self.stdout.write(self.style.ERROR('Invalid choice.'))
        
        # Get identifier based on user type
        matric_number = None
        jamb_number = None
        
        if user_type == 'matriculated':
            matric_number = input('Matric number (format: UG/YY/XXXX, or press Enter to skip): ').strip()
        else:
            jamb_number = input('JAMB number (11 digits + 2 letters, or press Enter to skip): ').strip()
        
        # Create the superuser
        try:
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password
            )
            # Update additional fields
            user.user_type = user_type
            user.department = department
            if matric_number:
                user.matric_number = matric_number
            if jamb_number:
                user.jamb_number = jamb_number
            
            # Save and validate
            user.full_clean()
            user.save()
            
            self.stdout.write(self.style.SUCCESS(f'\nSuperuser "{username}" created successfully!'))
        except ValidationError as e:
            self.stdout.write(self.style.ERROR(f'Validation Error: {e.message}'))
            for field, errors in e.error_dict.items():
                self.stdout.write(self.style.ERROR(f'  {field}: {errors}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))
            import traceback
            traceback.print_exc()
