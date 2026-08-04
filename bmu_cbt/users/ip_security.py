"""
IP-based session security utilities for exam integrity
"""
from django.conf import settings
from users.models import UserSession
from results.models import ExamAttempt


def get_client_ip(request):
    """Extract client IP from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def is_ip_session_lock_enabled():
    """Check if IP session locking is enabled in settings"""
    return settings.BMU_CONFIG.get('ALLOW_IP_SESSION_LOCK', True)


def get_user_with_active_exam_on_ip(ip_address):
    """
    Check if another user is currently in an exam on this IP
    Returns the user if found, None otherwise
    """
    if not is_ip_session_lock_enabled():
        return None
    
    return UserSession.get_user_from_ip_during_exam(ip_address)


def can_user_login_from_ip(user, ip_address):
    """
    Check if a user can login from this IP
    Returns (allowed: bool, message: str)
    """
    if not is_ip_session_lock_enabled():
        return True, ""
    
    # Check if another user has an active exam on this IP
    other_user = get_user_with_active_exam_on_ip(ip_address)
    
    if other_user and other_user.id != user.id:
        return False, f"Another user ({other_user.get_full_name()}) is currently taking an exam from this IP. Please wait until they finish or use a different device."
    
    return True, ""


def can_user_start_exam_from_ip(user, ip_address):
    """
    Check if a user can start an exam from this IP
    Returns (allowed: bool, message: str)
    """
    if not is_ip_session_lock_enabled():
        return True, ""
    
    # Check if another user is already in an exam on this IP
    other_user = get_user_with_active_exam_on_ip(ip_address)
    
    if other_user and other_user.id != user.id:
        return False, f"Another user ({other_user.get_full_name()}) is currently taking an exam from this IP."
    
    # Check if this user already has an exam in progress from a different IP
    active_attempts = ExamAttempt.objects.filter(
        student=user,
        status='in_progress'
    )
    
    if active_attempts.exists():
        current_session = UserSession.objects.filter(
            user=user,
            is_active=True,
            logout_time__isnull=True
        ).order_by('-last_activity').first()
        
        if current_session and current_session.ip_address != ip_address:
            return False, "You already have an exam in progress from a different IP. Please complete it first or use the same device."
    
    return True, ""


def log_user_session(user, request):
    """Create a session log entry for a user"""
    if not is_ip_session_lock_enabled():
        return None
    
    ip_address = get_client_ip(request)
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    session_key = request.session.session_key
    
    if not session_key:
        request.session.create()
        session_key = request.session.session_key
    
    # Close any previous active sessions from this user on other IPs
    UserSession.objects.filter(
        user=user,
        is_active=True,
        logout_time__isnull=True
    ).exclude(ip_address=ip_address).update(is_active=False)
    
    session, created = UserSession.objects.get_or_create(
        user=user,
        session_key=session_key,
        defaults={
            'ip_address': ip_address,
            'user_agent': user_agent,
        }
    )
    
    return session


def close_user_session(user, request):
    """Mark user session as closed"""
    if not is_ip_session_lock_enabled():
        return None
    
    session_key = request.session.session_key
    if not session_key:
        return None
    
    from django.utils import timezone
    
    session = UserSession.objects.filter(
        user=user,
        session_key=session_key
    ).first()
    
    if session:
        session.is_active = False
        session.logout_time = timezone.now()
        session.save()
    
    return session
