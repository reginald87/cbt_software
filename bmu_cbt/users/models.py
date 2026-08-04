import re
import secrets
import string
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.utils.crypto import get_random_string
from django.utils import timezone


def validate_matric_number(value):
    """Validate UG/00/0000 format"""
    if not value:
        return
    
    pattern = r'^UG/\d{2}/\d{4}$'
    if not re.match(pattern, value):
        raise ValidationError(
            'Matric number must be in format: UG/00/0000 (e.g., UG/21/1234)'
        )


def validate_jamb_number(value):
    """Validate JAMB number format (12-13 digits + 2 letters)"""
    if not value:
        return
    
    # Pattern: 12-13 digits followed by 2 uppercase letters
    pattern = r'^\d{12,13}[A-Z]{2}$'
    if not re.match(pattern, value):
        raise ValidationError(
            'JAMB number must be 14-15 characters: 12-13 digits followed by 2 uppercase letters (e.g., 202330951815BA)'
        )


class User(AbstractUser):
    """Custom User model for BMU CBT System"""
    
    USER_TYPES = (
        ('admin', 'Administrator'),
        ('staff', 'Staff'),
        ('matriculated', 'Matriculated Student'),
        ('100level', '100 Level Student'),
        ('intending', 'Intending Student'),
    )
    
    user_type = models.CharField(max_length=20, choices=USER_TYPES, default='matriculated')
    jamb_number = models.CharField(
        max_length=15,
        unique=True,
        blank=True,
        null=True,
        validators=[validate_jamb_number],
        help_text="Format: 202330951815BA (12-13 digits + 2 uppercase letters)"
    )
    matric_number = models.CharField(
        max_length=10,
        unique=True,
        blank=True,
        null=True,
        validators=[validate_matric_number],
        help_text="Format: UG/00/0000 (e.g., UG/21/1234)"
    )
    department = models.CharField(max_length=200, blank=True, null=True)
    course = models.CharField(max_length=200, blank=True)
    is_first_login = models.BooleanField(default=True)
    temporary_password = models.BooleanField(default=True)
    temporary_plain_password = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Temporary storage of plain password for credential export"
    )
    year_of_entry = models.IntegerField(blank=True, null=True)
    profile_picture = models.ImageField(
        upload_to='profile_pictures/',
        blank=True,
        null=True,
        help_text="User profile picture"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['matric_number', 'jamb_number']
        verbose_name = 'BMU User'
        verbose_name_plural = 'BMU Users'
    
    def __str__(self):
        return f"{self.get_full_name()} - {self.identifier}"
    
    def clean(self):
        """Additional validation logic"""
        super().clean()
        
        # Auto-set user_type for admin/staff users
        if self.is_superuser:
            self.user_type = 'admin'
        elif self.is_staff:
            self.user_type = 'staff'
        
        # Skip further validation for staff/superuser accounts
        if self.is_staff or self.is_superuser:
            return
        
        if self.user_type == 'matriculated' and not self.matric_number:
            raise ValidationError('Matriculated students must have a matric number')
        
        if self.user_type in ['100level', 'intending'] and not self.jamb_number:
            raise ValidationError('100-level and intending students must have a JAMB number')
        
        # Ensure at least one identifier exists
        if not self.matric_number and not self.jamb_number:
            raise ValidationError('User must have either matric number or JAMB number')
    
    @property
    def identifier(self):
        """Get primary identifier based on user type"""
        if self.user_type == 'matriculated' and self.matric_number:
            return self.matric_number
        return self.jamb_number or 'No Identifier'
    
    def generate_username(self):
        """Generate BMU-XXXX username"""
        from django.conf import settings
        
        prefix = settings.BMU_CONFIG.get('USERNAME_PREFIX', 'BMU-')
        length = settings.BMU_CONFIG.get('USERNAME_LENGTH', 4)
        
        # Generate unique username
        while True:
            numbers = get_random_string(length=length, allowed_chars='0123456789')
            username = f"{prefix}{numbers}"
            
            if not User.objects.filter(username=username).exists():
                return username
    
    def generate_password(self):
        """Generate secure password"""
        password_length = 8
        alphabet = string.ascii_letters + string.digits + "!@#$%"
        password = ''.join(secrets.choice(alphabet) for _ in range(password_length))
        return password
    
    def save(self, *args, **kwargs):
        """Override save to ensure username generation"""
        if not self.username:
            self.username = self.generate_username()
        
        self.full_clean()  # Run validation
        super().save(*args, **kwargs)


class UserSession(models.Model):
    """Track user login sessions with IP addresses for security"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    ip_address = models.GenericIPAddressField()
    session_key = models.CharField(max_length=40, unique=True)
    user_agent = models.TextField(blank=True, null=True)
    
    # Timestamps
    login_time = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    logout_time = models.DateTimeField(blank=True, null=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_exam_session = models.BooleanField(
        default=False,
        help_text="Whether user was in an exam during this session"
    )
    
    class Meta:
        verbose_name = 'User Session'
        verbose_name_plural = 'User Sessions'
        ordering = ['-login_time']
        indexes = [
            models.Index(fields=['ip_address', '-login_time']),
            models.Index(fields=['user', '-login_time']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.ip_address} ({self.login_time})"
    
    def is_expired(self, timeout_minutes=1440):
        """Check if session has expired (default 24 hours)"""
        from datetime import timedelta
        expiry_time = self.last_activity + timedelta(minutes=timeout_minutes)
        return timezone.now() > expiry_time
    
    def mark_exam_session(self):
        """Mark this session as being used for an exam"""
        self.is_exam_session = True
        self.save()
    
    @classmethod
    def get_active_session_for_ip(cls, ip_address):
        """Get the currently active session for an IP address"""
        return cls.objects.filter(
            ip_address=ip_address,
            is_active=True,
            logout_time__isnull=True
        ).order_by('-last_activity').first()
    
    @classmethod
    def get_user_from_ip_during_exam(cls, ip_address):
        """Get the user logged in from this IP if they have an active exam"""
        from results.models import ExamAttempt
        
        session = cls.get_active_session_for_ip(ip_address)
        if not session:
            return None
        
        # Check if user has active exam attempt
        has_active_exam = ExamAttempt.objects.filter(
            student=session.user,
            status='in_progress'
        ).exists()
        
        return session.user if has_active_exam else None