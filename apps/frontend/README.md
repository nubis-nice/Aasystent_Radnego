# Asystent Radnego - Frontend

Panel webowy dla Radnych Miejskich Gminy Drawno do zarządzania dokumentami Rady Miejskiej i analizy treści z wykorzystaniem AI.

## Stack Technologiczny

- **Framework**: Next.js 16 (App Router)
- **Język**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: Lucide React Icons
- **Auth**: Supabase Auth (OAuth Google + Email/Hasło)
- **State Management**: React Hooks (useState, useEffect)

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
- **Dashboard**: Pulpit z kartami statystyk i aktywnością
- **Dokumenty**: Lista dokumentów z filtrami (placeholder)
- **Czat AI**: Interfejs czatu z cytatami (placeholder)
- **Ustawienia**:
  - Profil użytkownika
  - **Konfiguracja API** (OpenAI, lokalne modele)
  - Powiadomienia
  - Wygląd
  - Język i region
  - Prywatność
- **Panel Admina**: Zarządzanie użytkownikami (placeholder)
- **UI/UX**: Profesjonalny design, gradienty, animacje

### 🚧 W Trakcie Implementacji

- Integracja z backend API
- Upload dokumentów
- Podgląd szczegółów dokumentu
- Rzeczywisty czat z AI
- Dark mode

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

**Frontend**: ✅ Gotowy do użycia (MVP)
**Backend**: 🚧 W przygotowaniu
**Deployment**: 🔧 Local development

---

**Data**: 2024-12-27
