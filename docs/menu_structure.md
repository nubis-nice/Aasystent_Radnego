# Struktura Menu - Asystent Radnego

## Przegląd

Aplikacja posiada profesjonalne menu boczne (sidebar) z hierarchiczną strukturą nawigacji, herbem Gminy Drawno oraz menu użytkownika z opcjami zarządzania kontem.

## Główne Menu (Sidebar)

### Sekcja nawigacyjna

1. **Pulpit** (`/dashboard`)

   - Strona główna po zalogowaniu
   - Podsumowanie aktywności
   - Karty statystyk (dokumenty, analizy, zapytania AI)
   - Ostatnia aktywność

2. **Dokumenty** (`/documents`)

   - Lista wszystkich dokumentów Rady Miejskiej
   - Filtry: typ, data, status
   - Wyszukiwanie
   - Paginacja
   - Podstrony:
     - `/documents/[id]` - Podgląd dokumentu
     - `/documents/upload` - Przesyłanie nowego dokumentu

3. **Czat AI** (`/chat`)

   - Interfejs czatu z AI
   - Q&A nad dokumentami
   - Cytaty i odniesienia do źródeł
   - Historia konwersacji

4. **Ustawienia** (`/settings`)
   - Główna strona ustawień z kafelkami
   - Podstrony:
     - `/settings/profile` - Profil użytkownika (dane osobowe, stanowisko)
     - `/settings/api` - **Konfiguracja API** (OpenAI, lokalne modele, szyfrowanie kluczy)
     - `/settings/notifications` - Powiadomienia (email, push)
     - `/settings/appearance` - Wygląd (motyw, czcionka)
     - `/settings/locale` - Język i region (placeholder)
     - `/settings/privacy` - Prywatność (placeholder)

### Sekcja administracyjna (tylko dla adminów)

5. **Panel Admina** (`/admin`)
   - Widoczny tylko dla użytkowników z rolą `admin`
   - Gradient fioletowy (odróżnienie od głównego menu)
   - Podstrony:
     - `/admin/users` - Zarządzanie użytkownikami
     - `/admin/users/new` - Dodawanie użytkownika (placeholder)
     - `/admin/users/[id]` - Edycja użytkownika (placeholder)

## Dolna sekcja Sidebar

### Herb Gminy Drawno

- Wyświetlany w dolnej części sidebar
- Plik: `/public/herb.png`
- Rozmiar: 64x64px
- Widoczny tylko gdy sidebar jest rozwinięty

### Menu użytkownika

- Avatar z inicjałami
- Imię i nazwisko
- Stanowisko (np. "Radny Miejski")
- Dropdown z opcjami:
  - **Mój profil** → `/settings/profile`
  - **Zmień hasło** → `/change-password`
  - **Wyloguj się** → wylogowanie i przekierowanie do `/login`

### Przycisk zwiń/rozwiń

- Ikona chevron (lewo/prawo)
- Tekst "Zwiń menu" (tylko gdy rozwinięte)
- Animacja transition 300ms

## Strony Auth (poza głównym layoutem)

### Grupa `(auth)`

- `/login` - Logowanie (OAuth Google + Email/Hasło)
- `/reset-password` - Żądanie resetu hasła
- `/change-password` - Zmiana hasła (wymuszenie lub reset)

## Responsywność

### Desktop (md+)

- Sidebar widoczny
- Szerokość: 288px (w-72) rozwinięty, 80px (w-20) zwinięty
- Sticky position

### Mobile (<md)

- Sidebar ukryty
- Header z hamburger menu (TODO: implementacja mobile drawer)
- Logo aplikacji w header

## Design System

### Kolory

- **Primary**: Niebieski gradient (#3b82f6 → #2563eb)
- **Secondary**: Szary (#64748b)
- **Admin**: Fioletowy gradient (#a855f7 → #9333ea)
- **Success**: Zielony (#10b981)
- **Warning**: Pomarańczowy (#f59e0b)
- **Danger**: Czerwony (#ef4444)

### Typografia

- Font: Inter (Google Fonts)
- Rozmiary: text-sm (menu), text-4xl (nagłówki)
- Wagi: font-semibold (przyciski), font-bold (nagłówki)

### Komponenty

- Zaokrąglenia: rounded-xl (12px)
- Cienie: shadow-md, shadow-lg
- Animacje: transition-all duration-200
- Hover: -translate-y-1, scale-110

## Struktura plików

```
apps/frontend/src/app/
├── (auth)/
│   ├── login/page.tsx
│   ├── reset-password/page.tsx
│   └── change-password/page.tsx
├── dashboard/
│   ├── layout.tsx (Header + Sidebar)
│   └── page.tsx
├── documents/
│   ├── layout.tsx (Header + Sidebar)
│   ├── page.tsx
│   ├── [id]/page.tsx (TODO)
│   └── upload/page.tsx (TODO)
├── chat/
│   ├── layout.tsx (Header + Sidebar)
│   └── page.tsx
├── settings/
│   ├── layout.tsx (Header + Sidebar)
│   ├── page.tsx
│   ├── profile/page.tsx
│   ├── api/page.tsx ✨ NOWE
│   ├── notifications/page.tsx
│   ├── appearance/page.tsx
│   ├── locale/page.tsx (TODO)
│   └── privacy/page.tsx (TODO)
└── admin/
    ├── layout.tsx
    └── users/
        ├── page.tsx
        ├── new/page.tsx (TODO)
        └── [id]/page.tsx (TODO)
```

## Komponenty

### Sidebar (`components/layout/sidebar.tsx`)

- Nawigacja główna
- Panel admina (warunkowy)
- Herb Drawna
- Menu użytkownika z dropdown
- Przycisk zwiń/rozwiń

### Header (`components/layout/header.tsx`)

- Logo mobilne
- Powiadomienia
- Avatar użytkownika

## System zarządzania API ✨

### Funkcjonalność (`/settings/api`)

**Zarządzanie kluczami API:**

- Obsługa wielu providerów: OpenAI, lokalne modele (Ollama, LM Studio), Azure, Anthropic
- Szyfrowanie kluczy API w bazie danych (AES-256-GCM)
- Test połączenia z API
- Automatyczne przełączanie między providerami (fail-over)
- Monitoring użycia i logowanie

**Bezpieczeństwo:**

- Klucze szyfrowane przed zapisem do bazy
- Klucz główny tylko w zmiennej środowiskowej
- HTTPS wymagane dla wszystkich połączeń
- Row Level Security (RLS) w Supabase

**Dokumentacja techniczna:**

- Pełny projekt w `docs/api_management_design.md`
- Schemat bazy danych, endpoints API, szyfrowanie
- Strategia fail-over i automatyki

## TODO - Kolejne kroki

### Krótkoterminowe

- [ ] Implementacja mobile drawer dla sidebar
- [ ] Strona `/documents/[id]` - podgląd dokumentu
- [ ] Strona `/documents/upload` - upload pliku
- [ ] Strona `/admin/users/new` - formularz dodawania użytkownika
- [ ] Strona `/admin/users/[id]` - formularz edycji użytkownika
- [ ] Guard dla `/admin` - sprawdzanie roli admina
- [ ] **Backend dla zarządzania API** - endpoints, szyfrowanie, baza danych

### Średnioterminowe

- [ ] Integracja z API backend (dokumenty, czat, użytkownicy)
- [ ] Rzeczywiste dane użytkownika z Supabase
- [ ] Implementacja dark mode
- [ ] Strony locale i privacy w settings

### Długoterminowe

- [ ] Moduł transkrypcji sesji rady
- [ ] Moduł scenopisów sesji
- [ ] Moduł raportów i analiz
- [ ] Moduł powiadomień real-time

## Zgodność z dokumentacją

Struktura menu jest zgodna z:

- `docs/user_management_design.md` - role użytkowników, panel admina
- `docs/frontend_build_plan.md` - struktura folderów, moduły
- `docs/architecture.md` - moduły aplikacji (dokumenty, czat, analizy)

---

**Status**: Struktura menu zaimplementowana i gotowa do użycia. Wszystkie główne strony utworzone jako placeholders z profesjonalnym designem.

**Data**: 2024-12-27
