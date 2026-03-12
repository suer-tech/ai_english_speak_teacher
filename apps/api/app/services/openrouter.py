import json
from textwrap import dedent

import httpx

from app.core.config import settings
from app.schemas.session import TutorReplyRequest, TutorReplyResponse


class OpenRouterClient:
    def __init__(self) -> None:
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"

    async def generate_tutor_reply(
        self, payload: TutorReplyRequest
    ) -> TutorReplyResponse:
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured")

        system_prompt = dedent(
            f"""
            You are an experienced English teacher at level {payload.settings.level}. Your goal is to help the user build their English speaking skills through natural dialogue.
            RULES:
            Always respond ONLY in English, even if the user writes in another language.
            Ask open-ended questions.            
            Use vocabulary and grammar at level {payload.settings.level} (A1-C2).
            Explain new words in English using simple synonyms, without translations.
            Persona: {payload.settings.persona}.
            Output must be a single valid JSON object and nothing else. Do not wrap in code fences. Do not add extra keys. Do not add commentary.
            """
        ).strip()

        user_prompt = dedent(
            f"""
            Learner: {payload.text}
            """
        ).strip()

        request_body = {
            "model": settings.openrouter_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "tutor_feedback",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "corrected_text": {"type": "string"},
                            "key_feedback": {"type": "string"},
                            "pronunciation_tip": {"type": "string"},
                            "tutor_reply": {"type": "string"},
                        },
                        "required": [
                            "corrected_text",
                            "key_feedback",
                            "pronunciation_tip",
                            "tutor_reply",
                        ],
                        "additionalProperties": False,
                    },
                },
            },
        }

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                content = await self._call_openrouter(request_body)
                parsed = self._parse_json_response(content)
                return TutorReplyResponse(**parsed)
            except Exception as exc:
                last_error = exc
                if attempt == 0:
                    continue
                raise

        raise ValueError("OpenRouter response could not be parsed") from last_error

    async def _call_openrouter(self, request_body: dict) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

    def _parse_json_response(self, content: str) -> dict:
        return json.loads(content)
