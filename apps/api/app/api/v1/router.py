from fastapi import APIRouter

from app.api.v1.routes import auth, sessions, settings


api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
