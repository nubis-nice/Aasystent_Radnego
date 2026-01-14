/**
 * Utility functions for Roman numeral conversion
 * Zunifikowany moduł - używany w całej aplikacji
 */

const ROMAN_VALUES: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

const ARABIC_TO_ROMAN: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
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

/**
 * Konwertuje liczbę rzymską na arabską
 * @param roman - liczba rzymska (np. "XXIII")
 * @returns liczba arabska (np. 23) lub 0 jeśli nieprawidłowa
 */
export function romanToArabic(roman: string): number {
  if (!roman || typeof roman !== "string") return 0;

  const upper = roman.toUpperCase().trim();
  if (!/^[IVXLCDM]+$/.test(upper)) return 0;

  let result = 0;
  let prevValue = 0;

  for (let i = upper.length - 1; i >= 0; i--) {
    const char = upper[i];
    const currentValue = char ? ROMAN_VALUES[char] || 0 : 0;

    if (currentValue < prevValue) {
      result -= currentValue;
    } else {
      result += currentValue;
    }
    prevValue = currentValue;
  }

  return result;
}

/**
 * Konwertuje liczbę arabską na rzymską
 * @param num - liczba arabska (np. 23)
 * @returns liczba rzymska (np. "XXIII") lub pusty string jeśli nieprawidłowa
 */
export function arabicToRoman(num: number): string {
  if (!num || num <= 0 || num > 3999) return "";

  let result = "";
  let remaining = Math.floor(num);

  for (const [value, numeral] of ARABIC_TO_ROMAN) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }

  return result;
}

/**
 * Parsuje numer sesji z tekstu (obsługuje arabskie i rzymskie)
 * @param value - tekst zawierający numer (np. "23", "XXIII")
 * @returns numer sesji lub null jeśli nie rozpoznano
 */
export function parseSessionNumber(value: string): number | null {
  if (!value) return null;

  const trimmed = value.trim();

  // Sprawdź czy to numer arabski
  const arabicNum = parseInt(trimmed, 10);
  if (!isNaN(arabicNum) && arabicNum > 0 && arabicNum <= 200) {
    return arabicNum;
  }

  // Spróbuj jako numer rzymski
  if (/^[IVXLC]+$/i.test(trimmed)) {
    const romanNum = romanToArabic(trimmed);
    if (romanNum > 0 && romanNum <= 200) {
      return romanNum;
    }
  }

  return null;
}

/**
 * Wyodrębnia numer sesji z tytułu/tekstu dokumentu
 * @param text - tekst do przeszukania
 * @returns numer sesji lub null
 */
export function extractSessionNumberFromText(text: string): number | null {
  if (!text) return null;

  // Wzorce dla numeru sesji (arabskie)
  const arabicPatterns = [
    /sesj[iaęy]\s+(?:nr\.?\s*)?(\d{1,3})/i,
    /(\d{1,3})\s*sesj/i,
  ];

  for (const pattern of arabicPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num <= 200) return num;
    }
  }

  // Wzorce dla numeru sesji (rzymskie)
  const romanPatterns = [
    /sesj[iaęy]\s+(?:nr\.?\s*)?([IVXLC]{1,10})/i,
    /([IVXLC]{1,10})\s*sesj/i,
    /nr\.?\s*([IVXLC]{1,10})/i,
  ];

  for (const pattern of romanPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const num = romanToArabic(match[1]);
      if (num > 0 && num <= 200) return num;
    }
  }

  return null;
}

/**
 * Generuje wszystkie warianty wyszukiwania dla numeru sesji
 * @param sessionNumber - numer sesji
 * @returns tablica wariantów tekstowych
 */
export function getSessionSearchVariants(sessionNumber: number): string[] {
  const roman = arabicToRoman(sessionNumber);
  const arabic = sessionNumber.toString();

  return [
    `Sesja ${arabic}`,
    `Sesja Nr ${arabic}`,
    `Sesji ${arabic}`,
    `Sesja ${roman}`,
    `Sesja Nr ${roman}`,
    `Sesji ${roman}`,
    `${roman} Sesja`,
    `Nr ${roman}`,
  ];
}
