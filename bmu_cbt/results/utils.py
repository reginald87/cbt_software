"""
Export utilities for exam results
"""
import csv
from datetime import datetime
from django.http import HttpResponse
from results.models import ExamAttempt, Notification
from users.models import User


def export_exam_results_to_csv(exam_id=None):
    """
    Export exam results to CSV format
    Returns HttpResponse with CSV file
    """
    # Filter attempts
    if exam_id:
        attempts = ExamAttempt.objects.filter(
            exam_id=exam_id,
            status='graded'
        ).select_related('student', 'exam')
        exam = attempts.first().exam if attempts.exists() else None
        filename = f"exam_{exam_id}_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    else:
        attempts = ExamAttempt.objects.filter(
            status='graded'
        ).select_related('student', 'exam')
        filename = f"all_exam_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    # Create HTTP response
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    # Create CSV writer
    writer = csv.writer(response)
    
    # Write header
    headers = [
        'Student Name',
        'Username', 
        'Email',
        'User Type',
        'Matric Number',
        'JAMB Number',
        'Department',
        'Exam Title',
        'Exam Category',
        'Total Marks',
        'Percentage',
        'Grade',
        'Pass/Fail',
        'Start Time',
        'Submitted At',
        'Time Taken (minutes)',
        'IP Address'
    ]
    writer.writerow(headers)
    
    # Write data rows
    for attempt in attempts:
        student = attempt.student
        exam = attempt.exam
        
        row = [
            student.get_full_name() or 'N/A',
            student.username,
            student.email or 'N/A',
            student.user_type,
            student.matric_number or 'N/A',
            student.jamb_number or 'N/A',
            student.department or 'N/A',
            exam.title,
            exam.category.name if exam.category else 'N/A',
            attempt.total_marks or 0,
            f"{attempt.percentage:.1f}%" if attempt.percentage else 'N/A',
            attempt.grade or 'N/A',
            'PASS' if attempt.is_passed else 'FAIL',
            attempt.start_time.strftime('%Y-%m-%d %H:%M:%S'),
            attempt.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if attempt.submitted_at else 'N/A',
            f"{(attempt.time_taken_seconds or 0) / 60:.1f}" if attempt.time_taken_seconds else 'N/A',
            attempt.ip_address or 'N/A'
        ]
        writer.writerow(row)
    
    return response


def export_student_performance_csv():
    """
    Export overall student performance summary
    """
    # Get all students with exam attempts
    students = User.objects.filter(
        exam_attempts__status='graded'
    ).distinct()
    
    # Create HTTP response
    response = HttpResponse(content_type='text/csv')
    filename = f"student_performance_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    # Create CSV writer
    writer = csv.writer(response)
    
    # Write header
    headers = [
        'Student Name',
        'Username',
        'Email',
        'User Type',
        'Matric Number',
        'JAMB Number',
        'Department',
        'Total Exams Attempted',
        'Exams Passed',
        'Pass Rate (%)',
        'Average Score (%)',
        'Best Grade',
        'Latest Exam Date'
    ]
    writer.writerow(headers)
    
    # Write data rows
    for student in students:
        attempts = student.exam_attempts.filter(status='graded')
        
        total_exams = attempts.count()
        passed_exams = attempts.filter(is_passed=True).count()
        pass_rate = (passed_exams / total_exams * 100) if total_exams > 0 else 0
        
        # Calculate average score
        scores = [a.percentage for a in attempts if a.percentage is not None]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        # Get best grade (A > B > C > D > E > F)
        grade_order = {'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'F': 1}
        grades = [a.grade for a in attempts if a.grade]
        best_grade = max(grades, key=lambda g: grade_order.get(g, 0)) if grades else 'N/A'
        
        # Latest exam date
        latest_date = attempts.order_by('-start_time').first().start_time if attempts.exists() else None
        
        row = [
            student.get_full_name() or 'N/A',
            student.username,
            student.email or 'N/A',
            student.user_type,
            student.matric_number or 'N/A',
            student.jamb_number or 'N/A',
            student.department or 'N/A',
            total_exams,
            passed_exams,
            f"{pass_rate:.1f}%",
            f"{avg_score:.1f}%",
            best_grade,
            latest_date.strftime('%Y-%m-%d %H:%M:%S') if latest_date else 'N/A'
        ]
        writer.writerow(row)
    
    return response


# ==================== Notification Utilities ====================

def create_notification(type, title, message, priority='medium', exam=None, student=None, attempt=None):
    """Create a new notification"""
    return Notification.objects.create(
        type=type,
        title=title,
        message=message,
        priority=priority,
        exam=exam,
        student=student,
        attempt=attempt
    )

def notify_exam_attempt(attempt):
    """Create notification when a student starts an exam"""
    return create_notification(
        type='exam_attempt',
        title=f'New Exam Attempt: {attempt.exam.title}',
        message=f'{attempt.student.get_full_name() or attempt.student.username} has started the exam "{attempt.exam.title}".',
        priority='medium',
        exam=attempt.exam,
        student=attempt.student,
        attempt=attempt
    )

def notify_exam_submission(attempt):
    """Create notification when a student submits an exam"""
    return create_notification(
        type='grade_complete',
        title=f'Exam Submitted: {attempt.exam.title}',
        message=f'{attempt.student.get_full_name() or attempt.student.username} has submitted the exam "{attempt.exam.title}". Score: {attempt.percentage}% ({attempt.grade})',
        priority='high',
        exam=attempt.exam,
        student=attempt.student,
        attempt=attempt
    )

def notify_security_alert(title, message, attempt=None):
    """Create security alert notification"""
    return create_notification(
        type='security_alert',
        title=title,
        message=message,
        priority='critical',
        attempt=attempt
    )
