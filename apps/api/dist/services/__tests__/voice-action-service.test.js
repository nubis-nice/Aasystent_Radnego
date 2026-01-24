/**
 * Testy dla VoiceActionService - parsowanie daty
 * Uruchom: npx tsx src/services/__tests__/voice-action-service.test.ts
 */
// ===================== FUNKCJE TESTOWE =====================
function parseNaturalDate(dateStr) {
    if (!dateStr)
        return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lowerDate = dateStr.toLowerCase().trim();
    if (lowerDate === "dziś" ||
        lowerDate === "dzisiaj" ||
        lowerDate === "today") {
        return today;
    }
    if (lowerDate === "jutro" || lowerDate === "tomorrow") {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return tomorrow;
    }
    if (lowerDate === "pojutrze") {
        const dayAfter = new Date(today);
        dayAfter.setDate(today.getDate() + 2);
        return dayAfter;
    }
    const inDaysMatch = lowerDate.match(/za\s+(\d+)\s+dni/);
    if (inDaysMatch) {
        const days = parseInt(inDaysMatch[1], 10);
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + days);
        return futureDate;
    }
    const weekdays = [
        { patterns: ["niedziela", "niedzielę", "niedziele"], dayNum: 0 },
        { patterns: ["poniedziałek", "poniedziałku"], dayNum: 1 },
        { patterns: ["wtorek", "wtorku"], dayNum: 2 },
        { patterns: ["środa", "środę", "sroda", "srode"], dayNum: 3 },
        { patterns: ["czwartek", "czwartku"], dayNum: 4 },
        { patterns: ["piątek", "piątku", "piatek", "piatku"], dayNum: 5 },
        { patterns: ["sobota", "sobotę", "sobote"], dayNum: 6 },
    ];
    for (const { patterns, dayNum } of weekdays) {
        if (patterns.some((p) => lowerDate.includes(p))) {
            const currentDay = today.getDay();
            let daysUntil = dayNum - currentDay;
            if (daysUntil <= 0)
                daysUntil += 7;
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + daysUntil);
            return targetDate;
        }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr + "T00:00:00");
    }
    const euMatch = dateStr.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
    if (euMatch) {
        return new Date(parseInt(euMatch[3]), parseInt(euMatch[2]) - 1, parseInt(euMatch[1]));
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }
    return null;
}
function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}
// ===================== TEST FRAMEWORK =====================
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`❌ ${name}`);
        console.log(`   ${e}`);
        failed++;
    }
}
function assert(condition, message) {
    if (!condition)
        throw new Error(message || "Assertion failed");
}
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}
// ===================== TESTY =====================
console.log("\n📅 parseNaturalDate - relatywne daty\n");
const today = new Date();
today.setHours(0, 0, 0, 0);
test('parsuje "dziś"', () => {
    const result = parseNaturalDate("dziś");
    assert(result !== null, "wynik nie powinien być null");
    assertEqual(result.getDate(), today.getDate());
});
test('parsuje "dzisiaj"', () => {
    const result = parseNaturalDate("dzisiaj");
    assert(result !== null);
    assertEqual(result.getDate(), today.getDate());
});
test('parsuje "jutro"', () => {
    const result = parseNaturalDate("jutro");
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    assert(result !== null);
    assertEqual(result.getDate(), tomorrow.getDate());
});
test('parsuje "pojutrze"', () => {
    const result = parseNaturalDate("pojutrze");
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);
    assert(result !== null);
    assertEqual(result.getDate(), dayAfter.getDate());
});
test('parsuje "za 5 dni"', () => {
    const result = parseNaturalDate("za 5 dni");
    const future = new Date(today);
    future.setDate(today.getDate() + 5);
    assert(result !== null);
    assertEqual(result.getDate(), future.getDate());
});
console.log("\n📅 parseNaturalDate - dni tygodnia\n");
test('parsuje "poniedziałek"', () => {
    const result = parseNaturalDate("poniedziałek");
    assert(result !== null);
    assertEqual(result.getDay(), 1);
});
test('parsuje "piątek"', () => {
    const result = parseNaturalDate("piątek");
    assert(result !== null);
    assertEqual(result.getDay(), 5);
});
test('parsuje "w środę"', () => {
    const result = parseNaturalDate("w środę");
    assert(result !== null);
    assertEqual(result.getDay(), 3);
});
console.log("\n📅 parseNaturalDate - formaty daty\n");
test("parsuje format YYYY-MM-DD", () => {
    const result = parseNaturalDate("2026-01-20");
    assert(result !== null);
    assertEqual(result.getFullYear(), 2026);
    assertEqual(result.getMonth(), 0);
    assertEqual(result.getDate(), 20);
});
test("parsuje format DD.MM.YYYY", () => {
    const result = parseNaturalDate("20.01.2026");
    assert(result !== null);
    assertEqual(result.getFullYear(), 2026);
    assertEqual(result.getMonth(), 0);
    assertEqual(result.getDate(), 20);
});
test("parsuje format DD-MM-YYYY", () => {
    const result = parseNaturalDate("20-01-2026");
    assert(result !== null);
    assertEqual(result.getFullYear(), 2026);
    assertEqual(result.getMonth(), 0);
    assertEqual(result.getDate(), 20);
});
console.log("\n📅 parseNaturalDate - błędne dane\n");
test("zwraca null dla pustego stringa", () => {
    assertEqual(parseNaturalDate(""), null);
});
test("zwraca null dla niepoprawnej daty", () => {
    assertEqual(parseNaturalDate("nie wiem"), null);
});
console.log("\n🗓️ formatDateTimeLocal\n");
test("formatuje datę do formatu datetime-local", () => {
    const date = new Date(2026, 0, 17, 14, 30);
    assertEqual(formatDateTimeLocal(date), "2026-01-17T14:30");
});
test("dodaje zera wiodące dla małych wartości", () => {
    const date = new Date(2026, 0, 5, 9, 5);
    assertEqual(formatDateTimeLocal(date), "2026-01-05T09:05");
});
test("obsługuje północ", () => {
    const date = new Date(2026, 0, 17, 0, 0);
    assertEqual(formatDateTimeLocal(date), "2026-01-17T00:00");
});
test("obsługuje koniec dnia", () => {
    const date = new Date(2026, 0, 17, 23, 59);
    assertEqual(formatDateTimeLocal(date), "2026-01-17T23:59");
});
// ===================== PODSUMOWANIE =====================
console.log("\n" + "=".repeat(40));
console.log(`📊 Wyniki: ${passed} passed, ${failed} failed`);
console.log("=".repeat(40) + "\n");
process.exit(failed > 0 ? 1 : 0);
export {};
//# sourceMappingURL=voice-action-service.test.js.map