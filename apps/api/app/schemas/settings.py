from typing import Literal

from pydantic import BaseModel


class TutorSettingsPayload(BaseModel):
    persona: Literal["friendly_coach", "strict_teacher", "conversation_buddy"]
    voice: str
    level: Literal["beginner", "elementary", "intermediate"]
    ui_language: Literal["ru"] = "ru"


class TutorSettingsResponse(TutorSettingsPayload):
    id: int | None = None
