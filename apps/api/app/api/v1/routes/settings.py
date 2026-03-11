from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user_id, get_database_session
from app.schemas.settings import TutorSettingsPayload, TutorSettingsResponse
from app.services.settings import TutorSettingsService


router = APIRouter()
settings_service = TutorSettingsService()


@router.get("/tutor", response_model=TutorSettingsResponse)
def get_tutor_settings(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_database_session),
):
    return settings_service.get_by_user_id(db, user_id)


@router.put("/tutor", response_model=TutorSettingsResponse)
def upsert_tutor_settings(
    payload: TutorSettingsPayload,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_database_session),
):
    return settings_service.upsert(db, user_id, payload)
