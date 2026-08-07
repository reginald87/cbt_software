"""
Authentication API endpoints for BMU CBT System
Handles login, logout, token refresh, and user profile
"""
from ninja import Router
from django.contrib.auth import authenticate
from pydantic import BaseModel
from typing import Optional
from datetime import timedelta
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from users.models import User, UserSession
from users.ip_security import get_client_ip, log_user_session
from audit.logger import record_audit

router = Router()


# ==================== Schemas ====================

class LoginSchema(BaseModel):
    username: str
    password: str


class TokenResponseSchema(BaseModel):
    access: str
    refresh: str
    user_id: int
    username: str
    email: str
    full_name: str
    user_type: str
    profile_picture: Optional[str] = None


class UserProfileSchema(BaseModel):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    user_type: str
    department: Optional[str] = None
    matric_number: Optional[str] = None
    jamb_number: Optional[str] = None
    profile_picture: Optional[str] = None
    is_active: bool
    date_joined: str


class ChangePasswordSchema(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str


# ==================== Helper Functions ====================

def get_tokens_for_user(user):
    """Generate JWT tokens for a user"""
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }


def get_authenticated_user(request):
    """Authenticate request via Bearer token and return the user."""
    from ninja.errors import HttpError
    from rest_framework_simplejwt.authentication import JWTAuthentication
    from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HttpError(401, "Authentication required")

    jwt_auth = JWTAuthentication()
    try:
        validated_token = jwt_auth.get_validated_token(auth_header.split(' ')[1])
        user = jwt_auth.get_user(validated_token)
        request.user = user
        return user
    except (InvalidToken, AuthenticationFailed):
        raise HttpError(401, "Authentication required")


# ==================== Endpoints ====================

@router.post("/login/")
def login(request, payload: LoginSchema):
    """
    Login endpoint - accepts username and password
    Returns JWT access and refresh tokens
    """
    from ninja.errors import HttpError
    
    user = authenticate(username=payload.username, password=payload.password)
    
    if not user:
        record_audit(
            request,
            'auth.login_failed',
            label=f"Failed login attempt for '{payload.username}'",
            details={'username': payload.username},
        )
        raise HttpError(401, "Invalid username or password")
    
    if not user.is_active:
        record_audit(
            request,
            'auth.login_failed',
            label=f"Disabled account login attempt for '{payload.username}'",
            user=user,
            details={'username': payload.username},
        )
        raise HttpError(403, "User account is disabled")
    
    # Generate tokens
    tokens = get_tokens_for_user(user)
    
    # Log the session (temporarily disabled for testing)
    # log_user_session(user, request)
    
    profile_picture_url = None
    if user.profile_picture:
        profile_picture_url = user.profile_picture.url

    record_audit(
        request,
        'auth.login',
        label=f"User '{user.username}' logged in",
        user=user,
        model_name='User',
        object_id=user.id,
        details={'user_type': user.user_type},
    )
    
    return {
        "access": tokens['access'],
        "refresh": tokens['refresh'],
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": f"{user.first_name} {user.last_name}".strip(),
        "user_type": user.user_type,
        "profile_picture": profile_picture_url,
        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,
        "must_change_password": bool(user.temporary_password or user.is_first_login),
    }


@router.post("/refresh/")
def refresh_token(request):
    """
    Refresh access token using refresh token
    Request should include refresh token in Authorization header
    """
    from ninja.errors import HttpError
    
    auth_header = request.headers.get('Authorization', '')
    
    if not auth_header.startswith('Bearer '):
        raise HttpError(401, "Invalid authorization header")
    
    refresh_token_str = auth_header.split(' ')[1]
    
    try:
        refresh = RefreshToken(refresh_token_str)
        access_token = str(refresh.access_token)
        return {"access": access_token}
    except Exception as e:
        raise HttpError(401, "Invalid or expired refresh token")


@router.get("/profile/")
def get_profile(request):
    """Get current user's profile"""
    user = get_authenticated_user(request)
    
    profile_picture_url = None
    if user.profile_picture:
        profile_picture_url = user.profile_picture.url
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "user_type": user.user_type,
        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,
        "department": user.department,
        "matric_number": user.matric_number,
        "jamb_number": user.jamb_number,
        "profile_picture": profile_picture_url,
        "is_active": user.is_active,
        "date_joined": user.date_joined.isoformat(),
        "must_change_password": bool(user.temporary_password or user.is_first_login),
    }


@router.post("/change-password/")
def change_password(request, payload: ChangePasswordSchema):
    """Change user's password"""
    from ninja.errors import HttpError
    
    user = get_authenticated_user(request)
    
    if payload.new_password != payload.confirm_password:
        raise HttpError(400, "New passwords do not match")
    
    if len(payload.new_password) < 8:
        raise HttpError(400, "Password must be at least 8 characters")
    
    if not user.check_password(payload.old_password):
        raise HttpError(400, "Current password is incorrect")
    
    user.set_password(payload.new_password)
    user.temporary_password = False
    user.is_first_login = False
    user.temporary_plain_password = None
    user.save()

    record_audit(
        request,
        'auth.change_password',
        label=f"User '{user.username}' changed their password",
        user=user,
        model_name='User',
        object_id=user.id,
    )
    
    # Invalidate all existing sessions
    UserSession.objects.filter(
        user=user,
        is_active=True,
        logout_time__isnull=True
    ).update(is_active=False, logout_time=timezone.now())
    
    return {
        "message": "Password changed successfully. Please login again."
    }


@router.post("/logout/")
def logout(request):
    """Logout - mark user session as closed"""
    user = get_authenticated_user(request)
    
    # Attempt to read refresh token from Authorization header or query/body
    auth_header = request.headers.get('Authorization', '')
    refresh_token_str = None

    if auth_header.startswith('Bearer '):
        refresh_token_str = auth_header.split(' ')[1]

    # fallback to GET param or JSON body if present
    if not refresh_token_str:
        refresh_token_str = request.GET.get('refresh') or getattr(request, 'data', None) and request.data.get('refresh')

    # Blacklist the provided refresh token (if valid) so it cannot be reused
    if refresh_token_str:
        try:
            refresh = RefreshToken(refresh_token_str)
            # blacklist() requires `rest_framework_simplejwt.token_blacklist` app
            refresh.blacklist()
        except Exception:
            # ignore invalid/expired tokens - still proceed to close session
            pass

    # Mark session record as closed (if present)
    session_key = request.session.session_key
    if session_key:
        UserSession.objects.filter(
            user=user,
            session_key=session_key
        ).update(is_active=False, logout_time=timezone.now())

    record_audit(
        request,
        'auth.logout',
        label=f"User '{user.username}' logged out",
        user=user,
        model_name='User',
        object_id=user.id,
    )

    return {"message": "Logged out successfully"}


@router.post("/username-available/")
def check_username_available(request):
    """Check if a username is available (for frontend validation)"""
    username = request.GET.get('username', '')
    
    if not username or len(username) < 3:
        return {"available": False, "message": "Username must be at least 3 characters"}
    
    exists = User.objects.filter(username=username).exists()
    
    return {
        "available": not exists,
        "username": username,
        "message": "Username is available" if not exists else "Username is already taken"
    }
