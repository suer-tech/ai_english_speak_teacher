# SpeakAI

Веб-приложение для разговорной практики английского с AI-преподавателем.

<img width="1286" height="935" alt="image" src="https://github.com/user-attachments/assets/c90c737b-1372-4819-a71f-2951b7a797fb" />


Приложение позволяет:

- зарегистрироваться и войти в аккаунт
- выбрать голос и мнеру общения преподавателя
- выбрать свой уровень владения языком
- говорить и получать голосовой ответ от AI

Текущий стек:

- `Vite` + `React` — frontend
- `FastAPI` — backend
- `SQLite` — локальная база
- `SaluteSpeech` — распознавание и синтез речи
- `OpenRouter` — генерация ответов преподавателя

## Структура проекта

- `apps/frontend` — frontend
- `apps/api` — backend
- `docs` — документация
- `scripts` — скрипты запуска

## Что нужно для запуска

- `Python 3.11+`
- `Node.js`
- настроенный файл `apps/api/.env`

Минимально важные переменные:

- `SALUTE_SPEECH_API_KEY`
- `OPENROUTER_API_KEY` — желательно для реальных ответов AI
- `VITE_API_BASE_URL` в `apps/frontend/.env`

Рекомендуемое значение для frontend:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## Локальный запуск

### Backend

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```powershell
cd apps/frontend
npm install
npm run dev
```

После запуска:

- frontend: `http://127.0.0.1:3000`
- api: `http://127.0.0.1:8000`

## Запуск одной командой

### Для локальной разработки

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Остановка:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-local.ps1
```

### Для запуска на сервере

Сборка frontend и запуск frontend + backend на внешних интерфейсах:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-server.ps1
```

Запуск серверного режима с dev-frontend:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-server.ps1 -UseDevFrontend
```

## Проверка работы

1. Откройте приложение в браузере.
2. Зарегистрируйтесь или войдите.
3. Разрешите доступ к микрофону.
4. Перейдите на экран сессии.
5. Нажмите и удерживайте кнопку записи.
6. Скажите фразу на английском.
7. Отпустите кнопку и дождитесь голосового ответа.

## Примечание

Текущая версия уже использует:

- streaming STT с fallback
- streaming TTS с fallback
- `AudioWorklet`
- `16 kHz PCM16`
- базовый VAD для улучшения voice UX
