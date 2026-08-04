from functools import wraps
from django.http import JsonResponse


def admin_required(view_func):
    """
    Decorator that requires the user to be a superuser (admin).
    Returns 403 JSON response if user is not an admin.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse(
                {'error': 'Authentication required'},
                status=401
            )

        if not request.user.is_superuser:
            return JsonResponse(
                {'error': 'Admin access required'},
                status=403
            )

        return view_func(request, *args, **kwargs)

    return wrapper


def admin_required_ninja(view_func):
    """
    Decorator for Django Ninja views that requires admin access.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        from ninja.errors import HttpError

        if not request.user.is_authenticated:
            raise HttpError(401, "Authentication required")

        if not request.user.is_superuser:
            raise HttpError(403, "Admin access required")

        return view_func(request, *args, **kwargs)

    return wrapper
