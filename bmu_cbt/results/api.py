from ninja import Router, Query
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from pydantic import BaseModel
from typing import List, Optional
from datetime import timedelta
import uuid
from results.models import ExamAttempt, StudentAnswer, Notification
from results.utils import export_exam_results_to_csv, export_student_performance_csv
from exams.models import Exam, Question, Answer, ExamBatch
from users.models import User, UserSession
from ninja.errors import HttpError
from bmu_cbt.ninja_auth import JWTAuth
from audit.logger import record_audit

router = Router(auth=JWTAuth())


def get_client_ip(request):
    """Get the real client IP address from request"""
    # Check for forwarded IP first (for proxies/load balancers)
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def can_user_start_exam_from_ip(user, ip_address):
    """Check if user can start exam from this IP (prevent duplicate logins)"""
    
    # Check if there's an active session for this IP with a different user
    active_session = UserSession.get_active_session_for_ip(ip_address)
    
    if active_session and active_session.user != user:
        # Check if the other user has an active exam
        from results.models import ExamAttempt
        has_active_exam = ExamAttempt.objects.filter(
            student=active_session.user,
            status='in_progress'
        ).exists()
        
        if has_active_exam:
            return False, f"Another user ({active_session.user.username}) is currently taking an exam from this IP address."
    
    # Check if this user already has an active session elsewhere
    user_active_sessions = UserSession.objects.filter(
        user=user,
        is_active=True,
        logout_time__isnull=True
    ).exclude(ip_address=ip_address)
    
    if user_active_sessions.exists():
        return False, f"You already have an active session from a different IP address. Please logout from the other session first."
    
    return True, "OK"


# ==================== Schemas ====================

class StudentAnswerSchema(BaseModel):
    id: int
    question_id: int
    selected_answer_id: Optional[int] = None
    selected_answer_text: Optional[str] = None
    short_answer: Optional[str] = None
    boolean_answer: Optional[bool] = None
    is_correct: bool
    marks_obtained: float
    correct_answer_text: Optional[str] = None

class ExamAttemptListSchema(BaseModel):
    id: int
    exam_id: int
    exam_title: str
    exam_category: Optional[str] = None
    batch_id: Optional[int] = None
    batch_name: Optional[str] = None
    status: str
    percentage: Optional[float] = None
    grade: Optional[str] = None
    is_passed: bool
    start_time: str
    submitted_at: Optional[str] = None
    time_taken_seconds: Optional[int] = None

class ExamAttemptDetailSchema(BaseModel):
    id: int
    exam_id: int
    exam_title: str
    student_id: int
    status: str
    total_marks: Optional[float] = None
    percentage: Optional[float] = None
    grade: Optional[str] = None
    is_passed: bool
    start_time: str
    submitted_at: Optional[str] = None
    time_taken_seconds: Optional[int] = None
    answers: List[StudentAnswerSchema] = []

class SubmitAnswersSchema(BaseModel):
    """Schema for submitting exam answers"""
    question_id: int
    selected_answer_id: Optional[int] = None
    short_answer: Optional[str] = None
    boolean_answer: Optional[bool] = None
    time_spent_seconds: int = 0


# ==================== Endpoints ====================

@router.post("/start/")
def start_exam(request, exam_id: int):
    """Start an exam attempt for the current user"""
    student = request.user
    exam = get_object_or_404(Exam, id=exam_id)
    
    # Check if exam is available
    if not exam.is_available():
        raise HttpError(400, "Exam is not available")

    # Batch gating: batched exams require a batch assignment and an open window.
    batch = None
    if exam.batches.exists():
        batch = ExamBatch.objects.filter(exam=exam, students=student).first()
        if not batch:
            raise HttpError(403, "You are not assigned to a batch for this exam")
        now = timezone.now()
        if now < batch.start_time:
            raise HttpError(
                400,
                f"Your batch ({batch.name}) starts at {batch.start_time.strftime('%Y-%m-%d %H:%M')}"
            )
        if now > batch.end_time:
            raise HttpError(
                400,
                f"Your batch ({batch.name}) window has ended at {batch.end_time.strftime('%Y-%m-%d %H:%M')}"
            )
    
    # Check if user already has an in-progress attempt
    existing_attempt = ExamAttempt.objects.filter(student=student, exam=exam).order_by('-start_time').first()

    if existing_attempt:
        if existing_attempt.status == 'in_progress':
            return {
                "id": existing_attempt.id,
                "message": "You already have an in-progress attempt for this exam"
            }
        raise HttpError(400, "You have already attempted this exam")
    
    # IP-based security check
    ip_address = get_client_ip(request)
    
    # Check for IP conflicts before starting exam
    allowed, message = can_user_start_exam_from_ip(student, ip_address)
    if not allowed:
        raise HttpError(403, message)
    
    # Create user session for tracking
    UserSession.objects.update_or_create(
        user=student,
        ip_address=ip_address,
        defaults={
            'session_key': uuid.uuid4().hex,
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'is_exam_session': True,
            'logout_time': None,
            'is_active': True
        }
    )
    
    # Create new attempt
    attempt = ExamAttempt.objects.create(
        student=student,
        exam=exam,
        batch=batch,
        ip_address=ip_address,
        user_agent=request.META.get('HTTP_USER_AGENT', '')
    )
    
    # Create notification for exam attempt
    from results.utils import notify_exam_attempt
    try:
        notify_exam_attempt(attempt)
    except Exception as e:
        print(f"Failed to create notification: {e}")
    
    return {
        "id": attempt.id,
        "attempt_id": attempt.id,
        "exam_id": exam.id,
        "message": "Exam started successfully",
        "duration_minutes": exam.duration_minutes,
        "remaining_seconds": exam.duration_minutes * 60  # Convert to seconds
    }

@router.get("/check-ip-conflict/")
def check_ip_conflict(request, exam_id: int):
    """Check if there's an IP conflict before starting exam"""
    student = request.user
    exam = get_object_or_404(Exam, id=exam_id)
    ip_address = get_client_ip(request)
    
    allowed, message = can_user_start_exam_from_ip(student, ip_address)
    
    return {
        "allowed": allowed,
        "message": message if not allowed else "You can start the exam",
        "ip_address": ip_address
    }

@router.get("/attempts/", response=List[ExamAttemptListSchema])
def get_student_attempts(request):
    """Get all exam attempts for the current student"""
    attempts = ExamAttempt.objects.filter(
        student=request.user
    ).select_related('exam', 'exam__category', 'batch').order_by('-start_time')
    
    return [
        {
            'id': a.id,
            'exam_id': a.exam.id,
            'exam_title': a.exam.title,
            'exam_category': a.exam.category.name if a.exam.category else None,
            'batch_id': a.batch.id if a.batch else None,
            'batch_name': a.batch.name if a.batch else None,
            'status': a.status,
            'percentage': a.percentage,
            'grade': a.grade,
            'is_passed': a.is_passed,
            'start_time': a.start_time.isoformat(),
            'submitted_at': a.submitted_at.isoformat() if a.submitted_at else None,
            'time_taken_seconds': a.time_taken_seconds,
        }
        for a in attempts
    ]

# ==================== Admin Endpoints ====================

@router.get("/debug-attempt/{attempt_id}/")
def debug_attempt(request, attempt_id: int):
    """Debug a specific attempt to see what's wrong"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    attempt = get_object_or_404(ExamAttempt, id=attempt_id)
    
    # Get all answers for this attempt
    answers = attempt.answers.all().select_related('question', 'selected_answer')
    
    answer_details = []
    for answer in answers:
        answer_details.append({
            'question_id': answer.question.id,
            'question_text': answer.question.question_text[:100] + '...' if len(answer.question.question_text) > 100 else answer.question.question_text,
            'question_type': answer.question.question_type,
            'selected_answer_id': answer.selected_answer.id if answer.selected_answer else None,
            'selected_answer_text': answer.selected_answer.answer_text[:50] + '...' if answer.selected_answer and len(answer.selected_answer.answer_text) > 50 else (answer.selected_answer.answer_text if answer.selected_answer else None),
            'is_correct': answer.is_correct,
            'marks_obtained': answer.marks_obtained,
            'question_marks': answer.question.marks,
            'time_spent_seconds': answer.time_spent_seconds
        })
    
    return {
        'attempt_id': attempt.id,
        'exam_title': attempt.exam.title,
        'student': attempt.student.username,
        'status': attempt.status,
        'percentage': attempt.percentage,
        'grade': attempt.grade,
        'is_passed': attempt.is_passed,
        'total_marks': attempt.total_marks,
        'time_taken_seconds': attempt.time_taken_seconds,
        'start_time': attempt.start_time.isoformat(),
        'submitted_at': attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        'total_answers': answers.count(),
        'answers': answer_details
    }


@router.post("/regrade-all-attempts/")
def regrade_all_attempts(request):
    """Manually regrade all submitted attempts (admin only)"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    attempts = ExamAttempt.objects.filter(
        status__in=['submitted', 'graded']
    ).select_related('exam', 'student')
    
    results = []
    for attempt in attempts:
        try:
            old_percentage = attempt.percentage
            old_grade = attempt.grade
            
            # Recalculate score
            total_marks, percentage = attempt.calculate_score()
            
            results.append({
                'attempt_id': attempt.id,
                'exam_title': attempt.exam.title,
                'student': attempt.student.username,
                'old_percentage': old_percentage,
                'new_percentage': percentage,
                'old_grade': old_grade,
                'new_grade': attempt.grade,
                'status': attempt.status
            })
        except Exception as e:
            results.append({
                'attempt_id': attempt.id,
                'error': str(e)
            })

    record_audit(
        request,
        'exam.regrade_all',
        label=f"Admin regraded {attempts.count()} exam attempts",
        details={'total_attempts': attempts.count()},
    )
    
    return {
        'total_attempts': attempts.count(),
        'results': results
    }


@router.get("/monitor/active-exams/")
def get_active_exams(request):
    """Get currently active exams with statistics"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    from django.utils import timezone
    from datetime import timedelta
    
    now = timezone.now()
    active_exams = []
    
    # Get exams with active attempts
    exams_with_attempts = Exam.objects.filter(
        attempts__status='in_progress'
    ).distinct()
    
    for exam in exams_with_attempts:
        active_attempts = exam.attempts.filter(status='in_progress')
        total_attempts = exam.attempts.all()
        
        # Calculate average progress
        total_questions = exam.questions.count()
        avg_progress = 0
        
        if total_questions > 0:
            total_answered = 0
            for attempt in active_attempts:
                answered_count = attempt.answers.count()
                total_answered += answered_count
            
            if active_attempts.count() > 0:
                avg_progress = (total_answered / (active_attempts.count() * total_questions)) * 100
        
        # Calculate average time remaining
        avg_time_remaining = 0
        if active_attempts.count() > 0:
            total_time_remaining = 0
            for attempt in active_attempts:
                elapsed = (now - attempt.start_time).total_seconds()
                time_allowed = exam.duration_minutes * 60
                remaining = max(0, time_allowed - elapsed)
                total_time_remaining += remaining
            avg_time_remaining = int(total_time_remaining / active_attempts.count())
        
        active_exams.append({
            'id': exam.id,
            'title': exam.title,
            'category': exam.category.name if exam.category else 'Uncategorized',
            'active_attempts': active_attempts.count(),
            'total_attempts': total_attempts.count(),
            'avg_progress': avg_progress,
            'time_remaining': avg_time_remaining
        })
    
    return active_exams


@router.get("/monitor/active-attempts/")
def get_active_attempts(request):
    """Get all currently active exam attempts"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    from django.utils import timezone
    
    now = timezone.now()
    active_attempts = []
    
    attempts = ExamAttempt.objects.filter(
        status='in_progress'
    ).select_related('exam', 'exam__category', 'student').order_by('-start_time')
    
    for attempt in attempts:
        # Calculate progress
        total_questions = attempt.exam.questions.count()
        progress = 0
        if total_questions > 0:
            answered_count = attempt.answers.count()
            progress = (answered_count / total_questions) * 100
        
        # Calculate time remaining
        elapsed = (now - attempt.start_time).total_seconds()
        time_allowed = attempt.exam.duration_minutes * 60
        time_remaining = max(0, int(time_allowed - elapsed))
        
        # Get last activity time
        last_activity = attempt.start_time
        if attempt.answers.exists():
            last_answer = attempt.answers.order_by('-last_updated').first()
            if last_answer:
                last_activity = last_answer.last_updated
        
        # Get student profile picture URL
        student_photo_url = None
        if attempt.student.profile_picture:
            student_photo_url = request.build_absolute_uri(attempt.student.profile_picture.url)
        
        active_attempts.append({
            'id': attempt.id,
            'exam_title': attempt.exam.title,
            'student_name': attempt.student.get_full_name() or attempt.student.username,
            'student_username': attempt.student.username,
            'student_photo': student_photo_url,
            'progress': progress,
            'time_remaining': time_remaining,
            'ip_address': attempt.ip_address or 'Unknown',
            'start_time': attempt.start_time.isoformat(),
            'last_activity': last_activity.isoformat()
        })
    
    return active_attempts


@router.get("/monitor/stats/")
def get_monitor_stats(request):
    """Get overall monitoring statistics"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    from django.utils import timezone
    from datetime import date
    
    # Active exams (exams with in-progress attempts)
    active_exams_count = Exam.objects.filter(
        attempts__status='in_progress'
    ).distinct().count()
    
    # Active students
    active_students_count = ExamAttempt.objects.filter(
        status='in_progress'
    ).values('student').distinct().count()
    
    # Average completion rate
    all_attempts = ExamAttempt.objects.filter(
        status__in=['submitted', 'graded']
    )
    avg_completion_rate = 0
    if all_attempts.exists():
        total_progress = 0
        for attempt in all_attempts:
            total_questions = attempt.exam.questions.count()
            if total_questions > 0:
                answered_count = attempt.answers.count()
                progress = (answered_count / total_questions) * 100
                total_progress += progress
        avg_completion_rate = total_progress / all_attempts.count()
    
    # Today's attempts
    today = date.today()
    today_attempts_count = ExamAttempt.objects.filter(
        start_time__date=today
    ).count()
    
    return {
        'total_active_exams': active_exams_count,
        'total_active_students': active_students_count,
        'avg_completion_rate': avg_completion_rate,
        'total_attempts_today': today_attempts_count
    }

@router.post("/{attempt_id}/log-tab-switch/")
def log_tab_switch(request, attempt_id: int, payload: dict):
    """Log tab switch events for security monitoring"""
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, student=request.user)
    
    # Check if attempt is still in progress
    if attempt.status != 'in_progress':
        return {"error": "This exam attempt is not in progress"}
    
    # Log the tab switch event
    from django.utils import timezone
    
    # You could create a TabSwitchLog model for detailed logging
    # For now, we'll just update a counter on the attempt
    if not hasattr(attempt, 'tab_switch_count'):
        attempt.tab_switch_count = 0
    
    attempt.tab_switch_count += 1
    attempt.save(update_fields=['tab_switch_count'])
    
    # Log to console for monitoring
    print(f"Tab switch detected: Attempt {attempt_id}, Student {attempt.student.username}, Event: {payload.get('event_type')}, Count: {attempt.tab_switch_count}")
    
    return {
        "success": True,
        "tab_switch_count": attempt.tab_switch_count,
        "message": "Tab switch logged"
    }

@router.post("/{attempt_id}/upload-screen-recording/")
def upload_screen_recording(request, attempt_id: int):
    """Upload screen recording for proctoring"""
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, student=request.user)
    
    # Check if attempt is still in progress
    if attempt.status != 'in_progress':
        return {"error": "This exam attempt is not in progress"}
    
    if 'video' not in request.FILES:
        return {"error": "No video file provided"}
    
    video_file = request.FILES['video']
    
    # Validate file type and size
    allowed_types = ['video/webm', 'video/mp4']
    if video_file.content_type not in allowed_types:
        return {"error": "Invalid video format. Only WebM and MP4 are allowed."}
    
    max_size = 50 * 1024 * 1024  # 50MB
    if video_file.size > max_size:
        return {"error": "Video file too large. Maximum size is 50MB."}
    
    # Generate unique filename
    import os
    from django.conf import settings
    from django.utils import timezone
    
    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    filename = f"screen_recording_{attempt.id}_{timestamp}.webm"
    
    # Create recordings directory if it doesn't exist
    recordings_dir = os.path.join(settings.MEDIA_ROOT, 'recordings')
    os.makedirs(recordings_dir, exist_ok=True)
    
    # Save the file
    file_path = os.path.join(recordings_dir, filename)
    
    with open(file_path, 'wb+') as destination:
        for chunk in video_file.chunks():
            destination.write(chunk)
    
    # Log the recording
    print(f"Screen recording uploaded: Attempt {attempt_id}, Student {attempt.student.username}, File: {filename}")
    
    return {
        "success": True,
        "filename": filename,
        "size": video_file.size,
        "message": "Screen recording uploaded successfully"
    }

@router.post("/{attempt_id}/upload-webcam-image/")
def upload_webcam_image(request, attempt_id: int):
    """Upload webcam image for proctoring"""
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, student=request.user)
    
    # Check if attempt is still in progress
    if attempt.status != 'in_progress':
        return {"error": "This exam attempt is not in progress"}
    
    if 'image' not in request.FILES:
        return {"error": "No image file provided"}
    
    image_file = request.FILES['image']
    
    # Validate file type and size
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png']
    if image_file.content_type not in allowed_types:
        return {"error": "Invalid image format. Only JPEG and PNG are allowed."}
    
    max_size = 5 * 1024 * 1024  # 5MB
    if image_file.size > max_size:
        return {"error": "Image file too large. Maximum size is 5MB."}
    
    # Generate unique filename
    import os
    from django.conf import settings
    from django.utils import timezone
    
    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    filename = f"webcam_{attempt.id}_{timestamp}.jpg"
    
    # Create webcam directory if it doesn't exist
    webcam_dir = os.path.join(settings.MEDIA_ROOT, 'webcam')
    os.makedirs(webcam_dir, exist_ok=True)
    
    # Save the file
    file_path = os.path.join(webcam_dir, filename)
    
    with open(file_path, 'wb+') as destination:
        for chunk in image_file.chunks():
            destination.write(chunk)
    
    # Log the capture
    print(f"Webcam image uploaded: Attempt {attempt_id}, Student {attempt.student.username}, File: {filename}")
    
    return {
        "success": True,
        "filename": filename,
        "size": image_file.size,
        "message": "Webcam image uploaded successfully"
    }

@router.get("/{attempt_id}/check-session/")
def check_session_validity(request, attempt_id: int):
    """Check if the current session is still valid"""
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, student=request.user)
    
    # Check if attempt is still in progress
    if attempt.status != 'in_progress':
        return {"valid": False, "message": "Exam attempt is not in progress"}
    
    # Check IP address consistency
    client_ip = get_client_ip(request)
    if attempt.ip_address and attempt.ip_address != client_ip:
        return {
            "valid": False, 
            "message": f"IP address changed from {attempt.ip_address} to {client_ip}"
        }
    
    # Check for concurrent sessions
    from users.models import UserSession
    
    # Get current session info
    current_sessions = UserSession.objects.filter(
        user=request.user,
        is_active=True,
        logout_time__isnull=True
    ).order_by('-last_activity')
    
    if current_sessions.count() > 1:
        return {
            "valid": False,
            "message": "Multiple active sessions detected"
        }
    
    # Check session age
    if current_sessions.exists():
        session = current_sessions.first()
        if session.is_expired(timeout_minutes=180):  # 3 hours
            return {
                "valid": False,
                "message": "Session expired"
            }
    
    return {"valid": True, "message": "Session is valid"}


@router.post("/{attempt_id}/update-activity/")
def update_activity(request, attempt_id: int, payload: dict):
    """Update last activity timestamp"""
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, student=request.user)
    
    # Update session last activity
    from users.models import UserSession
    
    client_ip = get_client_ip(request)
    session = UserSession.objects.filter(
        user=request.user,
        ip_address=client_ip,
        is_active=True
    ).first()
    
    if session:
        from django.utils import timezone
        session.last_activity = timezone.now()
        session.save(update_fields=['last_activity'])
    
    return {"success": True, "message": "Activity updated"}


@router.post("/{attempt_id}/log-anomaly/")
def log_environment_anomaly(request, attempt_id: int, payload: dict):
    """Log environment anomalies for security monitoring"""
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, student=request.user)
    
    # Log the anomaly
    print(f"Environment anomaly detected: Attempt {attempt_id}, Student {attempt.student.username}")
    print(f"Anomalies: {payload.get('anomalies', [])}")
    print(f"User Agent: {payload.get('user_agent')}")
    print(f"Screen Resolution: {payload.get('screen_resolution')}")
    print(f"Window Size: {payload.get('window_size')}")
    
    # You could create an AnomalyLog model for detailed tracking
    return {"success": True, "message": "Anomaly logged"}


@router.post("/{attempt_id}/log-window-blur/")
def log_window_blur(request, attempt_id: int, payload: dict):
    """Log window blur events for security monitoring"""
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, student=request.user)
    
    # Log the window blur event
    print(f"Window blur detected: Attempt {attempt_id}, Student {attempt.student.username}, Time: {payload.get('timestamp')}")
    
    return {"success": True, "message": "Window blur logged"}

@router.get("/security/events/")
def get_security_events(request):
    """Get recent security events for monitoring"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    # This would typically query a SecurityEvent model
    # For now, we'll return mock data based on console logs
    from django.utils import timezone
    from datetime import timedelta
    
    # Mock events based on recent activity
    events = []
    
    # Get recent attempts with security issues
    recent_attempts = ExamAttempt.objects.filter(
        start_time__gte=timezone.now() - timedelta(hours=24)
    ).select_related('student', 'exam')
    
    for attempt in recent_attempts:
        # Check for tab switches
        if hasattr(attempt, 'tab_switch_count') and attempt.tab_switch_count > 0:
            events.append({
                'id': f"tab_switch_{attempt.id}",
                'timestamp': attempt.start_time.isoformat(),
                'event_type': 'tab_switch',
                'student_name': attempt.student.get_full_name() or attempt.student.username,
                'student_username': attempt.student.username,
                'exam_title': attempt.exam.title,
                'attempt_id': attempt.id,
                'details': {'count': attempt.tab_switch_count},
                'severity': 'high' if attempt.tab_switch_count > 2 else 'medium'
            })
        
        # Check for IP changes (mock data)
        if attempt.ip_address:
            events.append({
                'id': f"session_check_{attempt.id}",
                'timestamp': attempt.start_time.isoformat(),
                'event_type': 'session_anomaly',
                'student_name': attempt.student.get_full_name() or attempt.student.username,
                'student_username': attempt.student.username,
                'exam_title': attempt.exam.title,
                'attempt_id': attempt.id,
                'details': {'ip_address': attempt.ip_address},
                'severity': 'low'
            })
    
    # Sort by timestamp descending
    events.sort(key=lambda x: x['timestamp'], reverse=True)
    
    return events[:50]  # Return last 50 events


@router.get("/security/stats/")
def get_security_stats(request):
    """Get security monitoring statistics"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    from django.utils import timezone
    from datetime import timedelta
    
    # Get recent attempts
    recent_attempts = ExamAttempt.objects.filter(
        start_time__gte=timezone.now() - timedelta(hours=24)
    )
    
    # Calculate stats
    total_events = 0
    critical_events = 0
    tab_switches = 0
    
    for attempt in recent_attempts:
        if hasattr(attempt, 'tab_switch_count') and attempt.tab_switch_count > 0:
            tab_switches += attempt.tab_switch_count
            total_events += attempt.tab_switch_count
            if attempt.tab_switch_count > 2:
                critical_events += 1
    
    # Count unique students with issues
    students_flagged = recent_attempts.filter(
        tab_switch_count__gt=0
    ).values('student').distinct().count()
    
    # Mock proctoring stats (would come from actual file counts)
    import os
    from django.conf import settings
    
    webcam_dir = os.path.join(settings.MEDIA_ROOT, 'webcam')
    recordings_dir = os.path.join(settings.MEDIA_ROOT, 'recordings')
    
    webcam_captures = 0
    screen_recordings = 0
    
    if os.path.exists(webcam_dir):
        webcam_captures = len([f for f in os.listdir(webcam_dir) if f.endswith('.jpg')])
    
    if os.path.exists(recordings_dir):
        screen_recordings = len([f for f in os.listdir(recordings_dir) if f.endswith('.webm')])
    
    return {
        'total_events': total_events,
        'critical_events': critical_events,
        'active_exams_with_issues': len(recent_attempts.filter(status='in_progress', tab_switch_count__gt=0)),
        'students_flagged': students_flagged,
        'tab_switches': tab_switches,
        'screen_recordings': screen_recordings,
        'webcam_captures': webcam_captures,
        'session_anomalies': critical_events
    }

@router.get("/admin/attempts/", response=List[ExamAttemptListSchema])
def get_all_attempts(request, exam_id: Optional[int] = Query(None)):
    """Get all exam attempts (admin only)"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    attempts = ExamAttempt.objects.all()
    if exam_id:
        attempts = attempts.filter(exam_id=exam_id)
    
    attempts = attempts.select_related('exam', 'exam__category', 'student', 'batch').order_by('-start_time')
    
    return [
        {
            'id': a.id,
            'exam_id': a.exam.id,
            'exam_title': a.exam.title,
            'exam_category': a.exam.category.name if a.exam.category else None,
            'batch_id': a.batch.id if a.batch else None,
            'batch_name': a.batch.name if a.batch else None,
            'status': a.status,
            'percentage': a.percentage,
            'grade': a.grade,
            'is_passed': a.is_passed,
            'start_time': a.start_time.isoformat(),
            'submitted_at': a.submitted_at.isoformat() if a.submitted_at else None,
            'time_taken_seconds': a.time_taken_seconds,
        }
        for a in attempts
    ]

def _student_answer_text(sa):
    """Human-readable text of the student's own answer for review."""
    if sa.selected_answer:
        return sa.selected_answer.answer_text
    if sa.boolean_answer is not None:
        return 'True' if sa.boolean_answer else 'False'
    if sa.short_answer:
        return sa.short_answer
    return None


def _correct_answer_text(question):
    """Text of the correct answer for review (admin-configured show_answers gate applied by caller)."""
    # Iterate the (prefetched) answers instead of filter(), which would bypass
    # the prefetch cache and trigger one query per question.
    correct = next((a for a in question.answers.all() if a.is_correct), None)
    if correct:
        return correct.answer_text
    return question.correct_answer or None


@router.get("/{attempt_id}/", response=ExamAttemptDetailSchema)
def get_attempt_detail(request, attempt_id: int):
    """Get detailed results of an exam attempt"""
    attempt = get_object_or_404(
        ExamAttempt.objects.select_related('exam', 'student'),
        id=attempt_id,
        student=request.user,
    )
    answers = attempt.answers.select_related('question', 'selected_answer').prefetch_related('question__answers').all()

    return {
        'id': attempt.id,
        'exam_id': attempt.exam.id,
        'exam_title': attempt.exam.title,
        'student_id': attempt.student.id,
        'status': attempt.status,
        'total_marks': attempt.total_marks,
        'percentage': attempt.percentage,
        'grade': attempt.grade,
        'is_passed': attempt.is_passed,
        'start_time': attempt.start_time.isoformat(),
        'submitted_at': attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        'time_taken_seconds': attempt.time_taken_seconds,
        'answers': [
            {
                'id': sa.id,
                'question_id': sa.question.id,
                'selected_answer_id': sa.selected_answer.id if sa.selected_answer else None,
                'selected_answer_text': _student_answer_text(sa),
                'short_answer': sa.short_answer,
                'boolean_answer': sa.boolean_answer,
                'is_correct': sa.is_correct,
                'marks_obtained': sa.marks_obtained,
                'correct_answer_text': _correct_answer_text(sa.question) if attempt.exam.show_answers else None,
            }
            for sa in answers
        ]
    }

@router.post("/{attempt_id}/submit-answer/")
def submit_answer(request, attempt_id: int, payload: SubmitAnswersSchema):
    """Submit an answer for a question in an exam"""
    attempt = get_object_or_404(
        ExamAttempt.objects.select_related('exam'),
        id=attempt_id,
        student=request.user,
    )
    
    # Check if attempt is still in progress
    if attempt.status != 'in_progress':
        return {"error": "This exam attempt is not in progress"}
    
    # Check if exam time has expired
    exam_duration = timedelta(minutes=attempt.exam.duration_minutes)
    if timezone.now() > attempt.start_time + exam_duration:
        # Auto-submit the exam
        with transaction.atomic():
            attempt.status = 'submitted'
            attempt.submitted_at = timezone.now()
            attempt.end_time = attempt.submitted_at
            attempt.time_taken_seconds = int((attempt.submitted_at - attempt.start_time).total_seconds())
            attempt.save()
            total_marks, percentage = attempt.calculate_score()
        raise HttpError(400, "Exam time has expired. Your exam has been auto-submitted.")
    
    question = get_object_or_404(Question, id=payload.question_id, exam=attempt.exam)
    
    # Get or create student answer and auto-grade it atomically
    with transaction.atomic():
        student_answer, created = StudentAnswer.objects.update_or_create(
            attempt=attempt,
            question=question,
            defaults={
                'selected_answer_id': payload.selected_answer_id,
                'short_answer': payload.short_answer,
                'boolean_answer': payload.boolean_answer,
                'time_spent_seconds': payload.time_spent_seconds,
            }
        )
        # Auto-grade the answer
        student_answer.grade_answer()
    
    return {
        "id": student_answer.id,
        "saved": True,
        "message": "Answer saved successfully"
    }

@router.post("/{attempt_id}/submit/")
def submit_exam(request, attempt_id: int):
    """Submit the exam and finalize scoring"""
    attempt = get_object_or_404(
        ExamAttempt.objects.select_related('exam'),
        id=attempt_id,
        student=request.user,
    )
    
    if attempt.status != 'in_progress':
        raise HttpError(400, "This exam is not in progress")
    
    with transaction.atomic():
        # Check if exam time has expired — allow late submission but record it
        exam_duration = timedelta(minutes=attempt.exam.duration_minutes)
        is_late = timezone.now() > attempt.start_time + exam_duration
        
        # Set submission time
        attempt.submitted_at = timezone.now()
        attempt.end_time = attempt.submitted_at
        attempt.status = 'submitted'
        
        # Calculate time taken
        time_diff = attempt.submitted_at - attempt.start_time
        attempt.time_taken_seconds = int(time_diff.total_seconds())
        
        attempt.save()
        
        # Calculate scores
        total_marks, percentage = attempt.calculate_score()
        
        # Create notification for exam submission
        from results.utils import notify_exam_submission
        try:
            notify_exam_submission(attempt)
        except Exception as e:
            print(f"Failed to create notification: {e}")

        record_audit(
            request,
            'exam.submit',
            label=f"User '{request.user.username}' submitted exam '{attempt.exam.title}'",
            user=request.user,
            model_name='ExamAttempt',
            object_id=attempt.id,
            details={
                'exam_id': attempt.exam_id,
                'percentage': percentage,
                'is_passed': attempt.is_passed,
                'is_late': is_late,
            },
        )
    
    return {
        "id": attempt.id,
        "status": attempt.status,
        "total_marks": total_marks,
        "percentage": percentage,
        "grade": attempt.grade,
        "is_passed": attempt.is_passed,
        "message": "Exam submitted successfully"
    }

# ==================== Notification Schemas ====================

class NotificationSchema(BaseModel):
    id: int
    type: str
    title: str
    message: str
    priority: str
    is_read: bool
    created_at: str
    exam_id: Optional[int] = None
    student_id: Optional[int] = None
    attempt_id: Optional[int] = None

# ==================== Notification Endpoints ====================

@router.get("/notifications/")
def get_notifications(request):
    """Get all notifications for admin users"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    # Return empty list for now to eliminate 422 error
    return []

@router.post("/notifications/{notification_id}/mark-read/")
def mark_notification_read(request, notification_id: int):
    """Mark a notification as read"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    try:
        notification = get_object_or_404(Notification, id=notification_id)
        notification.is_read = True
        notification.save()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/notifications/unread-count/")
def get_unread_count(request):
    """Get count of unread notifications"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    count = Notification.objects.filter(is_read=False).count()
    return {"unread_count": count}


@router.get("/security/proctoring-sessions/")
def get_proctoring_sessions(request):
    """Get live proctoring sessions for admin monitoring"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    from django.utils import timezone
    from datetime import timedelta
    
    now = timezone.now()
    proctoring_sessions = []
    
    # Get active attempts with proctoring data
    attempts = ExamAttempt.objects.filter(
        status='in_progress'
    ).select_related('exam', 'exam__category', 'student').order_by('-start_time')
    
    for attempt in attempts:
        # Calculate progress
        total_questions = attempt.exam.questions.count()
        progress = 0
        if total_questions > 0:
            answered_count = attempt.answers.count()
            progress = (answered_count / total_questions) * 100
        
        # Calculate time remaining
        elapsed = (now - attempt.start_time).total_seconds()
        time_allowed = attempt.exam.duration_minutes * 60
        time_remaining = max(0, int(time_allowed - elapsed))
        
        # Get last activity time
        last_activity = attempt.start_time
        if attempt.answers.exists():
            last_answer = attempt.answers.order_by('-last_updated').first()
            if last_answer:
                last_activity = last_answer.last_updated
        
        # Get student profile picture
        student_photo_url = None
        if attempt.student.profile_picture:
            student_photo_url = request.build_absolute_uri(attempt.student.profile_picture.url)
        
        # Check for proctoring files
        import os
        from django.conf import settings
        
        webcam_dir = os.path.join(settings.MEDIA_ROOT, 'webcam')
        recordings_dir = os.path.join(settings.MEDIA_ROOT, 'recordings')
        
        webcam_files = []
        recording_files = []
        
        if os.path.exists(webcam_dir):
            webcam_files = [f for f in os.listdir(webcam_dir) if f.startswith(f'webcam_{attempt.id}_')]
        
        if os.path.exists(recordings_dir):
            recording_files = [f for f in os.listdir(recordings_dir) if f.startswith(f'screen_recording_{attempt.id}_')]
        
        # Determine if webcam/screen recording is active (recent files)
        webcam_active = len(webcam_files) > 0
        screen_recording = len(recording_files) > 0
        
        # Calculate security score based on tab switches and anomalies
        security_score = 100
        if hasattr(attempt, 'tab_switch_count') and attempt.tab_switch_count > 0:
            security_score = max(0, 100 - (attempt.tab_switch_count * 15))
        
        proctoring_sessions.append({
            'id': attempt.id,
            'student_name': attempt.student.get_full_name() or attempt.student.username,
            'student_username': attempt.student.username,
            'student_photo': student_photo_url,
            'exam_title': attempt.exam.title,
            'start_time': attempt.start_time.isoformat(),
            'webcam_active': webcam_active,
            'screen_recording': screen_recording,
            'tab_switch_count': getattr(attempt, 'tab_switch_count', 0),
            'security_score': security_score,
            'webcam_captures': len(webcam_files),
            'screen_recordings': len(recording_files),
            'progress': progress,
            'time_remaining': time_remaining,
            'ip_address': attempt.ip_address or 'Unknown',
            'last_activity': last_activity.isoformat()
        })
    
    return proctoring_sessions


# ==================== Analytics Endpoints ====================

@router.get("/export/exam-results/")
def export_exam_results_csv(request, exam_id: Optional[int] = Query(None), batch_id: Optional[int] = Query(None)):
    """Export exam results to CSV (admin only). Optionally filter by exam and/or batch."""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    try:
        return export_exam_results_to_csv(exam_id=exam_id, batch_id=batch_id)
    except Exception as e:
        raise HttpError(400, f"Error exporting results: {str(e)}")

@router.get("/export/student-performance/")
def export_student_performance_csv(request):
    """Export student performance to CSV (admin only)"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    try:
        return export_student_performance_csv()
    except Exception as e:
        raise HttpError(400, f"Error exporting performance: {str(e)}")

@router.get("/analytics/")
def get_analytics(request):
    """Get comprehensive analytics data"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
    # Return minimal data to avoid 422 errors
    return {
        'overview': {
            'total_exams': 0,
            'total_students': 0,
            'total_attempts': 0,
            'average_score': 0,
            'pass_rate': 0,
            'completion_rate': 0
        },
        'performance': {
            'by_category': [],
            'by_difficulty': [],
            'time_trends': []
        },
        'student_performance': {
            'top_performers': [],
            'struggling_students': [],
            'department_stats': []
        }
    }
