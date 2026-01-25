/**
 * Testy E2E dla systemu powiadomień kalendarza
 * Symuluje pełny flow: tworzenie wydarzenia → powiadomienie → dismiss
 *
 * Uruchom: npx tsx src/services/__tests__/calendar-notifications-e2e.test.ts
 */

import { performance } from "perf_hooks";

// ============================================================================
// MOCK DATABASE & API
// ============================================================================

interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  event_type:
    | "session"
    | "committee"
    | "meeting"
    | "deadline"
    | "reminder"
    | "other";
  start_date: string;
  end_date?: string;
  all_day: boolean;
  location?: string;
  reminder_minutes: number[];
  color: string;
  created_at: string;
}

interface CalendarNotification {
  id: string;
  event_id: string;
  title: string;
  event_type: string;
  start_date: string;
  location?: string;
  minutes_until_event: number;
  reminder_type: "day" | "hour" | "minutes";
  reminder_minutes: number;
}

// In-memory database
const mockDatabase: {
  events: CalendarEvent[];
  dismissedNotifications: Set<string>;
} = {
  events: [],
  dismissedNotifications: new Set(),
};

// ============================================================================
// MOCK API ENDPOINTS
// ============================================================================

function resetDatabase() {
  mockDatabase.events = [];
  mockDatabase.dismissedNotifications.clear();
}

// POST /api/dashboard/calendar - Tworzenie wydarzenia
function createEvent(
  userId: string,
  eventData: Partial<CalendarEvent>,
): CalendarEvent {
  const event: CalendarEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId,
    title: eventData.title || "Untitled Event",
    description: eventData.description,
    event_type: eventData.event_type || "other",
    start_date: eventData.start_date || new Date().toISOString(),
    end_date: eventData.end_date,
    all_day: eventData.all_day || false,
    location: eventData.location,
    reminder_minutes: eventData.reminder_minutes || [1440, 60],
    color: eventData.color || "primary",
    created_at: new Date().toISOString(),
  };

  mockDatabase.events.push(event);
  return event;
}

// GET /api/dashboard/notifications/upcoming - Pobieranie powiadomień
function getUpcomingNotifications(
  userId: string,
  now: Date,
): {
  notifications: CalendarNotification[];
  count: number;
  checked_at: string;
} {
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Filtruj wydarzenia użytkownika w zakresie 24h
  const userEvents = mockDatabase.events.filter(
    (e) =>
      e.user_id === userId &&
      new Date(e.start_date) >= now &&
      new Date(e.start_date) <= next24h,
  );

  const notifications: CalendarNotification[] = [];

  for (const event of userEvents) {
    const eventStart = new Date(event.start_date);
    const reminderMinutes = event.reminder_minutes || [60];

    for (const minutes of reminderMinutes) {
      const reminderTime = new Date(eventStart.getTime() - minutes * 60 * 1000);
      const minutesUntilReminder =
        (reminderTime.getTime() - now.getTime()) / (60 * 1000);

      // Przypomnienie w ciągu następnych 5 minut lub już minęło (ale max 30 min temu)
      if (minutesUntilReminder <= 5 && minutesUntilReminder >= -30) {
        const notificationId = `${event.id}-${minutes}`;

        // Sprawdź czy nie jest dismissed
        if (!mockDatabase.dismissedNotifications.has(notificationId)) {
          const minutesUntilEvent =
            (eventStart.getTime() - now.getTime()) / (60 * 1000);
          notifications.push({
            id: notificationId,
            event_id: event.id,
            title: event.title,
            event_type: event.event_type,
            start_date: event.start_date,
            location: event.location,
            minutes_until_event: Math.round(minutesUntilEvent),
            reminder_type:
              minutes >= 1440 ? "day" : minutes >= 60 ? "hour" : "minutes",
            reminder_minutes: minutes,
          });
        }
      }
    }
  }

  return {
    notifications,
    count: notifications.length,
    checked_at: now.toISOString(),
  };
}

// POST /api/dashboard/notifications/:id/dismiss - Odrzucenie powiadomienia
function dismissNotification(notificationId: string): {
  dismissed: boolean;
  id: string;
} {
  mockDatabase.dismissedNotifications.add(notificationId);
  return { dismissed: true, id: notificationId };
}

// DELETE /api/dashboard/calendar/:id - Usunięcie wydarzenia
function deleteEvent(userId: string, eventId: string): boolean {
  const index = mockDatabase.events.findIndex(
    (e) => e.id === eventId && e.user_id === userId,
  );

  if (index !== -1) {
    mockDatabase.events.splice(index, 1);
    return true;
  }
  return false;
}

// ============================================================================
// TEST FRAMEWORK
// ============================================================================

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.log(
      `     Error: ${error instanceof Error ? error.message : error}`,
    );
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message || "Assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || "Expected true but got false");
  }
}

// ============================================================================
// E2E TESTS
// ============================================================================

async function runE2ETests() {
  console.log("\n🔄 E2E TEST 1: Pełny cykl życia powiadomienia\n");

  resetDatabase();

  await test("1.1 Utworzenie wydarzenia za 1 godzinę", () => {
    const eventTime = new Date(Date.now() + 60 * 60 * 1000);

    const event = createEvent("user-e2e-1", {
      title: "Spotkanie z mieszkańcami",
      event_type: "meeting",
      start_date: eventTime.toISOString(),
      location: "Urząd Gminy, sala 101",
      reminder_minutes: [60, 15],
    });

    assertTrue(event.id.startsWith("evt-"));
    assertEqual(event.title, "Spotkanie z mieszkańcami");
    assertEqual(mockDatabase.events.length, 1);
  });

  await test("1.2 Powiadomienie pojawia się 1h przed wydarzeniem", () => {
    const now = new Date(Date.now()); // Teraz = 1h przed wydarzeniem

    const response = getUpcomingNotifications("user-e2e-1", now);

    assertEqual(response.count, 1);
    assertEqual(response.notifications[0].title, "Spotkanie z mieszkańcami");
    assertEqual(response.notifications[0].reminder_type, "hour");
    assertEqual(response.notifications[0].location, "Urząd Gminy, sala 101");
  });

  await test("1.3 Dismiss powiadomienia", () => {
    const response = getUpcomingNotifications("user-e2e-1", new Date());
    const notificationId = response.notifications[0].id;

    const dismissResult = dismissNotification(notificationId);
    assertTrue(dismissResult.dismissed);

    // Po dismiss powiadomienie nie powinno się pojawiać
    const afterDismiss = getUpcomingNotifications("user-e2e-1", new Date());
    assertEqual(afterDismiss.count, 0);
  });

  console.log("\n🔄 E2E TEST 2: Wiele wydarzeń w jednym dniu\n");

  resetDatabase();

  await test("2.1 Utworzenie 3 wydarzeń", () => {
    const baseTime = new Date();

    // Wydarzenie za 1h
    createEvent("user-e2e-2", {
      title: "Sesja Rady",
      event_type: "session",
      start_date: new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString(),
      reminder_minutes: [60],
    });

    // Wydarzenie za 2h
    createEvent("user-e2e-2", {
      title: "Komisja Budżetowa",
      event_type: "committee",
      start_date: new Date(
        baseTime.getTime() + 2 * 60 * 60 * 1000,
      ).toISOString(),
      reminder_minutes: [60],
    });

    // Wydarzenie za 5h (poza zakresem przypomnienia)
    createEvent("user-e2e-2", {
      title: "Spotkanie wieczorne",
      event_type: "meeting",
      start_date: new Date(
        baseTime.getTime() + 5 * 60 * 60 * 1000,
      ).toISOString(),
      reminder_minutes: [60],
    });

    assertEqual(mockDatabase.events.length, 3);
  });

  await test("2.2 Tylko najbliższe wydarzenie generuje powiadomienie", () => {
    const response = getUpcomingNotifications("user-e2e-2", new Date());

    // Tylko "Sesja Rady" (za 1h) powinna mieć aktywne powiadomienie
    assertEqual(response.count, 1);
    assertEqual(response.notifications[0].title, "Sesja Rady");
  });

  console.log("\n🔄 E2E TEST 3: Izolacja użytkowników\n");

  resetDatabase();

  await test("3.1 Różni użytkownicy nie widzą swoich powiadomień", () => {
    const eventTime = new Date(Date.now() + 60 * 60 * 1000);

    createEvent("user-A", {
      title: "Spotkanie użytkownika A",
      event_type: "meeting",
      start_date: eventTime.toISOString(),
      reminder_minutes: [60],
    });

    createEvent("user-B", {
      title: "Spotkanie użytkownika B",
      event_type: "meeting",
      start_date: eventTime.toISOString(),
      reminder_minutes: [60],
    });

    const responseA = getUpcomingNotifications("user-A", new Date());
    const responseB = getUpcomingNotifications("user-B", new Date());

    assertEqual(responseA.count, 1);
    assertEqual(responseA.notifications[0].title, "Spotkanie użytkownika A");

    assertEqual(responseB.count, 1);
    assertEqual(responseB.notifications[0].title, "Spotkanie użytkownika B");
  });

  console.log("\n🔄 E2E TEST 4: Przypomnienie 24h przed (dzień wcześniej)\n");

  resetDatabase();

  await test("4.1 Powiadomienie dzień przed wydarzeniem", () => {
    // Wydarzenie jutro o tej samej porze
    const eventTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    createEvent("user-e2e-4", {
      title: "Ważna Sesja Rady",
      event_type: "session",
      start_date: eventTime.toISOString(),
      reminder_minutes: [1440], // 24h = 1440 min
    });

    const response = getUpcomingNotifications("user-e2e-4", new Date());

    assertEqual(response.count, 1);
    assertEqual(response.notifications[0].reminder_type, "day");
    assertTrue(response.notifications[0].minutes_until_event >= 1430); // ~24h
  });

  console.log("\n🔄 E2E TEST 5: Usunięcie wydarzenia\n");

  resetDatabase();

  await test("5.1 Usunięcie wydarzenia usuwa powiadomienia", () => {
    const eventTime = new Date(Date.now() + 60 * 60 * 1000);

    const event = createEvent("user-e2e-5", {
      title: "Spotkanie do usunięcia",
      event_type: "meeting",
      start_date: eventTime.toISOString(),
      reminder_minutes: [60],
    });

    // Sprawdź że powiadomienie istnieje
    let response = getUpcomingNotifications("user-e2e-5", new Date());
    assertEqual(response.count, 1);

    // Usuń wydarzenie
    const deleted = deleteEvent("user-e2e-5", event.id);
    assertTrue(deleted);

    // Powiadomienie powinno zniknąć
    response = getUpcomingNotifications("user-e2e-5", new Date());
    assertEqual(response.count, 0);
  });

  console.log(
    "\n🔄 E2E TEST 6: Wielokrotne przypomnienia dla jednego wydarzenia\n",
  );

  resetDatabase();

  await test("6.1 Wydarzenie z 3 przypomnieniami - tylko jedno aktywne", () => {
    // Wydarzenie za 65 minut (tylko przypomnienie 60min będzie aktywne)
    const eventTime = new Date(Date.now() + 65 * 60 * 1000);

    createEvent("user-e2e-6", {
      title: "Pilne spotkanie",
      event_type: "deadline",
      start_date: eventTime.toISOString(),
      reminder_minutes: [60, 30, 15], // 1h, 30min, 15min przed
    });

    const response = getUpcomingNotifications("user-e2e-6", new Date());

    // Tylko przypomnienie 60 min powinno być aktywne (65-60=5 min do przypomnienia)
    assertEqual(response.count, 1);
    assertEqual(response.notifications[0].reminder_minutes, 60);
    assertEqual(response.notifications[0].reminder_type, "hour");
  });
}

// ============================================================================
// STRESS TESTS
// ============================================================================

async function runStressTests() {
  console.log("\n⚡ STRESS TEST: Wydajność z wieloma wydarzeniami\n");

  resetDatabase();

  await test("100 wydarzeń - czas odpowiedzi < 100ms", () => {
    const baseTime = new Date();

    // Utwórz 100 wydarzeń
    for (let i = 0; i < 100; i++) {
      createEvent("stress-user", {
        title: `Wydarzenie ${i}`,
        event_type: "meeting",
        start_date: new Date(
          baseTime.getTime() + (i + 1) * 60 * 60 * 1000,
        ).toISOString(),
        reminder_minutes: [60],
      });
    }

    assertEqual(mockDatabase.events.length, 100);

    // Zmierz czas odpowiedzi
    const start = performance.now();
    const response = getUpcomingNotifications("stress-user", baseTime);
    const elapsed = performance.now() - start;

    console.log(`     Czas odpowiedzi: ${elapsed.toFixed(2)}ms`);
    assertTrue(elapsed < 100, `Czas odpowiedzi ${elapsed}ms przekracza 100ms`);

    // Powinno być 1 powiadomienie (wydarzenie za 1h)
    assertEqual(response.count, 1);
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("   🔔 TESTY E2E SYSTEMU POWIADOMIEŃ KALENDARZA");
  console.log("=".repeat(60));

  await runE2ETests();
  await runStressTests();

  console.log("\n" + "=".repeat(50));
  console.log(`📊 WYNIKI E2E: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(50) + "\n");

  if (failed > 0) {
    process.exit(1);
  }

  console.log("✨ Wszystkie testy E2E zakończone pomyślnie!\n");
}

main().catch(console.error);
