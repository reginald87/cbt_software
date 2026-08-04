from ninja import Router
from bmu_cbt.ninja_auth import JWTAuth
from pydantic import BaseModel
from typing import List, Optional
from django.http import HttpResponse
from django.core.exceptions import ValidationError
from users.models import UserSession, User
from users.ip_security import get_client_ip
import csv
import io
from datetime import datetime

router = Router(auth=JWTAuth())


# ==================== Schemas ====================

class UserSessionSchema(BaseModel):
    id: int
    ip_address: str
    is_active: bool
    is_exam_session: bool
    login_time: str
    last_activity: str
    logout_time: Optional[str] = None
    
    class Config:
        from_attributes = True


class BulkStudentUploadSchema(BaseModel):
    """Schema for bulk student upload data"""
    first_name: str
    last_name: str
    email: Optional[str] = None
    user_type: str  # 'matriculated', '100level', 'intending'
    matric_number: Optional[str] = None
    jamb_number: Optional[str] = None
    department: Optional[str] = None
    course: Optional[str] = None
    year_of_entry: Optional[int] = None


class BulkUploadResultSchema(BaseModel):
    """Schema for bulk upload results"""
    total_rows: int
    successful: int
    failed: int
    errors: List[str]
    credentials: List[dict]


# ==================== Endpoints ====================

@router.get("/sessions/", response=List[UserSessionSchema])
def get_user_sessions(request):
    """Get all session records for the current user"""
    sessions = UserSession.objects.filter(
        user=request.user
    ).order_by('-login_time')
    
    return [
        {
            'id': s.id,
            'ip_address': s.ip_address,
            'is_active': s.is_active,
            'is_exam_session': s.is_exam_session,
            'login_time': s.login_time.isoformat(),
            'last_activity': s.last_activity.isoformat(),
            'logout_time': s.logout_time.isoformat() if s.logout_time else None,
        }
        for s in sessions
    ]


@router.get("/current-session/")
def get_current_session(request):
    """Get current active session for the user"""
    ip_address = get_client_ip(request)
    session_key = request.session.session_key
    
    if not session_key:
        return {"error": "No active session"}
    
    session = UserSession.objects.filter(
        user=request.user,
        session_key=session_key,
        is_active=True
    ).first()
    
    if not session:
        return {"error": "Session not found"}
    
    return {
        'id': session.id,
        'ip_address': session.ip_address,
        'is_active': session.is_active,
        'is_exam_session': session.is_exam_session,
        'login_time': session.login_time.isoformat(),
        'last_activity': session.last_activity.isoformat(),
        'logout_time': session.logout_time.isoformat() if session.logout_time else None,
    }


@router.get("/active-sessions/", response=List[UserSessionSchema])
def get_active_user_sessions(request):
    """Get only active session records for the current user"""
    sessions = UserSession.objects.filter(
        user=request.user,
        is_active=True,
        logout_time__isnull=True
    ).order_by('-last_activity')
    
    return [
        {
            'id': s.id,
            'ip_address': s.ip_address,
            'is_active': s.is_active,
            'is_exam_session': s.is_exam_session,
            'login_time': s.login_time.isoformat(),
            'last_activity': s.last_activity.isoformat(),
            'logout_time': None,
        }
        for s in sessions
    ]


# ==================== Bulk Student Upload ====================

@router.get("/bulk-upload/template/")
def download_bulk_upload_template(request):
    """Download CSV template for bulk student upload"""
    if not request.user.is_superuser:
        return {"error": "Admin access required"}
    
    # Create CSV template
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    header = [
        'first_name',
        'last_name', 
        'email',
        'user_type',
        'matric_number',
        'jamb_number',
        'department',
        'course',
        'year_of_entry'
    ]
    writer.writerow(header)
    
    # Write sample data
    sample_data = [
        ['John', 'Doe', 'john.doe@example.com', 'matriculated', 'UG/21/1234', '', 'Medicine', 'MBBS', 2021],
        ['Jane', 'Smith', 'jane.smith@example.com', '100level', '', '202331138700AB', 'Nursing', 'B.Nurs', 2023],
        ['Peter', 'Jones', 'peter.jones@example.com', 'intending', '', '202331138700CD', 'Medicine', 'MBBS', 2023],
    ]
    writer.writerows(sample_data)
    
    # Create HTTP response
    response = HttpResponse(
        output.getvalue(),
        content_type='text/csv'
    )
    response['Content-Disposition'] = 'attachment; filename="student_upload_template.csv"'
    
    return response


@router.post("/bulk-upload/data/")
def process_bulk_student_data(request, students_data: List[BulkStudentUploadSchema]):
    """Process bulk student data and create accounts"""
    if not request.user.is_superuser:
        return {"error": "Admin access required"}
    
    successful = []
    failed = []
    errors = []
    credentials = []
    
    for i, student_data in enumerate(students_data, 1):
        try:
            # Create user
            user = User(
                first_name=student_data.first_name,
                last_name=student_data.last_name,
                email=student_data.email,
                user_type=student_data.user_type,
                matric_number=student_data.matric_number,
                jamb_number=student_data.jamb_number,
                department=student_data.department,
                course=student_data.course,
                year_of_entry=student_data.year_of_entry,
                is_first_login=True,
                temporary_password=True,
                is_staff=False,
                is_superuser=False
            )
            
            # Auto-generate username and password
            username = user.generate_username()
            password = user.generate_password()
            
            user.username = username
            user.set_password(password)
            user.temporary_plain_password = password  # Store plain text for export
            
            # Validate and save
            user.full_clean()
            user.save()
            
            successful.append(user)
            credentials.append({
                'first_name': user.first_name,
                'last_name': user.last_name,
                'username': username,
                'password': password,
                'user_type': user.user_type,
                'matric_number': user.matric_number,
                'jamb_number': user.jamb_number,
                'department': user.department
            })
            
        except ValidationError as e:
            error_msg = f"Row {i}: Validation error - {str(e)}"
            errors.append(error_msg)
            failed.append(i)
        except Exception as e:
            error_msg = f"Row {i}: {str(e)}"
            errors.append(error_msg)
            failed.append(i)
    
    return {
        'total_rows': len(students_data),
        'successful': len(successful),
        'failed': len(failed),
        'errors': errors,
        'credentials': credentials
    }


@router.get("/bulk-upload/credentials/export/")
def export_credentials_csv(request):
    """Export student credentials as CSV for printing"""
    if not request.user.is_superuser:
        return {"error": "Admin access required"}
    
    # Get recently created students (those with temporary passwords)
    recent_students = User.objects.filter(
        temporary_password=True,
        is_staff=False,
        is_superuser=False,
        temporary_plain_password__isnull=False
    ).order_by('-created_at')
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    header = [
        'S/N',
        'Full Name',
        'Username', 
        'Password',
        'User Type',
        'Matric Number',
        'JAMB Number',
        'Department',
        'Course'
    ]
    writer.writerow(header)
    
    # Write student data
    for i, student in enumerate(recent_students, 1):
        row = [
            i,
            f"{student.first_name} {student.last_name}",
            student.username,
            student.temporary_plain_password or '[Password not available]',
            student.user_type,
            student.matric_number or '',
            student.jamb_number or '',
            student.department or '',
            student.course or ''
        ]
        writer.writerow(row)
    
    # Create HTTP response
    response = HttpResponse(
        output.getvalue(),
        content_type='text/csv'
    )
    response['Content-Disposition'] = f'attachment; filename="student_credentials_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
    
    return response
