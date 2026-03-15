from typing import Literal

from pydantic import BaseModel

from app.schemas.settings import TutorSettingsPayload


class SessionCreateRequest(BaseModel):
    mode: Literal["speaking"] = "speaking"


class SessionCreateResponse(BaseModel):
    session_id: str
    mode: str
    status: str


class TutorReplyRequest(BaseModel):
    text: str
    settings: TutorSettingsPayload


class TutorReplyResponse(BaseModel):
    corrected_text: str
    key_feedback: str
    pronunciation_tip: str | None = None
    tutor_reply: str


class SpeechToTextResponse(BaseModel):
    transcript: str
    provider: str = "salute_speech"


class TextToSpeechRequest(BaseModel):
    text: str
    voice: str | None = None
    language: Literal["en", "ru"] = "en"


class TextToSpeechResponse(BaseModel):
    audio_base64: str
    content_type: str
    voice: str
    provider: str = "salute_speech"
