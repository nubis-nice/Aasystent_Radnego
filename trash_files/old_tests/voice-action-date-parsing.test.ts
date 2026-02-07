/**
 * Test parsowania dat w VoiceActionService
 * UWAGA: LLM teraz parsuje naturalne daty do DD-MM-YYYY
 * Ten test sprawdza tylko konwersję DD-MM-YYYY → Date
 *
 * Uruchom: npx tsx src/services/__tests__/voice-action-date-parsing.test.ts
 */

// ============================================================================
// KOPIA FUNKCJI parseNaturalDate z voice-action-service.ts
// ============================================================================

function parseNaturalDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Format DD-MM-YYYY (główny format z LLM)
  const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    return new Date(year, month, day);
  }

  // Format DD.MM.YYYY (fallback)
  const dotMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10);
    const month = parseInt(dotMatch[2], 10) - 1;
    const year = parseInt(dotMatch[3], 10);
    return new Date(year, month, day);
  }

  // Format YYYY-MM-DD (fallback)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + "T00:00:00");
  }

  return null;
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

  function assertNotNull(value: unknown, message?: string) {
    if (value === null || value === undefined) {
      throw new Error(message || "Expected non-null value");
    }
  }

  console.log("\n🧪 TESTY PARSOWANIA DAT (DD-MM-YYYY)\n");
  console.log(
    `   UWAGA: LLM parsuje naturalne daty, tutaj testujemy tylko konwersję formatu\n`,
  );

  // Test formatu DD-MM-YYYY
  console.log("📅 Format DD-MM-YYYY (z LLM):\n");

  test("'03-02-2026' → 3 lutego 2026", () => {
    const result = parseNaturalDate("03-02-2026");
    assertNotNull(result);
    if (
      result!.getFullYear() !== 2026 ||
      result!.getMonth() !== 1 ||
      result!.getDate() !== 3
    ) {
      throw new Error(`Expected 2026-02-03, got ${result!.toDateString()}`);
    }
  });

  test("'27-01-2026' → 27 stycznia 2026", () => {
    const result = parseNaturalDate("27-01-2026");
    assertNotNull(result);
    if (
      result!.getFullYear() !== 2026 ||
      result!.getMonth() !== 0 ||
      result!.getDate() !== 27
    ) {
      throw new Error(`Expected 2026-01-27, got ${result!.toDateString()}`);
    }
  });

  test("'3-2-2026' → 3 lutego 2026 (bez wiodących zer)", () => {
    const result = parseNaturalDate("3-2-2026");
    assertNotNull(result);
    if (
      result!.getFullYear() !== 2026 ||
      result!.getMonth() !== 1 ||
      result!.getDate() !== 3
    ) {
      throw new Error(`Expected 2026-02-03, got ${result!.toDateString()}`);
    }
  });

  // Test formatu DD.MM.YYYY (fallback)
  console.log("\n📅 Format DD.MM.YYYY (fallback):\n");

  test("'27.01.2026' → 27 stycznia 2026", () => {
    const result = parseNaturalDate("27.01.2026");
    assertNotNull(result);
    if (
      result!.getFullYear() !== 2026 ||
      result!.getMonth() !== 0 ||
      result!.getDate() !== 27
    ) {
      throw new Error(`Expected 27.01.2026, got ${result!.toDateString()}`);
    }
  });

  test("'3.2.2026' → 3 lutego 2026", () => {
    const result = parseNaturalDate("3.2.2026");
    assertNotNull(result);
    if (
      result!.getFullYear() !== 2026 ||
      result!.getMonth() !== 1 ||
      result!.getDate() !== 3
    ) {
      throw new Error(`Expected 3.2.2026, got ${result!.toDateString()}`);
    }
  });

  // Test formatu YYYY-MM-DD (fallback)
  console.log("\n📅 Format YYYY-MM-DD (fallback):\n");

  test("'2026-01-27' → 27 stycznia 2026", () => {
    const result = parseNaturalDate("2026-01-27");
    assertNotNull(result);
    if (
      result!.getFullYear() !== 2026 ||
      result!.getMonth() !== 0 ||
      result!.getDate() !== 27
    ) {
      throw new Error(`Expected 2026-01-27, got ${result!.toDateString()}`);
    }
  });

  test("'2026-02-03' → 3 lutego 2026", () => {
    const result = parseNaturalDate("2026-02-03");
    assertNotNull(result);
    if (
      result!.getFullYear() !== 2026 ||
      result!.getMonth() !== 1 ||
      result!.getDate() !== 3
    ) {
      throw new Error(`Expected 2026-02-03, got ${result!.toDateString()}`);
    }
  });

  // Test nieprawidłowych formatów
  console.log("\n📅 Nieprawidłowe formaty:\n");

  test("'jutro' → null (LLM powinien to sparsować)", () => {
    const result = parseNaturalDate("jutro");
    if (result !== null) {
      throw new Error(
        `Expected null for 'jutro', got ${result!.toDateString()}`,
      );
    }
  });

  test("'wtorek przyszły tydzień' → null (LLM powinien to sparsować)", () => {
    const result = parseNaturalDate("wtorek przyszły tydzień");
    if (result !== null) {
      throw new Error(
        `Expected null for natural date, got ${result!.toDateString()}`,
      );
    }
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
console.log("   🗓️ TEST PARSOWANIA DAT - VoiceActionService");
console.log("=".repeat(60));

runTests();

console.log("✨ Wszystkie testy parsowania dat zakończone pomyślnie!\n");
