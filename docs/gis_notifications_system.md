# GIS (Global Information System) - System Powiadomień

## Przegląd

GIS to system globalnych powiadomień o nowościach z instytucji lokalnych i krajowych. Automatycznie informuje użytkowników o nowych dokumentach, alertach i ważnych wydarzeniach.

## Rozszerzone Typy Instytucji

### Nowe typy źródeł danych:

1. **`national_park`** - Parki narodowe

   - Drawieński Park Narodowy
   - Aktualności, wydarzenia, ochrona przyrody

2. **`hospital`** - Szpitale

   - Szpital Powiatowy w Drawsku
   - Godziny przyjęć, ogłoszenia, informacje

3. **`school`** - Szkoły

   - Szkoły w Gminie Drawno
   - Aktualności, wydarzenia, ogłoszenia

4. **`cultural`** - Instytucje kultury

   - Gminny Ośrodek Kultury
   - Biblioteka Publiczna
   - Wydarzenia, wystawy, koncerty

5. **`environmental`** - Ochrona środowiska

   - WIOŚ (Wojewódzki Inspektorat Ochrony Środowiska)
   - Raporty, kontrole, decyzje

6. **`transport`** - Transport publiczny

   - PKS - Rozkład jazdy
   - Zmiany w kursach, ogłoszenia

7. **`emergency`** - Służby ratunkowe
   - Straż Pożarna - OSP Drawno
   - Interwencje, szkolenia, apele

## Architektura GIS

### Komponenty Systemu

```
┌─────────────────────────────────────────────────────────┐
│              Nowy Dokument w Systemie                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         Trigger: notify_new_document                     │
│  - Sprawdza ustawienia użytkownika                      │
│  - Weryfikuje typ źródła                                │
│  - Sprawdza wyciszone źródła                            │
│  - Określa priorytet                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         Tworzenie Powiadomienia GIS                      │
│  - Tytuł: "Nowy dokument: [nazwa]"                      │
│  - Priorytet: urgent/high/normal/low                    │
│  - Metadata: źródło, typ, data                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Wysyłka Powiadomień                         │
│  ┌────────────┬────────────┬────────────┐              │
│  │   In-App   │   Email    │    Push    │              │
│  │ (natychm.) │ (digest)   │ (urgent)   │              │
│  └────────────┴────────────┴────────────┘              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         Użytkownik Odbiera Powiadomienie                 │
│  - Widzi w UI (dzwonek)                                 │
│  - Otrzymuje email (opcjonalnie)                        │
│  - Otrzymuje push (opcjonalnie)                         │
└─────────────────────────────────────────────────────────┘
```

## Tabele Bazy Danych

### 1. `gis_notifications`

Główna tabela powiadomień.

**Kolumny:**

- `id` - UUID
- `user_id` - Właściciel powiadomienia
- `source_id` - Źródło danych
- `document_id` - Powiązany dokument
- `notification_type` - Typ: new_document, update, alert, reminder, system
- `priority` - Priorytet: low, normal, high, urgent
- `title` - Tytuł powiadomienia
- `message` - Treść
- `action_url` - Link do akcji
- `metadata` - Dodatkowe dane (JSON)
- `read_at` - Kiedy przeczytane
- `dismissed_at` - Kiedy odrzucone
- `created_at` - Data utworzenia

### 2. `gis_notification_settings`

Ustawienia powiadomień użytkownika.

**Kolumny:**

- Email: `email_enabled`, `email_frequency`, `email_types`
- Push: `push_enabled`, `push_types`
- In-app: `inapp_enabled`
- Filtry: `enabled_source_types`, `muted_sources`
- Godziny ciszy: `quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end`

### 3. `gis_notification_logs`

Logi wysłanych powiadomień (audyt).

**Kolumny:**

- `notification_id` - ID powiadomienia
- `channel` - Kanał: email, push, inapp, sms
- `status` - Status: sent, failed, queued, skipped
- `error_message` - Komunikat błędu
- `sent_at` - Data wysłania

## Priorytety Powiadomień

### Automatyczne określanie priorytetu:

```sql
CASE
  WHEN source_type IN ('emergency', 'hospital') THEN 'urgent'
  WHEN source_type IN ('environmental', 'bip') THEN 'high'
  WHEN source_type IN ('municipality', 'national_park') THEN 'normal'
  ELSE 'low'
END
```

**Urgent (Pilne):**

- Służby ratunkowe (OSP, Straż)
- Szpitale (nagłe ogłoszenia)
- Alerty środowiskowe

**High (Wysokie):**

- BIP (uchwały, protokoły)
- Ochrona środowiska (decyzje WIOŚ)
- Transport (zmiany w rozkładzie)

**Normal (Normalne):**

- Gmina (aktualności)
- Parki narodowe
- Kultura (wydarzenia)

**Low (Niskie):**

- Szkoły (ogłoszenia)
- Biblioteka (nowości)

## Typy Powiadomień

### 1. `new_document` - Nowy dokument

**Przykład:**

```
Tytuł: "Nowy dokument: Uchwała Nr 15/2026"
Treść: "Dodano nowy dokument typu uchwała ze źródła BIP Drawno"
Priorytet: high
Akcja: /documents/[id]
```

### 2. `update` - Aktualizacja

**Przykład:**

```
Tytuł: "Zaktualizowano: Rozkład jazdy PKS"
Treść: "Zmieniono godziny kursów na linii Drawno-Szczecin"
Priorytet: normal
```

### 3. `alert` - Alert/Ostrzeżenie

**Przykład:**

```
Tytuł: "ALERT: Przekroczenie norm środowiskowych"
Treść: "WIOŚ wykrył przekroczenie norm w zakładzie XYZ"
Priorytet: urgent
```

### 4. `reminder` - Przypomnienie

**Przykład:**

```
Tytuł: "Przypomnienie: Sesja Rady Gminy jutro"
Treść: "Sesja Rady Gminy odbędzie się 10.01.2026 o 16:00"
Priorytet: high
```

### 5. `system` - System

**Przykład:**

```
Tytuł: "Nowe źródło danych dodane"
Treść: "Dodano Drawieński Park Narodowy do monitorowanych źródeł"
Priorytet: low
```

## Ustawienia Użytkownika

### Domyślne ustawienia dla nowych użytkowników:

```json
{
  "email_enabled": true,
  "email_frequency": "daily_digest",
  "email_types": ["new_document", "alert", "urgent"],

  "push_enabled": true,
  "push_types": ["alert", "urgent"],

  "inapp_enabled": true,

  "enabled_source_types": [
    "municipality",
    "bip",
    "hospital",
    "emergency",
    "environmental",
    "national_park"
  ],

  "quiet_hours_enabled": false,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "07:00"
}
```

### Częstotliwości email:

- **`immediate`** - Natychmiast po każdym powiadomieniu
- **`daily_digest`** - Jeden email dziennie (rano o 8:00)
- **`weekly_digest`** - Jeden email w tygodniu (poniedziałek 8:00)
- **`never`** - Brak powiadomień email

## Funkcje API

### 1. Pobieranie powiadomień

```typescript
GET /api/notifications
Query params:
  - unread_only: boolean
  - types: NotificationType[]
  - priorities: NotificationPriority[]
  - limit: number
  - offset: number

Response:
{
  notifications: GISNotification[],
  total: number,
  unread_count: number
}
```

### 2. Oznaczanie jako przeczytane

```typescript
POST /api/notifications/mark-read
Body:
{
  notification_ids?: string[] // Jeśli puste, oznacz wszystkie
}

Response:
{
  marked_count: number
}
```

### 3. Aktualizacja ustawień

```typescript
PUT / api / notifications / settings;
Body: UpdateNotificationSettingsRequest;

Response: GISNotificationSettings;
```

### 4. Statystyki

```typescript
GET /api/notifications/stats

Response:
{
  total: number,
  unread: number,
  by_type: Record<NotificationType, number>,
  by_priority: Record<NotificationPriority, number>,
  recent_count_24h: number
}
```

## UI Components

### 1. Dzwonek powiadomień (Header)

```tsx
<NotificationBell unreadCount={5} onClick={() => setShowPanel(true)} />
```

### 2. Panel powiadomień

```tsx
<NotificationPanel>
  <NotificationList
    notifications={notifications}
    onMarkAsRead={handleMarkAsRead}
    onDismiss={handleDismiss}
  />
</NotificationPanel>
```

### 3. Ustawienia powiadomień

```tsx
<NotificationSettings settings={settings} onUpdate={handleUpdate} />
```

## Przykłady Użycia

### Przykład 1: Nowy dokument z BIP

```
1. Scraper pobiera nową uchwałę z BIP Drawno
2. Dokument jest przetwarzany i zapisywany
3. Trigger notify_new_document uruchamia się
4. Sprawdza ustawienia użytkownika:
   - inapp_enabled: true ✓
   - 'bip' w enabled_source_types ✓
   - BIP nie jest w muted_sources ✓
5. Tworzy powiadomienie:
   - Typ: new_document
   - Priorytet: high (BIP)
   - Tytuł: "Nowy dokument: Uchwała Nr 15/2026"
6. Zapisuje log: channel=inapp, status=sent
7. Użytkownik widzi powiadomienie w UI
```

### Przykład 2: Alert z WIOŚ

```
1. Scraper pobiera raport WIOŚ o przekroczeniu norm
2. Dokument klasyfikowany jako 'alert'
3. Trigger tworzy powiadomienie:
   - Typ: alert
   - Priorytet: urgent (environmental)
   - Tytuł: "ALERT: Przekroczenie norm środowiskowych"
4. Wysyłka:
   - In-app: natychmiast ✓
   - Push: natychmiast ✓ (urgent w push_types)
   - Email: w daily_digest (alert w email_types)
5. Użytkownik otrzymuje:
   - Powiadomienie push na telefon
   - Czerwony badge w aplikacji
   - Email następnego dnia o 8:00
```

### Przykład 3: Wyciszenie źródła

```
1. Użytkownik wycisza "Biblioteka Publiczna"
2. Dodaje ID źródła do muted_sources
3. Nowy dokument z biblioteki:
   - Trigger sprawdza: biblioteka w muted_sources ✗
   - Powiadomienie NIE jest tworzone
4. Użytkownik nie otrzymuje powiadomień z biblioteki
```

## Godziny Ciszy

Jeśli `quiet_hours_enabled = true`:

```typescript
const now = new Date();
const currentTime = now.getHours() * 60 + now.getMinutes();
const startTime = parseTime(settings.quiet_hours_start); // 22:00 = 1320
const endTime = parseTime(settings.quiet_hours_end); // 07:00 = 420

if (currentTime >= startTime || currentTime < endTime) {
  // Godziny ciszy - nie wysyłaj email/push
  // In-app powiadomienia są nadal tworzone (ciche)
}
```

## Czyszczenie Starych Powiadomień

Automatyczne czyszczenie co tydzień (cron):

```sql
DELETE FROM gis_notifications
WHERE created_at < NOW() - INTERVAL '90 days'
  AND (read_at IS NOT NULL OR dismissed_at IS NOT NULL);
```

Usuwa powiadomienia starsze niż 90 dni, które zostały przeczytane lub odrzucone.

## Metryki i Monitoring

### KPI:

- Liczba powiadomień/dzień
- Wskaźnik przeczytanych (%)
- Średni czas do przeczytania
- Najpopularniejsze typy źródeł
- Wskaźnik wyciszonych źródeł

### Alerty:

- Błąd wysyłki email > 10%
- Nieprzeczytane powiadomienia > 100
- Brak powiadomień > 7 dni (problem ze scrapingiem)

## Bezpieczeństwo

### RLS (Row Level Security):

- Użytkownik widzi tylko swoje powiadomienia
- Użytkownik może edytować tylko swoje ustawienia
- Logi są dostępne tylko dla właściciela

### Prywatność:

- Powiadomienia email zawierają tylko tytuł (nie treść)
- Push notifications zawierają minimalną informację
- Pełna treść tylko w aplikacji (po zalogowaniu)

## Roadmap

### Faza 1 (MVP) - 1 tydzień

- ✅ Schemat bazy danych
- ✅ Triggery i funkcje
- ✅ Typy TypeScript
- ⏳ Backend API
- ⏳ Frontend UI (dzwonek, panel)

### Faza 2 - 1 tydzień

- ⏳ Email digest (daily/weekly)
- ⏳ Push notifications (Web Push API)
- ⏳ Ustawienia powiadomień w UI
- ⏳ Statystyki

### Faza 3 - 1 tydzień

- ⏳ Zaawansowane filtry
- ⏳ Grupowanie powiadomień
- ⏳ Akcje masowe (oznacz wszystkie jako przeczytane)
- ⏳ Eksport historii

### Faza 4 - Przyszłość

- ⏳ SMS notifications
- ⏳ Integracja z kalendarzem (przypomnienia o sesjach)
- ⏳ AI podsumowania (digest z AI)
- ⏳ Personalizacja (ML recommendations)

## Podsumowanie

GIS (Global Information System) to kompleksowy system powiadomień, który:

✅ **Automatycznie monitoruje** 13 typów instytucji  
✅ **Inteligentnie priorytetyzuje** powiadomienia  
✅ **Respektuje preferencje** użytkownika  
✅ **Wysyła przez 3 kanały** (in-app, email, push)  
✅ **Zapewnia pełną kontrolę** nad powiadomieniami  
✅ **Loguje wszystko** dla audytu  
✅ **Automatycznie czyści** stare dane

**Użytkownik zawsze wie co się dzieje w jego gminie!** 🔔
