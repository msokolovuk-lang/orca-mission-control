# Orca Gateway Adapter (B.2)

Интеграция B.2 подключает Mission Control к Orca gateway в режиме read-only (MC <- Orca) без изменения UI-панелей.

## Что поддерживается в B.2

- Синхронизация агентов из Orca в локальную SQLite Mission Control
- Синхронизация задач из Orca в локальную SQLite Mission Control
- Проверка доступности Orca через API-статус
- On-demand sync через API endpoint

## Ограничения B.2

- Только read-only путь (запись из MC в Orca не реализована)
- Синхронизируются только `agents` и `tasks`
- Не затрагиваются Brain, Teams, Coordinator, Pipelines
- WebSocket `/api/v1/ws` не используется

## Настройка переменных окружения

Добавьте в `.env`:

```env
ORCA_GATEWAY_URL=https://gateway-production-f602.up.railway.app
ORCA_GATEWAY_TOKEN=<ваш-bearer-токен>
ORCA_SYNC_INTERVAL_MS=30000
```

Для локальной разработки можно использовать:

```env
ORCA_GATEWAY_URL=http://localhost:8000
```

## Быстрый smoke-check Orca API

```bash
curl -sS -H "Authorization: Bearer $ORCA_GATEWAY_TOKEN" \
  "$ORCA_GATEWAY_URL/api/v1/agents"
```

## Проверка интеграции в Mission Control

```bash
# Orca connectivity
curl -sS http://127.0.0.1:3000/api/orca/status

# Принудительный sync (нужна авторизованная сессия MC)
curl -sS -X POST http://127.0.0.1:3000/api/orca/sync \
  -H "Cookie: $MC_SESSION_COOKIE"
```

## Roadmap

- B.2.1: write-path MC -> Orca (create/update/approve/cancel задач)
- B.3: расширенный sync (Brain, Teams, Coordinator, Pipelines)
- B.4: cleanup и унификация интеграционных панелей
