from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings as app_settings
from app.models.user import TutorSettings
from app.schemas.settings import TutorSettingsPayload, TutorSettingsResponse


def _normalize_voice(voice: str | None) -> str:
    """Normalize stored voice to internal female/male."""
    if voice in ("female", "male"):
        return voice
    if voice and "Pon" in voice:
        return "male"
    return "female"


class TutorSettingsService:
    def get_by_user_id(self, db: Session, user_id: int) -> TutorSettingsResponse:
        settings = db.scalar(select(TutorSettings).where(TutorSettings.user_id == user_id))
        if not settings:
            return TutorSettingsResponse(
                id=None,
                persona="friendly_coach",
                level="elementary",
                voice="female",
                ui_language="ru",
            )
        return TutorSettingsResponse(
            id=settings.id,
            persona=settings.persona,
            voice=_normalize_voice(settings.voice),
            level=settings.level,
            ui_language=settings.ui_language,
        )

    def upsert(
        self, db: Session, user_id: int, payload: TutorSettingsPayload
    ) -> TutorSettingsResponse:
        settings = db.scalar(select(TutorSettings).where(TutorSettings.user_id == user_id))
        if not settings:
            settings = TutorSettings(user_id=user_id, **payload.model_dump())
            db.add(settings)
        else:
            settings.persona = payload.persona
            settings.voice = payload.voice
            settings.level = payload.level
            settings.ui_language = payload.ui_language

        db.commit()
        db.refresh(settings)

        return TutorSettingsResponse(
            id=settings.id,
            persona=settings.persona,
            voice=_normalize_voice(settings.voice),
            level=settings.level,
            ui_language=settings.ui_language,
        )
