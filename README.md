# PromoApp – PWA do skanowania paragonów i śledzenia oszczędności

Aplikacja PWA (Mobile-First) odwracająca narrację tradycyjnych aplikacji budżetowych: zamiast skupiać się wyłącznie na wydatkach, eksponuje **kwotę zaoszczędzoną dzięki promocjom i rabatom** (np. wielosztuki 6+6, Moja Biedronka, Lidl Plus) w podziale na kategorie zakupowe.

## Stos technologiczny
- **Backend:** Node.js (ESM) + Express, PostgreSQL (`pg`, czysty SQL + transakcje `BEGIN`/`COMMIT`/`ROLLBACK`), `passport` + `passport-google-oauth20`, `express-session` + `connect-pg-simple` (30-dniowe sesje), `multer` (`memoryStorage`), `@google/genai` (`gemini-2.5-flash` z wymuszonym `responseSchema`).
- **Frontend:** React + Vite + Tailwind CSS + `vite-plugin-pwa` (Manifest + Service Worker) + `browser-image-compression` (kompresja zdjęć po stronie przeglądarki do max 1600px JPEG).

## Szybki start (lokalnie)

### 1. Baza danych PostgreSQL
Utwórz bazę danych i załaduj schemat:
```bash
createdb promo_app
psql -d promo_app -f server/db/schema.sql
```

### 2. Konfiguracja zmiennych środowiskowych
Skopiuj `.env.example` do `.env` i uzupełnij wartości:
```bash
cp .env.example .env
```
Wymagane klucze:
- `DATABASE_URL` – adres połączenia do PostgreSQL,
- `SESSION_SECRET` – losowy ciąg znaków (np. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`),
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` – z Google Cloud Console (Authorized redirect URI: `http://localhost:3001/api/auth/google/callback`),
- `GEMINI_API_KEY` – klucz API z Google AI Studio.

### 3. Instalacja zależności i uruchomienie
W dwóch terminalach:
```bash
# Terminal 1 – Backend (port 3001)
cd server && npm install && npm run dev

# Terminal 2 – Frontend PWA (port 5173 z proxy /api -> 3001)
cd client && npm install && npm run dev
```

Otwórz `http://localhost:5173`.

## Wdrożenie produkcyjne (Docker + CI/CD)

### Uruchomienie lokalne przez Docker Compose
```bash
cp .env.example .env # uzupełnij klucze Google OAuth, Gemini i SESSION_SECRET
docker compose up --build
```
PostgreSQL automatycznie załaduje `server/db/schema.sql`, a aplikacja PWA + API będzie dostępna pod `http://localhost:3001`.

### Pipeline GitHub Actions (`.github/workflows/ci.yml`)
Przy każdym `push` i `pull_request` do `main`:
1. **`server-check`** – sprawdza składnię JS, uruchamia testy jednostkowe (`node --test`) oraz weryfikuje idempotentność `server/db/schema.sql` na realnym kontenerze PostgreSQL 16.
2. **`client-build`** – buduje frontend PWA i sprawdza wygenerowanie `index.html`, `manifest.webmanifest` oraz `sw.js`.
3. **`docker-build-and-deploy`** – buduje wieloetapowy obraz `Dockerfile` (na `main` publikuje go w `ghcr.io/<owner>/<repo>:latest` oraz opcjonalnie wyzwala sekret `DEPLOY_HOOK_URL`, np. z Render lub Railway).

## Licencja
Projekt jest udostępniany na zasadach niekomercyjnych (**Source-Available / Non-Commercial**) – kod jest publiczny do użytku prywatnego i edukacyjnego, bez prawa do wykorzystania w celach zarobkowych. Szczegóły w pliku [LICENSE](./LICENSE).
