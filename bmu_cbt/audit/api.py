import json

from ninja import Router, Query
from ninja.errors import HttpError
from pydantic import BaseModel
from typing import Optional

from audit.models import AuditLog
from utils.decorators import admin_required_ninja
from bmu_cbt.ninja_auth import JWTAuth

router = Router(auth=JWTAuth())


class AuditLogFilterSchema(BaseModel):
    action: Optional[str] = None
    username: Optional[str] = None
    search: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    limit: int = 50
    offset: int = 0


def _serialize(log: AuditLog) -> dict:
    details = None
    try:
        details = json.loads(log.details) if log.details else None
    except (ValueError, TypeError):
        details = log.details
    return {
        'id': log.id,
        'username': log.username,
        'action': log.action,
        'action_label': log.action_label,
        'model_name': log.model_name,
        'object_id': log.object_id,
        'details': details,
        'ip_address': log.ip_address,
        'user_agent': log.user_agent,
        'created_at': log.created_at.isoformat(),
    }


@router.get("/logs/", response=dict)
@admin_required_ninja
def list_audit_logs(request, filters: AuditLogFilterSchema = Query(...)):
    """Admin-only listing of audit log entries with filters and pagination."""
    qs = AuditLog.objects.all()

    if filters.action:
        qs = qs.filter(action=filters.action)
    if filters.username:
        qs = qs.filter(username__icontains=filters.username.strip())
    if filters.search:
        qs = qs.filter(action_label__icontains=filters.search.strip())
    if filters.start_date:
        qs = qs.filter(created_at__date__gte=filters.start_date)
    if filters.end_date:
        qs = qs.filter(created_at__date__lte=filters.end_date)

    filters.limit = max(1, min(filters.limit, 500))
    filters.offset = max(0, filters.offset)

    total = qs.count()
    logs = [_serialize(log) for log in qs[filters.offset:filters.offset + filters.limit]]

    return {
        'count': total,
        'limit': filters.limit,
        'offset': filters.offset,
        'logs': logs,
    }


@router.get("/actions/", response=list)
@admin_required_ninja
def list_audit_actions(request):
    """Distinct action codes available for filtering."""
    return [
        {'action': action, 'label': label}
        for action, label in AuditLog.objects.values_list('action', 'action_label').distinct()
    ]
