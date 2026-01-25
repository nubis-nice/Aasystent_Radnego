/**
 * Testy jednostkowe i integracyjne dla systemu powiadomień kalendarza
 *
 * Uruchom: npx tsx src/services/__tests__/calendar-notifications.test.ts
 */
// ============================================================================
// LOGIKA POWIADOMIEŃ (kopia z dashboard.ts do testowania)
// ============================================================================
function calculateNotifications(events, now) {
    const notifications = [];
    for (const event of events) {
        const eventStart = new Date(event.start_date);
        const reminderMinutes = event.reminder_minutes || [60];
        for (const minutes of reminderMinutes) {
            const reminderTime = new Date(eventStart.getTime() - minutes * 60 * 1000);
            const minutesUntilReminder = (reminderTime.getTime() - now.getTime()) / (60 * 1000);
            // Przypomnienie w ciągu następnych 5 minut lub już minęło (ale max 30 min temu)
            if (minutesUntilReminder <= 5 && minutesUntilReminder >= -30) {
                const minutesUntilEvent = (eventStart.getTime() - now.getTime()) / (60 * 1000);
                notifications.push({
                    id: `${event.id}-${minutes}`,
                    event_id: event.id,
                    title: event.title,
                    event_type: event.event_type,
                    start_date: event.start_date,
                    location: event.location,
                    minutes_until_event: Math.round(minutesUntilEvent),
                    reminder_type: minutes >= 1440 ? "day" : minutes >= 60 ? "hour" : "minutes",
                    reminder_minutes: minutes,
                });
            }
        }
    }
    return notifications;
}
// ============================================================================
// HELPER: formatTimeUntilEvent (kopia z frontend hook)
// ============================================================================
function formatTimeUntilEvent(minutes) {
    if (minutes < 0)
        return "już się rozpoczęło";
    if (minutes < 1)
        return "za chwilę";
    if (minutes < 60)
        return `za ${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    if (hours < 24) {
        if (remainingMinutes === 0)
            return `za ${hours} godz.`;
        return `za ${hours} godz. ${remainingMinutes} min`;
    }
    const days = Math.floor(hours / 24);
    return `za ${days} dni`;
}
// ============================================================================
// TESTY JEDNOSTKOWE
// ============================================================================
function runTests() {
    let passed = 0;
    let failed = 0;
    function test(name, fn) {
        try {
            fn();
            console.log(`  ✅ ${name}`);
            passed++;
        }
        catch (error) {
            console.log(`  ❌ ${name}`);
            console.log(`     Error: ${error instanceof Error ? error.message : error}`);
            failed++;
        }
    }
    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || "Assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    }
    function assertTrue(condition, message) {
        if (!condition) {
            throw new Error(message || "Expected true but got false");
        }
    }
    console.log("\n🧪 TESTY JEDNOSTKOWE - Logika powiadomień\n");
    // Test 1: Brak wydarzeń = brak powiadomień
    test("Brak wydarzeń zwraca pustą tablicę", () => {
        const result = calculateNotifications([], new Date());
        assertEqual(result.length, 0);
    });
    // Test 2: Wydarzenie za 1 godzinę z reminder_minutes=[60]
    test("Powiadomienie 1h przed wydarzeniem", () => {
        const now = new Date("2026-01-27T19:20:00Z");
        const events = [
            {
                id: "evt-1",
                user_id: "user-1",
                title: "Spotkanie testowe",
                event_type: "meeting",
                start_date: "2026-01-27T20:20:00Z",
                reminder_minutes: [60],
            },
        ];
        const result = calculateNotifications(events, now);
        assertEqual(result.length, 1, "Powinno być 1 powiadomienie");
        assertEqual(result[0].title, "Spotkanie testowe");
        assertEqual(result[0].reminder_type, "hour");
        assertEqual(result[0].minutes_until_event, 60);
    });
    // Test 3: Wydarzenie za 24h z reminder_minutes=[1440]
    test("Powiadomienie 24h przed wydarzeniem (typ: day)", () => {
        const now = new Date("2026-01-26T20:20:00Z");
        const events = [
            {
                id: "evt-2",
                user_id: "user-1",
                title: "Sesja Rady",
                event_type: "session",
                start_date: "2026-01-27T20:20:00Z",
                reminder_minutes: [1440],
            },
        ];
        const result = calculateNotifications(events, now);
        assertEqual(result.length, 1);
        assertEqual(result[0].reminder_type, "day");
        assertEqual(result[0].minutes_until_event, 1440);
    });
    // Test 4: Wydarzenie z wieloma reminder_minutes
    test("Wielokrotne przypomnienia dla jednego wydarzenia", () => {
        const now = new Date("2026-01-27T19:20:00Z");
        const events = [
            {
                id: "evt-3",
                user_id: "user-1",
                title: "Ważne spotkanie",
                event_type: "meeting",
                start_date: "2026-01-27T20:20:00Z",
                reminder_minutes: [60, 30, 15], // 3 przypomnienia
            },
        ];
        const result = calculateNotifications(events, now);
        // Tylko reminder 60 min powinien być aktywny (w zakresie ±5 min)
        assertEqual(result.length, 1);
        assertEqual(result[0].reminder_minutes, 60);
    });
    // Test 5: Wydarzenie już minęło (>30 min temu) - brak powiadomienia
    test("Brak powiadomienia gdy wydarzenie minęło >30 min temu", () => {
        const now = new Date("2026-01-27T21:00:00Z"); // 40 min po wydarzeniu
        const events = [
            {
                id: "evt-4",
                user_id: "user-1",
                title: "Minęłe spotkanie",
                event_type: "meeting",
                start_date: "2026-01-27T20:20:00Z",
                reminder_minutes: [60],
            },
        ];
        const result = calculateNotifications(events, now);
        assertEqual(result.length, 0, "Nie powinno być powiadomień dla przeszłych wydarzeń");
    });
    // Test 6: Wydarzenie za daleko w przyszłości
    test("Brak powiadomienia gdy przypomnienie za daleko w przyszłości", () => {
        const now = new Date("2026-01-27T10:00:00Z"); // 10+ godzin przed
        const events = [
            {
                id: "evt-5",
                user_id: "user-1",
                title: "Późne spotkanie",
                event_type: "meeting",
                start_date: "2026-01-27T20:20:00Z",
                reminder_minutes: [60],
            },
        ];
        const result = calculateNotifications(events, now);
        assertEqual(result.length, 0);
    });
    // Test 7: Lokalizacja w powiadomieniu
    test("Powiadomienie zawiera lokalizację", () => {
        const now = new Date("2026-01-27T19:20:00Z");
        const events = [
            {
                id: "evt-6",
                user_id: "user-1",
                title: "Spotkanie z lokalizacją",
                event_type: "meeting",
                start_date: "2026-01-27T20:20:00Z",
                location: "Sala konferencyjna A",
                reminder_minutes: [60],
            },
        ];
        const result = calculateNotifications(events, now);
        assertEqual(result[0].location, "Sala konferencyjna A");
    });
    console.log("\n🧪 TESTY JEDNOSTKOWE - formatTimeUntilEvent\n");
    // Test formatowania czasu
    test("Format: już się rozpoczęło (ujemne minuty)", () => {
        assertEqual(formatTimeUntilEvent(-10), "już się rozpoczęło");
    });
    test("Format: za chwilę (<1 min)", () => {
        assertEqual(formatTimeUntilEvent(0.5), "za chwilę");
    });
    test("Format: za X min (<60 min)", () => {
        assertEqual(formatTimeUntilEvent(30), "za 30 min");
    });
    test("Format: za X godz. (dokładnie)", () => {
        assertEqual(formatTimeUntilEvent(120), "za 2 godz.");
    });
    test("Format: za X godz. Y min", () => {
        assertEqual(formatTimeUntilEvent(90), "za 1 godz. 30 min");
    });
    test("Format: za X dni (>24h)", () => {
        assertEqual(formatTimeUntilEvent(1500), "za 1 dni");
    });
    console.log("\n🧪 TESTY INTEGRACYJNE - Scenariusze użytkownika\n");
    // Scenariusz 1: Dzień roboczy radnego
    test("Scenariusz: Dzień z wieloma wydarzeniami", () => {
        const now = new Date("2026-01-27T08:55:00Z"); // 8:55 rano
        const events = [
            {
                id: "session-1",
                user_id: "radny-1",
                title: "Sesja Rady Miejskiej",
                event_type: "session",
                start_date: "2026-01-27T09:00:00Z", // za 5 min
                location: "Ratusz, Sala Obrad",
                reminder_minutes: [1440, 60, 5],
            },
            {
                id: "meeting-1",
                user_id: "radny-1",
                title: "Spotkanie z mieszkańcami",
                event_type: "meeting",
                start_date: "2026-01-27T14:00:00Z", // za ~5h
                reminder_minutes: [60],
            },
        ];
        const result = calculateNotifications(events, now);
        // Powinno być tylko powiadomienie o sesji (5 min przed)
        assertEqual(result.length, 1);
        assertEqual(result[0].title, "Sesja Rady Miejskiej");
        assertTrue(result[0].minutes_until_event <= 5);
    });
    // Scenariusz 2: Przypomnienie dzień wcześniej
    test("Scenariusz: Przypomnienie 24h przed ważnym terminem", () => {
        const now = new Date("2026-01-26T15:00:00Z");
        const events = [
            {
                id: "deadline-1",
                user_id: "radny-1",
                title: "Termin złożenia interpelacji",
                event_type: "deadline",
                start_date: "2026-01-27T15:00:00Z", // dokładnie 24h
                reminder_minutes: [1440],
            },
        ];
        const result = calculateNotifications(events, now);
        assertEqual(result.length, 1);
        assertEqual(result[0].reminder_type, "day");
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
// TESTY FUNKCJONALNE - Symulacja API
// ============================================================================
async function runFunctionalTests() {
    console.log("\n🔧 TESTY FUNKCJONALNE - Symulacja endpointu API\n");
    let passed = 0;
    let failed = 0;
    async function testAsync(name, fn) {
        try {
            await fn();
            console.log(`  ✅ ${name}`);
            passed++;
        }
        catch (error) {
            console.log(`  ❌ ${name}`);
            console.log(`     Error: ${error instanceof Error ? error.message : error}`);
            failed++;
        }
    }
    // Symulacja odpowiedzi API
    function simulateApiResponse(events, now) {
        const notifications = calculateNotifications(events, now);
        return {
            notifications,
            count: notifications.length,
            checked_at: now.toISOString(),
        };
    }
    await testAsync("API: Poprawna struktura odpowiedzi", async () => {
        const events = [
            {
                id: "test-1",
                user_id: "user-1",
                title: "Test Event",
                event_type: "meeting",
                start_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                reminder_minutes: [60],
            },
        ];
        const response = simulateApiResponse(events, new Date());
        if (!("notifications" in response))
            throw new Error("Brak pola notifications");
        if (!("count" in response))
            throw new Error("Brak pola count");
        if (!("checked_at" in response))
            throw new Error("Brak pola checked_at");
        if (!Array.isArray(response.notifications))
            throw new Error("notifications nie jest tablicą");
    });
    await testAsync("API: Licznik powiadomień zgadza się z tablicą", async () => {
        const events = [
            {
                id: "test-2",
                user_id: "user-1",
                title: "Test 1",
                event_type: "meeting",
                start_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                reminder_minutes: [60],
            },
            {
                id: "test-3",
                user_id: "user-1",
                title: "Test 2",
                event_type: "meeting",
                start_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                reminder_minutes: [60],
            },
        ];
        const response = simulateApiResponse(events, new Date());
        if (response.count !== response.notifications.length) {
            throw new Error(`count (${response.count}) !== notifications.length (${response.notifications.length})`);
        }
    });
    await testAsync("API: Powiadomienia mają wymagane pola", async () => {
        const events = [
            {
                id: "test-4",
                user_id: "user-1",
                title: "Full Event",
                event_type: "session",
                start_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                location: "Test Location",
                reminder_minutes: [60],
            },
        ];
        const response = simulateApiResponse(events, new Date());
        if (response.notifications.length === 0) {
            throw new Error("Brak powiadomień do sprawdzenia");
        }
        const notification = response.notifications[0];
        const requiredFields = [
            "id",
            "event_id",
            "title",
            "event_type",
            "start_date",
            "minutes_until_event",
            "reminder_type",
            "reminder_minutes",
        ];
        for (const field of requiredFields) {
            if (!(field in notification)) {
                throw new Error(`Brak wymaganego pola: ${field}`);
            }
        }
    });
    console.log("\n" + "=".repeat(50));
    console.log(`📊 TESTY FUNKCJONALNE: ${passed} passed, ${failed} failed`);
    console.log("=".repeat(50) + "\n");
    if (failed > 0) {
        process.exit(1);
    }
}
// ============================================================================
// MAIN
// ============================================================================
async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("   🔔 TESTY SYSTEMU POWIADOMIEŃ KALENDARZA");
    console.log("=".repeat(60));
    runTests();
    await runFunctionalTests();
    console.log("✨ Wszystkie testy zakończone pomyślnie!\n");
}
main().catch(console.error);
export {};
//# sourceMappingURL=calendar-notifications.test.js.map