/**
 * TTS Text Processor - inteligentne przetwarzanie tekstu przed syntezą mowy
 *
 * Funkcje:
 * - Pomijanie bloków kodu
 * - Formatowanie liczb i dat
 * - Konwersja URL/emoji na tekst
 * - Skracanie długich odpowiedzi
 */

export interface TTSProcessingOptions {
  maxLength?: number; // Max długość tekstu (domyślnie 2000 znaków)
  skipCodeBlocks?: boolean; // Pomijaj bloki kodu (domyślnie true)
  skipUrls?: boolean; // Pomijaj URL-e (domyślnie true)
  expandAbbreviations?: boolean; // Rozwijaj skróty (domyślnie true)
  language?: "pl" | "en"; // Język (domyślnie pl)
}

const DEFAULT_OPTIONS: TTSProcessingOptions = {
  maxLength: 2000,
  skipCodeBlocks: true,
  skipUrls: true,
  expandAbbreviations: true,
  language: "pl",
};

// Polskie skróty do rozwinięcia
const POLISH_ABBREVIATIONS: Record<string, string> = {
  nr: "numer",
  "np.": "na przykład",
  "m.in.": "między innymi",
  "tj.": "to jest",
  "itd.": "i tak dalej",
  "itp.": "i tym podobne",
  "ww.": "wyżej wymieniony",
  pkt: "punkt",
  "ust.": "ustęp",
  "art.": "artykuł",
  zł: "złotych",
  "tys.": "tysięcy",
  mln: "milionów",
  mld: "miliardów",
  "ul.": "ulica",
  "al.": "aleja",
  "pl.": "plac",
  "os.": "osiedle",
  "r.": "roku",
  "w.": "wiek",
  "ok.": "około",
  "min.": "minimum",
  "max.": "maksimum",
  "godz.": "godzina",
  "pn.": "poniedziałek",
  "wt.": "wtorek",
  "śr.": "środa",
  "czw.": "czwartek",
  "pt.": "piątek",
  "sob.": "sobota",
  "niedz.": "niedziela",
};

// Emoji do tekstu
const EMOJI_TO_TEXT: Record<string, string> = {
  "✅": "zrobione",
  "❌": "nie",
  "⚠️": "uwaga",
  "📄": "dokument",
  "📁": "folder",
  "🔍": "szukaj",
  "💡": "wskazówka",
  "📌": "ważne",
  "🎯": "cel",
  "📊": "wykres",
  "📈": "wzrost",
  "📉": "spadek",
  "🏛️": "urząd",
  "📋": "lista",
  "✨": "",
  "🔥": "",
  "👍": "dobrze",
  "👎": "źle",
};

export class TTSTextProcessor {
  private options: TTSProcessingOptions;

  constructor(options: Partial<TTSProcessingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Główna metoda przetwarzania tekstu dla TTS
   */
  process(text: string): string {
    let processed = text;

    // 1. Usuń bloki kodu
    if (this.options.skipCodeBlocks) {
      processed = this.removeCodeBlocks(processed);
    }

    // 2. Usuń URL-e
    if (this.options.skipUrls) {
      processed = this.removeUrls(processed);
    }

    // 3. Konwertuj emoji na tekst
    processed = this.convertEmojis(processed);

    // 4. Rozwiń skróty
    if (this.options.expandAbbreviations) {
      processed = this.expandAbbreviations(processed);
    }

    // 5. Formatuj liczby
    processed = this.formatNumbers(processed);

    // 6. Formatuj daty
    processed = this.formatDates(processed);

    // 7. Wyczyść markdown
    processed = this.cleanMarkdown(processed);

    // 8. Normalizuj białe znaki
    processed = this.normalizeWhitespace(processed);

    // 9. Skróć jeśli za długie
    if (this.options.maxLength && processed.length > this.options.maxLength) {
      processed = this.truncateIntelligently(processed, this.options.maxLength);
    }

    return processed.trim();
  }

  /**
   * Usuń bloki kodu (``` ... ```) i inline code (` ... `)
   */
  private removeCodeBlocks(text: string): string {
    // Bloki kodu wieloliniowe
    let result = text.replace(/```[\s\S]*?```/g, " (pominięto kod) ");

    // Inline code
    result = result.replace(/`[^`]+`/g, " ");

    return result;
  }

  /**
   * Usuń URL-e i zamień na "link"
   */
  private removeUrls(text: string): string {
    // HTTP/HTTPS URLs
    let result = text.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi, " link ");

    // Markdown links [text](url)
    result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    return result;
  }

  /**
   * Konwertuj emoji na tekst
   */
  private convertEmojis(text: string): string {
    let result = text;

    for (const [emoji, replacement] of Object.entries(EMOJI_TO_TEXT)) {
      result = result.replace(
        new RegExp(emoji, "g"),
        replacement ? ` ${replacement} ` : " "
      );
    }

    // Usuń pozostałe emoji (podstawowe)
    result = result.replace(/[\u{1F600}-\u{1F64F}]/gu, "");
    result = result.replace(/[\u{1F300}-\u{1F5FF}]/gu, "");
    result = result.replace(/[\u{1F680}-\u{1F6FF}]/gu, "");
    result = result.replace(/[\u{2600}-\u{26FF}]/gu, "");
    result = result.replace(/[\u{2700}-\u{27BF}]/gu, "");

    return result;
  }

  /**
   * Rozwiń polskie skróty
   */
  private expandAbbreviations(text: string): string {
    let result = text;

    for (const [abbr, full] of Object.entries(POLISH_ABBREVIATIONS)) {
      // Case-insensitive replacement z zachowaniem granic słów
      const regex = new RegExp(`\\b${abbr.replace(".", "\\.")}`, "gi");
      result = result.replace(regex, full);
    }

    return result;
  }

  /**
   * Formatuj liczby dla lepszej wymowy
   */
  private formatNumbers(text: string): string {
    let result = text;

    // Duże liczby z separatorami (np. 1 000 000 -> milion)
    result = result.replace(/\b(\d{1,3})(?: (\d{3}))+\b/g, (match) => {
      const num = parseInt(match.replace(/ /g, ""), 10);
      return this.numberToPolishWords(num);
    });

    // Procenty
    result = result.replace(/(\d+(?:[.,]\d+)?)\s*%/g, "$1 procent");

    // Kwoty pieniężne
    result = result.replace(
      /(\d+(?:[.,]\d+)?)\s*(PLN|zł|złotych)/gi,
      "$1 złotych"
    );
    result = result.replace(/(\d+(?:[.,]\d+)?)\s*(EUR|€|euro)/gi, "$1 euro");
    result = result.replace(
      /(\d+(?:[.,]\d+)?)\s*(USD|\$|dolarów)/gi,
      "$1 dolarów"
    );

    return result;
  }

  /**
   * Konwertuj liczbę na polskie słowa (uproszczone)
   */
  private numberToPolishWords(num: number): string {
    if (num >= 1000000000) {
      const billions = Math.floor(num / 1000000000);
      return `${billions} ${billions === 1 ? "miliard" : "miliardów"}`;
    }
    if (num >= 1000000) {
      const millions = Math.floor(num / 1000000);
      return `${millions} ${millions === 1 ? "milion" : "milionów"}`;
    }
    if (num >= 1000) {
      const thousands = Math.floor(num / 1000);
      return `${thousands} ${thousands === 1 ? "tysiąc" : "tysięcy"}`;
    }
    return num.toString();
  }

  /**
   * Formatuj daty
   */
  private formatDates(text: string): string {
    const months = [
      "stycznia",
      "lutego",
      "marca",
      "kwietnia",
      "maja",
      "czerwca",
      "lipca",
      "sierpnia",
      "września",
      "października",
      "listopada",
      "grudnia",
    ];

    // Format DD.MM.YYYY lub DD-MM-YYYY
    return text.replace(
      /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/g,
      (_, day, month, year) => {
        const monthIndex = parseInt(month, 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          return `${parseInt(day, 10)} ${months[monthIndex]} ${year}`;
        }
        return _;
      }
    );
  }

  /**
   * Usuń formatowanie Markdown
   */
  private cleanMarkdown(text: string): string {
    let result = text;

    // Nagłówki
    result = result.replace(/^#{1,6}\s+/gm, "");

    // Bold i italic
    result = result.replace(/\*\*([^*]+)\*\*/g, "$1");
    result = result.replace(/\*([^*]+)\*/g, "$1");
    result = result.replace(/__([^_]+)__/g, "$1");
    result = result.replace(/_([^_]+)_/g, "$1");

    // Listy
    result = result.replace(/^[\s]*[-*+]\s+/gm, "");
    result = result.replace(/^[\s]*\d+\.\s+/gm, "");

    // Cytaty
    result = result.replace(/^>\s+/gm, "");

    // Linie poziome
    result = result.replace(/^[-*_]{3,}$/gm, "");

    // Tabele (uproszczone)
    result = result.replace(/\|/g, ", ");
    result = result.replace(/^[-:]+$/gm, "");

    return result;
  }

  /**
   * Normalizuj białe znaki
   */
  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n /g, "\n")
      .replace(/ \n/g, "\n");
  }

  /**
   * Inteligentne skracanie tekstu
   */
  private truncateIntelligently(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // Znajdź ostatnie zdanie przed limitem
    const truncated = text.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf(". "),
      truncated.lastIndexOf("! "),
      truncated.lastIndexOf("? "),
      truncated.lastIndexOf(".\n"),
      truncated.lastIndexOf("!\n"),
      truncated.lastIndexOf("?\n")
    );

    if (lastSentenceEnd > maxLength * 0.7) {
      return (
        truncated.substring(0, lastSentenceEnd + 1) +
        " Odpowiedź została skrócona."
      );
    }

    // Fallback - znajdź ostatnią spację
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > maxLength * 0.8) {
      return (
        truncated.substring(0, lastSpace) + "... Odpowiedź została skrócona."
      );
    }

    return truncated + "...";
  }

  /**
   * Wyodrębnij najważniejsze zdania (dla długich odpowiedzi)
   */
  extractKeySentences(text: string, maxSentences: number = 3): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    if (sentences.length <= maxSentences) {
      return text;
    }

    // Weź pierwsze i ostatnie zdania (zazwyczaj najważniejsze)
    const selected = [
      sentences[0],
      ...sentences.slice(1, maxSentences - 1),
      sentences[sentences.length - 1],
    ].slice(0, maxSentences);

    return selected.join(" ").trim();
  }
}

// Singleton instance
export const ttsTextProcessor = new TTSTextProcessor();
