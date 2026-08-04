from ninja.security import HttpBearer
from ninja.errors import HttpError
from rest_framework_simplejwt.authentication import JWTAuthentication


class JWTAuth(HttpBearer):
    """Ninja security class that authenticates users via JWT (SimpleJWT)."""

    def authenticate(self, request, token):
        if not token:
            raise HttpError(401, "Authentication credentials were not provided")

        try:
            auth = JWTAuthentication()
            validated_token = auth.get_validated_token(token)
            user = auth.get_user(validated_token)
            # attach to request for downstream code
            request.user = user
            return user
        except Exception:
            raise HttpError(401, "Invalid or expired token")


def admin_required(request):
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        raise HttpError(401, "Authentication required")
    if not (user.is_staff or user.is_superuser):
        raise HttpError(403, "Admin/staff privileges required")
    return user
