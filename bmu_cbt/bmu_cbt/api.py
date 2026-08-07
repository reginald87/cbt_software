from ninja import NinjaAPI
from users.api import router as users_router
from users.auth_api import router as auth_router
from exams.api import router as exams_router
from results.api import router as results_router
from audit.api import router as audit_router

api = NinjaAPI(
    title="BMU CBT API",
    description="REST API for Bayelsa Medical University Computer-Based Testing System",
    version="1.0.0",
)

# Register routers with prefixes
api.add_router("auth/", auth_router, tags=["Authentication"])
api.add_router("users/", users_router, tags=["Users"])
api.add_router("exams/", exams_router, tags=["Exams"])
api.add_router("results/", results_router, tags=["Results"])
api.add_router("audit/", audit_router, tags=["Audit"])
