from ninja import Router
from ninja.errors import HttpError
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

def _generate_bulk_usernames(count, existing_usernames):
    """Generate `count` unique BMU-XXXX usernames without per-user DB queries.

    Collisions are resolved in memory against the provided set of existing
    usernames. If the configured numeric space is exhausted, the suffix length
    is increased automatically.
    """
    from django.utils.crypto import get_random_string
    from django.conf import settings

    prefix = settings.BMU_CONFIG.get('USERNAME_PREFIX', 'BMU-')
    length = settings.BMU_CONFIG.get('USERNAME_LENGTH', 4)

    used = set(existing_usernames)
    usernames = []

    while len(usernames) < count:
        # Expand the suffix length if the current space is running out
        if len(used) >= 10 ** length:
            length += 1
        numbers = get_random_string(length=length, allowed_chars='0123456789')
        username = f"{prefix}{numbers}"
        if username in used:
            continue
        used.add(username)
        usernames.append(username)

    return usernames

@router.get("/bulk-upload/template/")
def download_bulk_upload_template(request):
    """Download CSV template for bulk student upload"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
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
    from django.db import transaction
    from django.contrib.auth.hashers import make_password
    from django.contrib.auth.models import Group
    from django.conf import settings

    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")

    # Existing identifiers/usernames used to detect duplicates up front so a
    # single bad row can't abort a bulk_create batch.
    existing_usernames = set(User.objects.values_list('username', flat=True))
    existing_matric = set(User.objects.exclude(matric_number__isnull=True).exclude(matric_number='')
                          .values_list('matric_number', flat=True))
    existing_jamb = set(User.objects.exclude(jamb_number__isnull=True).exclude(jamb_number='')
                        .values_list('jamb_number', flat=True))

    usernames = _generate_bulk_usernames(len(students_data), existing_usernames)

    user_type_by_group = {
        'matriculated': 'matriculated_students',
        '100level': '100level_students',
        'intending': 'intending_students',
    }

    users_to_create = []
    group_users = {}
    credentials = []
    errors = []
    failed_rows = []

    for i, student_data in enumerate(students_data, 1):
        try:
            user = User(
                first_name=student_data.first_name,
                last_name=student_data.last_name,
                email=student_data.email,
                user_type=student_data.user_type,
                matric_number=student_data.matric_number,
                jamb_number=student_data.jamb_number,
                department=student_data.department,
                course=student_data.course or '',
                year_of_entry=student_data.year_of_entry,
                is_first_login=True,
                temporary_password=True,
                is_staff=False,
                is_superuser=False
            )

            # Uniqueness checks (format validation happens in full_clean below)
            if user.matric_number and user.matric_number in existing_matric:
                raise ValidationError("Matric number already exists")
            if user.jamb_number and user.jamb_number in existing_jamb:
                raise ValidationError("JAMB number already exists")

            username = usernames[i - 1]
            password = user.generate_password()

            user.username = username
            # Store temporary plain password for credential export and use the
            # faster temporary hasher so large batches import quickly. Students
            # are forced to change their password on first login.
            user.temporary_plain_password = password
            user.password = make_password(password, hasher='pbkdf2_sha256_temp')

            user.full_clean()

            users_to_create.append(user)
            existing_usernames.add(username)
            if user.matric_number:
                existing_matric.add(user.matric_number)
            if user.jamb_number:
                existing_jamb.add(user.jamb_number)

            group_name = user_type_by_group.get(user.user_type)
            if group_name:
                group_users.setdefault(group_name, []).append(user)

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
            errors.append(f"Row {i}: Validation error - {str(e)}")
            failed_rows.append(i)
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            failed_rows.append(i)

    # Bulk insert all valid users (skips per-row save() and post_save signals)
    batch_size = getattr(settings, 'BULK_CREATE_BATCH_SIZE', 500)
    with transaction.atomic():
        for start in range(0, len(users_to_create), batch_size):
            User.objects.bulk_create(users_to_create[start:start + batch_size])

    # Replicate the post_save group assignment (bulk_create bypasses signals)
    for group_name, members in group_users.items():
        try:
            group = Group.objects.get(name=group_name)
            group.user_set.add(*members)
        except Group.DoesNotExist:
            pass

    return {
        'total_rows': len(students_data),
        'successful': len(users_to_create),
        'failed': len(failed_rows),
        'errors': errors,
        'credentials': credentials
    }


@router.get("/bulk-upload/credentials/export/")
def export_credentials_csv(request):
    """Export student credentials as CSV for printing"""
    if not request.user.is_superuser:
        raise HttpError(403, "Admin access required")
    
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
    
    # Clear temporary plain passwords after export
    recent_students.update(temporary_plain_password=None)
    
    # Create HTTP response
    response = HttpResponse(
        output.getvalue(),
        content_type='text/csv'
    )
    response['Content-Disposition'] = f'attachment; filename="student_credentials_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
    
    return response
