"""Minimal helpers for recording audit log entries.

Audit logging must never break the main request flow, so every
helper swallows exceptions and simply does nothing on failure.
"""

import json


def _get_client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _get_user_agent(request):
    if request is None:
        return ''
    return (request.META.get('HTTP_USER_AGENT') or '')[:500]


def _resolve_user(request, user):
    if user is not None:
        return user
    candidate = getattr(request, 'user', None)
    if candidate is not None and getattr(candidate, 'is_authenticated', False):
        return candidate
    return None


def record_audit(request, action, label='', user=None, model_name='', object_id='', details=None):
    """Persist a single audit log entry. Never raises."""
    try:
        from .models import AuditLog

        resolved_user = _resolve_user(request, user)
        username = resolved_user.username if resolved_user is not None else 'anonymous'

        AuditLog.objects.create(
            user=resolved_user,
            username=username,
            action=action,
            action_label=label,
            model_name=model_name,
            object_id=str(object_id) if object_id not in (None, '') else '',
            details=json.dumps(details, default=str) if details is not None else '',
            ip_address=_get_client_ip(request),
            user_agent=_get_user_agent(request),
        )
    except Exception:
        pass
