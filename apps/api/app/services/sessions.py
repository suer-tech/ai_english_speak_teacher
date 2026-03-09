import uuid

from app.schemas.session import (
    SessionCreateRequest,
    SessionCreateResponse,
    SpeechToTextResponse,
    TextToSpeechRequest,
    TextToSpeechResponse,
    TutorReplyRequest,
    TutorReplyResponse,
)
from app.services.openrouter import OpenRouterClient
from app.services.speech import SaluteSpeechClient


class SessionService:
    def __init__(self) -> None:
        self.openrouter_client = OpenRouterClient()
        self.speech_client = SaluteSpeechClient()

    def create_session(self, payload: SessionCreateRequest) -> SessionCreateResponse:
        return SessionCreateResponse(
            session_id=str(uuid.uuid4()),
            mode=payload.mode,
            status="created",
        )

    async def respond(self, payload: TutorReplyRequest) -> TutorReplyResponse:
        return await self.openrouter_client.generate_tutor_reply(payload)

    async def speech_to_text(
        self,
        audio_bytes: bytes,
        *,
        content_type: str,
        language: str = "en-US",
    ) -> SpeechToTextResponse:
        transcript = await self.speech_client.transcribe(
            audio_bytes,
            content_type=content_type,
            language=language,
        )
        return SpeechToTextResponse(transcript=transcript)

    async def text_to_speech(self, payload: TextToSpeechRequest) -> TextToSpeechResponse:
        result = await self.speech_client.synthesize(
            payload.text,
            voice=payload.voice,
            language=payload.language,
        )
        return TextToSpeechResponse(
            audio_base64=result.audio_base64,
            content_type=result.content_type,
            voice=result.voice,
        )
