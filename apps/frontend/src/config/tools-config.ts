/**
 * Konfiguracja narzędzi ChatAI
 * Uniwersalna konfiguracja dla wszystkich quick_tools
 */

import {
  Mic,
  FileEdit,
  FileText,
  Wallet,
  ClipboardList,
  Scale,
  BarChart3,
  Send,
  Video,
} from "lucide-react";

export type ToolType =
  | "speech"
  | "interpelation"
  | "letter"
  | "protocol"
  | "budget"
  | "application"
  | "resolution"
  | "report"
  | "script";

export interface ToolFieldConfig {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string | number;
}

export interface ToolConfig {
  id: ToolType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  fields: ToolFieldConfig[];
  generateButtonLabel: string;
  outputSections: string[];
}

export const TOOLS_CONFIG: Record<ToolType, ToolConfig> = {
  speech: {
    id: "speech",
    name: "Plan wystąpienia",
    description: "Przygotuj strukturę wystąpienia na sesji rady",
    icon: Mic,
    color: "from-purple-500 to-purple-600",
    fields: [
      {
        id: "topic",
        label: "Temat wystąpienia",
        type: "text",
        placeholder: "np. Budżet gminy na 2025 rok",
        required: true,
      },
      {
        id: "context",
        label: "Kontekst / dodatkowe informacje",
        type: "textarea",
        placeholder: "Opisz kontekst, kluczowe punkty do poruszenia...",
      },
      {
        id: "duration",
        label: "Czas wystąpienia",
        type: "select",
        options: [
          { value: "3", label: "3 minuty" },
          { value: "5", label: "5 minut" },
          { value: "10", label: "10 minut" },
          { value: "15", label: "15 minut" },
          { value: "20", label: "20 minut" },
        ],
        defaultValue: "5",
      },
      {
        id: "tone",
        label: "Ton wystąpienia",
        type: "select",
        options: [
          { value: "formal", label: "Formalny" },
          { value: "persuasive", label: "Przekonujący" },
          { value: "informative", label: "Informacyjny" },
          { value: "critical", label: "Krytyczny" },
        ],
        defaultValue: "formal",
      },
    ],
    generateButtonLabel: "Generuj plan wystąpienia",
    outputSections: [
      "Wstęp",
      "Teza główna",
      "Argumentacja",
      "Kontrargumenty",
      "Wnioski",
      "Zakończenie",
    ],
  },

  interpelation: {
    id: "interpelation",
    name: "Interpelacja radnego",
    description: "Kreator interpelacji do organów gminy",
    icon: FileEdit,
    color: "from-indigo-500 to-indigo-600",
    fields: [
      {
        id: "recipient",
        label: "Adresat",
        type: "select",
        options: [
          { value: "burmistrz", label: "Burmistrz" },
          { value: "wójt", label: "Wójt" },
          { value: "prezydent", label: "Prezydent miasta" },
          { value: "starosta", label: "Starosta" },
        ],
        defaultValue: "burmistrz",
        required: true,
      },
      {
        id: "topic",
        label: "Temat interpelacji",
        type: "text",
        placeholder: "np. Stan dróg gminnych",
        required: true,
      },
      {
        id: "justification",
        label: "Uzasadnienie",
        type: "textarea",
        placeholder: "Opisz problem, przyczyny złożenia interpelacji...",
        required: true,
      },
      {
        id: "questions",
        label: "Pytania do organu",
        type: "textarea",
        placeholder: "Jakie pytania chcesz zadać? (każde w nowej linii)",
      },
    ],
    generateButtonLabel: "Generuj interpelację",
    outputSections: [
      "Nagłówek",
      "Wprowadzenie",
      "Uzasadnienie",
      "Pytania",
      "Żądanie odpowiedzi",
    ],
  },

  letter: {
    id: "letter",
    name: "Pismo urzędowe",
    description: "Generator pism i korespondencji urzędowej",
    icon: FileText,
    color: "from-blue-500 to-blue-600",
    fields: [
      {
        id: "letterType",
        label: "Typ pisma",
        type: "select",
        options: [
          { value: "request", label: "Wniosek" },
          { value: "complaint", label: "Skarga" },
          { value: "appeal", label: "Odwołanie" },
          { value: "notification", label: "Zawiadomienie" },
          { value: "opinion", label: "Opinia" },
          { value: "response", label: "Odpowiedź" },
        ],
        defaultValue: "request",
        required: true,
      },
      {
        id: "recipient",
        label: "Adresat",
        type: "text",
        placeholder: "np. Urząd Gminy w Drawnie",
        required: true,
      },
      {
        id: "subject",
        label: "Temat pisma",
        type: "text",
        placeholder: "np. Wniosek o udostępnienie informacji publicznej",
        required: true,
      },
      {
        id: "content",
        label: "Treść / kluczowe punkty",
        type: "textarea",
        placeholder: "Opisz czego dotyczy pismo...",
        required: true,
      },
    ],
    generateButtonLabel: "Generuj pismo",
    outputSections: [
      "Nagłówek",
      "Dane adresata",
      "Treść pisma",
      "Uzasadnienie",
      "Podpis",
    ],
  },

  protocol: {
    id: "protocol",
    name: "Protokół z posiedzenia",
    description: "Generator protokołów z sesji i komisji",
    icon: ClipboardList,
    color: "from-emerald-500 to-emerald-600",
    fields: [
      {
        id: "meetingType",
        label: "Typ posiedzenia",
        type: "select",
        options: [
          { value: "session", label: "Sesja Rady" },
          { value: "committee", label: "Komisja" },
          { value: "board", label: "Zarząd" },
          { value: "meeting", label: "Spotkanie robocze" },
        ],
        defaultValue: "session",
        required: true,
      },
      {
        id: "date",
        label: "Data posiedzenia",
        type: "text",
        placeholder: "np. 15 stycznia 2025",
        required: true,
      },
      {
        id: "participants",
        label: "Uczestnicy",
        type: "textarea",
        placeholder: "Lista uczestników (każdy w nowej linii)",
      },
      {
        id: "notes",
        label: "Notatki z przebiegu",
        type: "textarea",
        placeholder: "Twoje notatki z posiedzenia...",
        required: true,
      },
    ],
    generateButtonLabel: "Generuj protokół",
    outputSections: [
      "Nagłówek",
      "Lista obecności",
      "Porządek obrad",
      "Przebieg posiedzenia",
      "Podjęte uchwały/ustalenia",
      "Zakończenie",
    ],
  },

  budget: {
    id: "budget",
    name: "Analiza budżetu",
    description: "Analiza i porównanie danych budżetowych",
    icon: Wallet,
    color: "from-orange-500 to-orange-600",
    fields: [
      {
        id: "year",
        label: "Rok budżetowy",
        type: "text",
        placeholder: "np. 2025",
        required: true,
      },
      {
        id: "analysisType",
        label: "Typ analizy",
        type: "select",
        options: [
          { value: "overview", label: "Przegląd ogólny" },
          { value: "comparison", label: "Porównanie z poprzednim rokiem" },
          { value: "category", label: "Analiza kategorii wydatków" },
          { value: "investment", label: "Analiza inwestycji" },
        ],
        defaultValue: "overview",
        required: true,
      },
      {
        id: "focus",
        label: "Obszar szczególnego zainteresowania",
        type: "textarea",
        placeholder: "np. wydatki na oświatę, inwestycje drogowe...",
      },
      {
        id: "questions",
        label: "Konkretne pytania",
        type: "textarea",
        placeholder: "Jakie pytania dotyczące budżetu chcesz wyjaśnić?",
      },
    ],
    generateButtonLabel: "Analizuj budżet",
    outputSections: [
      "Podsumowanie",
      "Kluczowe dane",
      "Analiza szczegółowa",
      "Wnioski",
      "Rekomendacje",
    ],
  },

  application: {
    id: "application",
    name: "Wniosek",
    description: "Kreator wniosków formalnych",
    icon: Send,
    color: "from-cyan-500 to-cyan-600",
    fields: [
      {
        id: "applicationType",
        label: "Typ wniosku",
        type: "select",
        options: [
          { value: "information", label: "O udostępnienie informacji" },
          { value: "subsidy", label: "O dotację/dofinansowanie" },
          { value: "permission", label: "O pozwolenie/zgodę" },
          { value: "change", label: "O zmianę/korektę" },
          { value: "other", label: "Inny" },
        ],
        defaultValue: "information",
        required: true,
      },
      {
        id: "recipient",
        label: "Organ do którego kierowany",
        type: "text",
        placeholder: "np. Burmistrz Drawna",
        required: true,
      },
      {
        id: "subject",
        label: "Przedmiot wniosku",
        type: "text",
        placeholder: "Czego dotyczy wniosek?",
        required: true,
      },
      {
        id: "justification",
        label: "Uzasadnienie",
        type: "textarea",
        placeholder: "Uzasadnij swój wniosek...",
        required: true,
      },
      {
        id: "legalBasis",
        label: "Podstawa prawna (opcjonalnie)",
        type: "text",
        placeholder: "np. Art. 2 ustawy o dostępie do informacji publicznej",
      },
    ],
    generateButtonLabel: "Generuj wniosek",
    outputSections: [
      "Nagłówek",
      "Treść wniosku",
      "Uzasadnienie",
      "Podstawa prawna",
      "Podpis",
    ],
  },

  resolution: {
    id: "resolution",
    name: "Projekt uchwały",
    description: "Generator projektów uchwał rady",
    icon: Scale,
    color: "from-rose-500 to-rose-600",
    fields: [
      {
        id: "title",
        label: "Tytuł uchwały",
        type: "text",
        placeholder: "np. w sprawie ustalenia opłaty miejscowej",
        required: true,
      },
      {
        id: "legalBasis",
        label: "Podstawa prawna",
        type: "textarea",
        placeholder:
          "Podstawy prawne (ustawy, rozporządzenia)...\nnp. Art. 18 ust. 2 pkt 8 ustawy o samorządzie gminnym",
        required: true,
      },
      {
        id: "content",
        label: "Główna treść/założenia",
        type: "textarea",
        placeholder: "Opisz co ma regulować uchwała...",
        required: true,
      },
      {
        id: "justification",
        label: "Uzasadnienie",
        type: "textarea",
        placeholder: "Uzasadnienie potrzeby podjęcia uchwały...",
      },
    ],
    generateButtonLabel: "Generuj projekt uchwały",
    outputSections: [
      "Tytuł",
      "Preambuła",
      "Postanowienia (§1, §2...)",
      "Przepisy końcowe",
      "Uzasadnienie",
    ],
  },

  report: {
    id: "report",
    name: "Raport/Sprawozdanie",
    description: "Generator raportów i sprawozdań",
    icon: BarChart3,
    color: "from-amber-500 to-amber-600",
    fields: [
      {
        id: "reportType",
        label: "Typ raportu",
        type: "select",
        options: [
          { value: "control", label: "Raport z kontroli" },
          { value: "activity", label: "Sprawozdanie z działalności" },
          { value: "analysis", label: "Raport analityczny" },
          { value: "summary", label: "Podsumowanie okresu" },
        ],
        defaultValue: "analysis",
        required: true,
      },
      {
        id: "subject",
        label: "Przedmiot raportu",
        type: "text",
        placeholder: "np. Realizacja budżetu za I kwartał 2025",
        required: true,
      },
      {
        id: "period",
        label: "Okres objęty raportem",
        type: "text",
        placeholder: "np. styczeń-marzec 2025",
      },
      {
        id: "data",
        label: "Dane wejściowe / źródła",
        type: "textarea",
        placeholder: "Opisz dane, które mają być uwzględnione w raporcie...",
        required: true,
      },
      {
        id: "conclusions",
        label: "Oczekiwane wnioski/rekomendacje",
        type: "textarea",
        placeholder: "Jakie wnioski lub rekomendacje powinien zawierać raport?",
      },
    ],
    generateButtonLabel: "Generuj raport",
    outputSections: [
      "Streszczenie wykonawcze",
      "Wprowadzenie",
      "Metodologia",
      "Analiza danych",
      "Wnioski",
      "Rekomendacje",
    ],
  },

  script: {
    id: "script",
    name: "Scenopis na rolkę",
    description: "Generator scenopisów na YouTube Shorts/TikTok/Reels",
    icon: Video,
    color: "from-red-500 to-red-600",
    fields: [
      {
        id: "platform",
        label: "Platforma",
        type: "select",
        options: [
          { value: "tiktok", label: "TikTok" },
          { value: "youtube", label: "YouTube Shorts" },
          { value: "reels", label: "Instagram Reels" },
          { value: "all", label: "Uniwersalny" },
        ],
        defaultValue: "all",
        required: true,
      },
      {
        id: "topic",
        label: "Temat rolki",
        type: "text",
        placeholder: "np. Co zmieniło się w budżecie gminy?",
        required: true,
      },
      {
        id: "duration",
        label: "Długość",
        type: "select",
        options: [
          { value: "15", label: "15 sekund" },
          { value: "30", label: "30 sekund" },
          { value: "60", label: "60 sekund" },
          { value: "90", label: "90 sekund" },
        ],
        defaultValue: "60",
      },
      {
        id: "style",
        label: "Styl",
        type: "select",
        options: [
          { value: "educational", label: "Edukacyjny" },
          { value: "news", label: "Informacyjny/News" },
          { value: "storytelling", label: "Storytelling" },
          { value: "explainer", label: "Wyjaśniający" },
        ],
        defaultValue: "educational",
      },
      {
        id: "context",
        label: "Dodatkowy kontekst / kluczowe punkty",
        type: "textarea",
        placeholder: "Jakie informacje mają być zawarte? Jakie dane/fakty?",
      },
      {
        id: "callToAction",
        label: "Call to Action",
        type: "text",
        placeholder: "np. Obserwuj, skomentuj, udostępnij",
      },
    ],
    generateButtonLabel: "Generuj scenopis",
    outputSections: [
      "Hook (pierwsze 3 sekundy)",
      "Treść główna",
      "Wizualizacje/Kadr",
      "Tekst na ekranie",
      "Call to Action",
      "Hashtagi",
    ],
  },
};

export const VALID_TOOL_TYPES = Object.keys(TOOLS_CONFIG) as ToolType[];

export function getToolConfig(toolType: ToolType): ToolConfig | undefined {
  return TOOLS_CONFIG[toolType];
}

export function isValidToolType(type: string): type is ToolType {
  return VALID_TOOL_TYPES.includes(type as ToolType);
}
