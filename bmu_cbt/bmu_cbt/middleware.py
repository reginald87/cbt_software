"""
Middleware that keeps ALLOWED_HOSTS in sync with the laptop's current IPs.

The exam laptop is moved between networks, so its LAN IP can change without
the Django process restarting. Whenever a request arrives with a Host header
that is not currently allowed, we recompute the machine's IPv4 addresses
(cached briefly, so we do not shell out to ipconfig on every request) and
whitelist them. This stops students getting HTTP 400 "Invalid HTTP_HOST
header" errors when the server's IP changes mid-day.
"""
import time

from django.conf import settings

_lan_ip_cache = []
_lan_ip_cache_time = 0.0
_LAN_IP_CACHE_TTL = 15  # seconds


def _current_lan_ips():
    from bmu_cbt.settings import _get_lan_ipv4_addresses

    global _lan_ip_cache, _lan_ip_cache_time
    now = time.time()
    if not _lan_ip_cache or now - _lan_ip_cache_time > _LAN_IP_CACHE_TTL:
        _lan_ip_cache = _get_lan_ipv4_addresses()
        _lan_ip_cache_time = now
    return _lan_ip_cache


class DynamicHostMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        host = (request.META.get('HTTP_HOST') or '').split(':')[0].lower()
        if host and host not in settings.ALLOWED_HOSTS:
            for ip in _current_lan_ips():
                if ip not in settings.ALLOWED_HOSTS:
                    settings.ALLOWED_HOSTS.append(ip)
        return self.get_response(request)
