from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.schemas.session import (
    SessionCreateRequest,
    SessionCreateResponse,
    SpeechToTextResponse,
    TextToSpeechRequest,
    TextToSpeechResponse,
    TutorReplyRequest,
    TutorReplyResponse,
)
from app.services.sessions import SessionService


router = APIRouter()
session_service = SessionService()


@router.post("", response_model=SessionCreateResponse)
def create_session(payload: SessionCreateRequest):
    return session_service.create_session(payload)


@router.post("/respond", response_model=TutorReplyResponse)
async def respond(payload: TutorReplyRequest):
    return await session_service.respond(payload)


@router.post("/stt", response_model=SpeechToTextResponse)
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Query(default="en-US"),
):
    try:
        audio_bytes = await audio.read()
        return await session_service.speech_to_text(
            audio_bytes,
            content_type=audio.content_type or "audio/wav",
            language=language,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.post("/tts", response_model=TextToSpeechResponse)
async def text_to_speech(payload: TextToSpeechRequest):
    try:
        return await session_service.text_to_speech(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
