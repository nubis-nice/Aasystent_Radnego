/**
 * Utility functions for Roman numeral conversion
 * Zunifikowany moduł - używany w całej aplikacji
 */
/**
 * Konwertuje liczbę rzymską na arabską
 * @param roman - liczba rzymska (np. "XXIII")
 * @returns liczba arabska (np. 23) lub 0 jeśli nieprawidłowa
 */
export declare function romanToArabic(roman: string): number;
/**
 * Konwertuje liczbę arabską na rzymską
 * @param num - liczba arabska (np. 23)
 * @returns liczba rzymska (np. "XXIII") lub pusty string jeśli nieprawidłowa
 */
export declare function arabicToRoman(num: number): string;
/**
 * Parsuje numer sesji z tekstu (obsługuje arabskie i rzymskie)
 * @param value - tekst zawierający numer (np. "23", "XXIII")
 * @returns numer sesji lub null jeśli nie rozpoznano
 */
export declare function parseSessionNumber(value: string): number | null;
/**
 * Wyodrębnia numer sesji z tytułu/tekstu dokumentu
 * @param text - tekst do przeszukania
 * @returns numer sesji lub null
 */
export declare function extractSessionNumberFromText(text: string): number | null;
/**
 * Generuje wszystkie warianty wyszukiwania dla numeru sesji
 * @param sessionNumber - numer sesji
 * @returns tablica wariantów tekstowych
 */
export declare function getSessionSearchVariants(sessionNumber: number): string[];
//# sourceMappingURL=roman-numbers.d.ts.map