/**
 * Testy jednostkowe dla DocumentScorer
 *
 * Uruchom: npx tsx src/services/__tests__/document-scorer.test.ts
 */
// ============================================================================
// UTILS - Konwersja numerów rzymskich (kopia z document-scorer.ts)
// ============================================================================
const ROMAN_VALUES = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
};
function romanToArabic(roman) {
    const values = ROMAN_VALUES;
    let result = 0, prev = 0;
    for (let i = roman.length - 1; i >= 0; i--) {
        const char = roman[i];
        const curr = char ? values[char.toUpperCase()] || 0 : 0;
        result += curr < prev ? -curr : curr;
        prev = curr;
    }
    return result;
}
function arabicToRoman(num) {
    const map = [
        [100, "C"],
        [90, "XC"],
        [50, "L"],
        [40, "XL"],
        [10, "X"],
        [9, "IX"],
        [5, "V"],
        [4, "IV"],
        [1, "I"],
    ];
    let result = "";
    for (const [value, numeral] of map) {
        while (num >= value) {
            result += numeral;
            num -= value;
        }
    }
    return result;
}
function extractSessionNumber(query) {
    const patterns = [
        /sesj[iaęy]\s+(?:nr\.?\s*)?(\d+)/i,
        /sesj[iaęy]\s+(?:nr\.?\s*)?([IVXLC]+)/i,
        /(\d+)\s*sesj/i,
        /([IVXLC]+)\s*sesj/i,
    ];
    for (const pattern of patterns) {
        const match = query.match(pattern);
        if (match && match[1]) {
            const value = match[1];
            if (/^\d+$/.test(value)) {
                const num = parseInt(value, 10);
                if (num > 0 && num <= 200)
                    return num;
            }
            if (/^[IVXLC]+$/i.test(value)) {
                const num = romanToArabic(value);
                if (num > 0 && num <= 200)
                    return num;
            }
        }
    }
    return null;
}
const results = [];
function test(name, fn) {
    try {
        fn();
        results.push({ name, passed: true });
        console.log(`✅ ${name}`);
    }
    catch (error) {
        results.push({ name, passed: false, error: String(error) });
        console.log(`❌ ${name}: ${error}`);
    }
}
function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${expected}, got ${actual}`);
            }
        },
        toEqual(expected) {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
        },
        toBeNull() {
            if (actual !== null) {
                throw new Error(`Expected null, got ${actual}`);
            }
        },
        toBeGreaterThan(expected) {
            if (typeof actual !== "number" || actual <= expected) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        },
    };
}
// ============================================================================
// TESTY KONWERSJI NUMERÓW RZYMSKICH
// ============================================================================
console.log("\n=== TESTY KONWERSJI NUMERÓW RZYMSKICH ===\n");
test("romanToArabic: I = 1", () => {
    expect(romanToArabic("I")).toBe(1);
});
test("romanToArabic: V = 5", () => {
    expect(romanToArabic("V")).toBe(5);
});
test("romanToArabic: X = 10", () => {
    expect(romanToArabic("X")).toBe(10);
});
test("romanToArabic: IV = 4", () => {
    expect(romanToArabic("IV")).toBe(4);
});
test("romanToArabic: IX = 9", () => {
    expect(romanToArabic("IX")).toBe(9);
});
test("romanToArabic: XXIII = 23", () => {
    expect(romanToArabic("XXIII")).toBe(23);
});
test("romanToArabic: XLII = 42", () => {
    expect(romanToArabic("XLII")).toBe(42);
});
test("romanToArabic: L = 50", () => {
    expect(romanToArabic("L")).toBe(50);
});
test("romanToArabic: XC = 90", () => {
    expect(romanToArabic("XC")).toBe(90);
});
test("romanToArabic: C = 100", () => {
    expect(romanToArabic("C")).toBe(100);
});
test("arabicToRoman: 1 = I", () => {
    expect(arabicToRoman(1)).toBe("I");
});
test("arabicToRoman: 4 = IV", () => {
    expect(arabicToRoman(4)).toBe("IV");
});
test("arabicToRoman: 9 = IX", () => {
    expect(arabicToRoman(9)).toBe("IX");
});
test("arabicToRoman: 23 = XXIII", () => {
    expect(arabicToRoman(23)).toBe("XXIII");
});
test("arabicToRoman: 42 = XLII", () => {
    expect(arabicToRoman(42)).toBe("XLII");
});
test("arabicToRoman: 99 = XCIX", () => {
    expect(arabicToRoman(99)).toBe("XCIX");
});
// ============================================================================
// TESTY EKSTRAKCJI NUMERU SESJI
// ============================================================================
console.log("\n=== TESTY EKSTRAKCJI NUMERU SESJI ===\n");
test("extractSessionNumber: 'sesja 23' = 23", () => {
    expect(extractSessionNumber("sesja 23")).toBe(23);
});
test("extractSessionNumber: 'sesji 23' = 23", () => {
    expect(extractSessionNumber("sesji 23")).toBe(23);
});
test("extractSessionNumber: 'sesja nr 23' = 23", () => {
    expect(extractSessionNumber("sesja nr 23")).toBe(23);
});
test("extractSessionNumber: 'sesja XXIII' = 23", () => {
    expect(extractSessionNumber("sesja XXIII")).toBe(23);
});
test("extractSessionNumber: 'sesji XXIII' = 23", () => {
    expect(extractSessionNumber("sesji XXIII")).toBe(23);
});
test("extractSessionNumber: 'sesja nr XXIII' = 23", () => {
    expect(extractSessionNumber("sesja nr XXIII")).toBe(23);
});
test("extractSessionNumber: '23 sesja' = 23", () => {
    expect(extractSessionNumber("23 sesja")).toBe(23);
});
test("extractSessionNumber: 'XXIII sesja' = 23", () => {
    expect(extractSessionNumber("XXIII sesja")).toBe(23);
});
test("extractSessionNumber: 'protokół z sesji 15' = 15", () => {
    expect(extractSessionNumber("protokół z sesji 15")).toBe(15);
});
test("extractSessionNumber: 'uchwała z sesji XV' = 15", () => {
    expect(extractSessionNumber("uchwała z sesji XV")).toBe(15);
});
test("extractSessionNumber: 'budżet gminy' = null (brak sesji)", () => {
    expect(extractSessionNumber("budżet gminy")).toBeNull();
});
test("extractSessionNumber: 'uchwała 123' = null (brak sesji)", () => {
    expect(extractSessionNumber("uchwała 123")).toBeNull();
});
// ============================================================================
// TESTY SORTOWANIA
// ============================================================================
console.log("\n=== TESTY SORTOWANIA ===\n");
function sortByDate(docs, order) {
    return [...docs].sort((a, b) => {
        const dateA = a.publish_date
            ? new Date(a.publish_date).getTime()
            : new Date(a.processed_at).getTime();
        const dateB = b.publish_date
            ? new Date(b.publish_date).getTime()
            : new Date(b.processed_at).getTime();
        const comparison = dateB - dateA;
        return order === "asc" ? -comparison : comparison;
    });
}
const mockDocs = [
    {
        id: "1",
        title: "Doc 1",
        publish_date: "2024-01-15",
        processed_at: "2024-01-16",
    },
    {
        id: "2",
        title: "Doc 2",
        publish_date: "2024-03-20",
        processed_at: "2024-03-21",
    },
    {
        id: "3",
        title: "Doc 3",
        publish_date: "2024-02-10",
        processed_at: "2024-02-11",
    },
];
test("sortByDate desc: najnowsze pierwsze", () => {
    const sorted = sortByDate(mockDocs, "desc");
    expect(sorted[0].id).toBe("2"); // 2024-03-20
    expect(sorted[1].id).toBe("3"); // 2024-02-10
    expect(sorted[2].id).toBe("1"); // 2024-01-15
});
test("sortByDate asc: najstarsze pierwsze", () => {
    const sorted = sortByDate(mockDocs, "asc");
    expect(sorted[0].id).toBe("1"); // 2024-01-15
    expect(sorted[1].id).toBe("3"); // 2024-02-10
    expect(sorted[2].id).toBe("2"); // 2024-03-20
});
// ============================================================================
// PODSUMOWANIE
// ============================================================================
console.log("\n=== PODSUMOWANIE ===\n");
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
console.log(`Passed: ${passed}/${results.length}`);
console.log(`Failed: ${failed}/${results.length}`);
if (failed > 0) {
    console.log("\n❌ Nieudane testy:");
    results
        .filter((r) => !r.passed)
        .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
}
else {
    console.log("\n✅ Wszystkie testy przeszły pomyślnie!");
    process.exit(0);
}
export {};
//# sourceMappingURL=document-scorer.test.js.map