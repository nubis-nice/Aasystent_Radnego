# Local dev (Windows 11) – Asystent Radnego

## Wymagania
- **Node.js** 20+ (u Ciebie jest 24.x OK)
- **Docker Desktop** (do Postgres + Redis)

## Start infrastruktury
```bash
docker compose -f infra/docker-compose.yml up -d
```

- Postgres: `localhost:5432` (DB: `aasystent_radnego`, user/pass: `aasystent`)
- Redis: `localhost:6379`
- Adminer: http://localhost:8080

## Instalacja zależności
W katalogu repo:
```bash
npm install
```

## Uruchomienie dev (frontend + api + worker)
```bash
npm run dev
```

### Endpointy
- API healthcheck: `GET http://localhost:3001/health`

## Debug w VS Code/Windsurf
W repo jest `.vscode/launch.json`:
- **API: debug (ts-node)**
- **Worker: debug (ts-node)**

## Najczęstsze problemy (Windows)
- Jeśli `docker` nie działa: upewnij się, że Docker Desktop jest uruchomiony.
- Jeśli porty są zajęte: zmień `API_PORT` w `.env` oraz mapowanie portów w `infra/docker-compose.yml`.
