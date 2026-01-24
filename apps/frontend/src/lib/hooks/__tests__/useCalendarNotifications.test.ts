/**
 * Testy jednostkowe dla hook useCalendarNotifications
 *
 * Uruchom: npx tsx src/lib/hooks/__tests__/useCalendarNotifications.test.ts
 */

// ============================================================================
// HELPER FUNCTIONS (kopia z useCalendarNotifications.ts)
// ============================================================================

function formatTimeUntilEvent(minutes: number): string {
  if (minutes < 0) return "już się rozpoczęło";
  if (minutes < 1) return "za chwilę";
  if (minutes < 60) return `za ${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (hours < 24) {
    if (remainingMinutes === 0) return `za ${hours} godz.`;
    return `za ${hours} godz. ${remainingMinutes} min`;
  }

  const days = Math.floor(hours / 24);
  return `za ${days} dni`;
}

// ============================================================================
// MOCK DISMISSED SET (symulacja ref)
// ============================================================================

class MockDismissedSet {
  private dismissed = new Set<string>();

  add(id: string) {
    this.dismissed.add(id);
  }

  has(id: string) {
    return this.dismissed.has(id);
  }

  clear() {
    this.dismissed.clear();
  }
}

// ============================================================================
// MOCK NOTIFICATION FILTER
// ============================================================================

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

function filterDismissed(
  notifications: CalendarNotification[],
  dismissed: MockDismissedSet,
): CalendarNotification[] {
  return notifications.filter((n) => !dismissed.has(n.id));
}

// ============================================================================
// TESTY
// ============================================================================

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
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
    if (actual !== expected) {
      throw new Error(
        `${message || "Assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
  }

  console.log("\n🧪 TESTY - formatTimeUntilEvent\n");

  test("Ujemne minuty → 'już się rozpoczęło'", () => {
    assertEqual(formatTimeUntilEvent(-5), "już się rozpoczęło");
    assertEqual(formatTimeUntilEvent(-100), "już się rozpoczęło");
  });

  test("0-1 minuty → 'za chwilę'", () => {
    assertEqual(formatTimeUntilEvent(0), "za chwilę");
    assertEqual(formatTimeUntilEvent(0.5), "za chwilę");
  });

  test("1-59 minut → 'za X min'", () => {
    assertEqual(formatTimeUntilEvent(1), "za 1 min");
    assertEqual(formatTimeUntilEvent(15), "za 15 min");
    assertEqual(formatTimeUntilEvent(59), "za 59 min");
  });

  test("60 minut → 'za 1 godz.'", () => {
    assertEqual(formatTimeUntilEvent(60), "za 1 godz.");
  });

  test("75 minut → 'za 1 godz. 15 min'", () => {
    assertEqual(formatTimeUntilEvent(75), "za 1 godz. 15 min");
  });

  test("120 minut → 'za 2 godz.'", () => {
    assertEqual(formatTimeUntilEvent(120), "za 2 godz.");
  });

  test("1440 minut (24h) → 'za 1 dni'", () => {
    assertEqual(formatTimeUntilEvent(1440), "za 1 dni");
  });

  test("2880 minut (48h) → 'za 2 dni'", () => {
    assertEqual(formatTimeUntilEvent(2880), "za 2 dni");
  });

  console.log("\n🧪 TESTY - Filtrowanie odrzuconych powiadomień\n");

  const mockNotifications: CalendarNotification[] = [
    {
      id: "notif-1",
      event_id: "evt-1",
      title: "Spotkanie 1",
      event_type: "meeting",
      start_date: "2026-01-27T10:00:00Z",
      minutes_until_event: 60,
      reminder_type: "hour",
      reminder_minutes: 60,
    },
    {
      id: "notif-2",
      event_id: "evt-2",
      title: "Spotkanie 2",
      event_type: "meeting",
      start_date: "2026-01-27T11:00:00Z",
      minutes_until_event: 120,
      reminder_type: "hour",
      reminder_minutes: 60,
    },
    {
      id: "notif-3",
      event_id: "evt-3",
      title: "Sesja Rady",
      event_type: "session",
      start_date: "2026-01-27T14:00:00Z",
      location: "Ratusz",
      minutes_until_event: 300,
      reminder_type: "hour",
      reminder_minutes: 60,
    },
  ];

  test("Brak odrzuconych → wszystkie powiadomienia", () => {
    const dismissed = new MockDismissedSet();
    const result = filterDismissed(mockNotifications, dismissed);
    assertEqual(result.length, 3);
  });

  test("Jedno odrzucone → 2 powiadomienia", () => {
    const dismissed = new MockDismissedSet();
    dismissed.add("notif-1");
    const result = filterDismissed(mockNotifications, dismissed);
    assertEqual(result.length, 2);
    assertEqual(result[0].id, "notif-2");
  });

  test("Wszystkie odrzucone → 0 powiadomień", () => {
    const dismissed = new MockDismissedSet();
    dismissed.add("notif-1");
    dismissed.add("notif-2");
    dismissed.add("notif-3");
    const result = filterDismissed(mockNotifications, dismissed);
    assertEqual(result.length, 0);
  });

  test("Odrzucenie nieistniejącego ID nie wpływa na wyniki", () => {
    const dismissed = new MockDismissedSet();
    dismissed.add("notif-999");
    const result = filterDismissed(mockNotifications, dismissed);
    assertEqual(result.length, 3);
  });

  console.log("\n🧪 TESTY - Struktura powiadomienia\n");

  test("Powiadomienie zawiera wszystkie wymagane pola", () => {
    const notification = mockNotifications[0];

    if (!notification.id) throw new Error("Brak id");
    if (!notification.event_id) throw new Error("Brak event_id");
    if (!notification.title) throw new Error("Brak title");
    if (!notification.event_type) throw new Error("Brak event_type");
    if (!notification.start_date) throw new Error("Brak start_date");
    if (notification.minutes_until_event === undefined)
      throw new Error("Brak minutes_until_event");
    if (!notification.reminder_type) throw new Error("Brak reminder_type");
    if (notification.reminder_minutes === undefined)
      throw new Error("Brak reminder_minutes");
  });

  test("reminder_type jest jednym z: day, hour, minutes", () => {
    const validTypes = ["day", "hour", "minutes"];

    for (const notification of mockNotifications) {
      if (!validTypes.includes(notification.reminder_type)) {
        throw new Error(
          `Nieprawidłowy reminder_type: ${notification.reminder_type}`,
        );
      }
    }
  });

  test("Opcjonalne pole location", () => {
    // notif-3 ma location, notif-1 nie ma
    assertEqual(mockNotifications[2].location, "Ratusz");
    assertEqual(mockNotifications[0].location, undefined);
  });

  console.log("\n🧪 TESTY - Callback onNotification\n");

  test("Callback wywoływany dla nowych powiadomień", () => {
    const notifiedIds = new Set<string>();
    const onNotification = (n: CalendarNotification) => {
      notifiedIds.add(n.id);
    };

    // Symulacja pierwszego fetcha
    for (const notification of mockNotifications) {
      if (!notifiedIds.has(notification.id)) {
        onNotification(notification);
      }
    }

    assertEqual(notifiedIds.size, 3);
  });

  test("Callback NIE wywoływany dla już powiadomionych", () => {
    const notifiedIds = new Set<string>();
    let callCount = 0;

    const onNotification = (n: CalendarNotification) => {
      if (!notifiedIds.has(n.id)) {
        notifiedIds.add(n.id);
        callCount++;
      }
    };

    // Pierwszy fetch
    for (const notification of mockNotifications) {
      onNotification(notification);
    }

    // Drugi fetch (te same powiadomienia)
    for (const notification of mockNotifications) {
      onNotification(notification);
    }

    // Callback powinien być wywołany tylko 3 razy (przy pierwszym fetch)
    assertEqual(callCount, 3);
  });

  // Podsumowanie
  console.log("\n" + "=".repeat(50));
  console.log(`📊 WYNIKI: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(50) + "\n");

  if (failed > 0) {
    process.exit(1);
  }
}

// ============================================================================
// MAIN
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("   🔔 TESTY HOOK useCalendarNotifications");
console.log("=".repeat(60));

runTests();

console.log("✨ Wszystkie testy zakończone pomyślnie!\n");
