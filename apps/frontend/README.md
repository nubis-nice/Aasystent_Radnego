# ~~bez~~RADNY - Frontend

> Bo z nami radny nigdy nie jest *bez*radny.

Panel webowy dla radnych samorządowych do zarządzania dokumentami Rady Miejskiej i analizy treści z wykorzystaniem AI.

## Stack Technologiczny

- **Framework**: Next.js 15 (App Router)
- **Język**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: Lucide React, shadcn/ui
- **Auth**: Supabase Auth (OAuth Google + Email/Hasło)
- **State Management**: React Hooks + Context API
- **Kalendarz**: FullCalendar React

## Uruchomienie

```bash
npm run dev
```

Aplikacja dostępna na [http://localhost:3000](http://localhost:3000)

## Struktura Projektu

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Strony logowania (bez layoutu)
│   ├── dashboard/         # Pulpit główny
│   ├── documents/         # Moduł dokumentów
│   ├── chat/              # Czat z AI
│   ├── settings/          # Ustawienia użytkownika
│   └── admin/             # Panel administratora
├── components/
│   ├── ui/                # Komponenty bazowe (Button, Input)
│   ├── layout/            # Header, Sidebar
│   ├── auth/              # Formularze logowania
│   └── ...
├── lib/
│   └── supabase/          # Konfiguracja Supabase
└── types/                 # Typy TypeScript
```

## Funkcjonalności

### ✅ Zaimplementowane

- **Autentykacja**: OAuth Google, Email/Hasło, Reset hasła
- **Dashboard**: Pulpit z widgetami (kalendarz, statystyki, aktywność)
- **Dokumenty**: Lista dokumentów z filtrami, szczegóły, powiązania
- **Czat AI**: Stefan - asystent AI z cytowaniami i sugestiami
- **Kalendarz**: Widget kalendarza z przypomnieniami o wydarzeniach
- **Ustawienia**:
  - Profil użytkownika
  - **Konfiguracja API** (OpenAI, Ollama, lokalne modele)
  - Źródła danych (BIP, ISAP, RIO)
  - Powiadomienia
  - Wygląd (dark mode)
- **Panel Admina**: Zarządzanie użytkownikami
- **UI/UX**: Profesjonalny design, gradienty, animacje

## Konfiguracja

### Zmienne Środowiskowe

Utwórz plik `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Dokumentacja

- **Architektura**: `../../docs/architecture.md`
- **Plan budowy**: `../../docs/frontend_build_plan.md`
- **Struktura menu**: `../../docs/menu_structure.md`
- **Zarządzanie API**: `../../docs/api_management_design.md`
- **TODO**: `../../docs/todo.md`
- **Change Log**: `../../docs/change_log.md`

## Status Projektu

**Frontend**: ✅ Produkcyjny
**Backend**: ✅ Produkcyjny
**Deployment**: 🔧 Self-hosted / Local

---

**Licencja**: MIT
**Data aktualizacji**: 2026-01-25
