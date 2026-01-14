import type { Document } from "@/lib/api/documents-list";

// Schematy grupowania dokumentów
export type GroupingScheme =
  | "flat" // Brak grupowania - płaska lista
  | "cascade" // Grupowanie kaskadowe: Sesje > Komisje > Dokumenty
  | "by_type" // Grupowanie według typu dokumentu
  | "by_date" // Grupowanie według daty (miesiąc/rok)
  | "by_reference" // Grupowanie według powiązań (referencje w treści)
  | "by_hierarchy"; // Grupowanie według hierarchii ważności (5 poziomów)

export interface DocumentGroup {
  id: string;
  title: string;
  icon: string;
  documents: Document[];
  subgroups?: DocumentGroup[];
  isExpanded?: boolean;
  metadata?: {
    count: number;
    dateRange?: { from: string; to: string };
    types?: string[];
  };
}

export interface GroupingResult {
  scheme: GroupingScheme;
  groups: DocumentGroup[];
  ungrouped: Document[];
  totalDocuments: number;
}

// Interfejs pomocniczy dla metadanych
interface DocMetadata {
  sessionInfo?: {
    sessionNumber: number;
    sessionType?: string;
  };
  documentType?: string;
  hierarchyLevel?: number;
  people?: {
    mentioned?: string[];
  };
}

// Wykryj typ sesji/komisji z metadanych lub tytułu
function detectSessionType(doc: Document): "session" | "committee" | "other" {
  const meta = doc.metadata as unknown as DocMetadata;
  const title = doc.title.toLowerCase();

  // 1. Sprawdź metadane
  if (meta?.sessionInfo?.sessionNumber) {
    return "session";
  }
  if (
    meta?.documentType === "committee_opinion" ||
    meta?.documentType === "commission_protocol"
  ) {
    return "committee";
  }

  // 2. Fallback do tytułu
  if (title.includes("sesja") || title.includes("sesji")) {
    return "session";
  }
  if (title.includes("komisj") || title.includes("komitet")) {
    return "committee";
  }
  return "other";
}

// Wyodrębnij numer sesji z metadanych lub tytułu
function extractSessionNumber(doc: Document): string | null {
  const meta = doc.metadata as unknown as DocMetadata;

  // 1. Sprawdź metadane
  if (meta?.sessionInfo?.sessionNumber) {
    return meta.sessionInfo.sessionNumber.toString();
  }

  // 2. Fallback do tytułu
  const title = doc.title;
  const patterns = [
    /([IVXLCDM]+)\s*sesj/i,
    /sesj[aei]\s*n?r?\.?\s*(\d+)/i,
    /(\d+)\.?\s*sesj/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Wyodrębnij nazwę komisji z tytułu
function extractCommitteeName(title: string): string | null {
  const patterns = [
    /komisj[aei]\s+(.+?)(?:\s+w\s+dniu|\s+z\s+dnia|\s*-|\s*$)/i,
    /posiedzeni[ae]\s+komisji\s+(.+?)(?:\s+w\s+dniu|\s+z\s+dnia|\s*-|\s*$)/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

// Grupowanie kaskadowe: Sesje Rady > Komisje > Inne dokumenty
export function groupCascade(documents: Document[]): GroupingResult {
  const sessions: Map<string, Document[]> = new Map(); // Mapa sesji po numerze
  const committees: Map<string, Document[]> = new Map();
  const otherDocs: Document[] = [];

  // Kategoryzuj dokumenty
  for (const doc of documents) {
    const sessionType = detectSessionType(doc);

    if (sessionType === "session") {
      const sessionNum = extractSessionNumber(doc);
      // Dokumenty bez numeru sesji trafiają do "Inne dokumenty"
      if (!sessionNum) {
        otherDocs.push(doc);
        continue;
      }
      const sessionKey = sessionNum;

      if (!sessions.has(sessionKey)) {
        sessions.set(sessionKey, []);
      }
      sessions.get(sessionKey)!.push(doc);
    } else if (sessionType === "committee") {
      const committeeName = extractCommitteeName(doc.title) || "Komisja";
      if (!committees.has(committeeName)) {
        committees.set(committeeName, []);
      }
      committees.get(committeeName)!.push(doc);
    } else {
      otherDocs.push(doc);
    }
  }

  // Twórz grupy sesji
  const sessionGroups: DocumentGroup[] = [];
  for (const [num, docs] of sessions) {
    // Znajdź datę sesji (najczęstszą lub najnowszą z dokumentów)
    docs.sort((a, b) =>
      (b.publish_date || "").localeCompare(a.publish_date || "")
    );
    const latestDate = docs[0]?.publish_date;

    // Próba konwersji rzymskich na arabskie dla sortowania
    let sortNum = parseInt(num);
    if (isNaN(sortNum)) sortNum = 0; // Dla rzymskich lub błędów

    sessionGroups.push({
      id: `session-${num}`,
      title: `Sesja ${num}`,
      icon: "🏛️",
      documents: docs,
      metadata: {
        count: docs.length,
        dateRange: latestDate
          ? { from: latestDate, to: latestDate }
          : undefined,
      },
    });
  }

  // Sortuj sesje: najpierw te z wyższym numerem (zakładając arabskie)
  // Jeśli numery są rzymskie, sortowanie alfabetyczne może być mylące, ale to fallback
  sessionGroups.sort((a, b) => {
    const numA = parseInt(a.title.replace("Sesja ", ""));
    const numB = parseInt(b.title.replace("Sesja ", ""));
    if (!isNaN(numA) && !isNaN(numB)) {
      return numB - numA; // Malejąco
    }
    return b.title.localeCompare(a.title);
  });

  // Twórz grupy komisji
  const committeeGroups: DocumentGroup[] = [];
  for (const [name, docs] of committees) {
    docs.sort((a, b) =>
      (b.publish_date || "").localeCompare(a.publish_date || "")
    );
    committeeGroups.push({
      id: `committee-${name.replace(/\s+/g, "-").toLowerCase()}`,
      title: `Komisja ${name}`,
      icon: "👥",
      documents: docs,
      metadata: {
        count: docs.length,
      },
    });
  }

  // Główna struktura
  const groups: DocumentGroup[] = [];

  if (sessionGroups.length > 0) {
    groups.push({
      id: "sessions-group",
      title: "Sesje Rady",
      icon: "🏛️",
      documents: [],
      subgroups: sessionGroups,
      isExpanded: true,
      metadata: {
        count: sessionGroups.reduce(
          (acc, g) => acc + (g.metadata?.count || 0),
          0
        ),
      },
    });
  }

  if (committeeGroups.length > 0) {
    groups.push({
      id: "committees-group",
      title: "Komisje",
      icon: "👥",
      documents: [],
      subgroups: committeeGroups,
      isExpanded: true,
      metadata: {
        count: committeeGroups.reduce((sum, g) => sum + g.documents.length, 0),
      },
    });
  }

  if (otherDocs.length > 0) {
    groups.push({
      id: "other-group",
      title: "Inne dokumenty",
      icon: "📄",
      documents: otherDocs,
      isExpanded: true,
      metadata: { count: otherDocs.length },
    });
  }

  return {
    scheme: "cascade",
    groups,
    ungrouped: [],
    totalDocuments: documents.length,
  };
}

// Grupowanie według typu dokumentu
export function groupByType(documents: Document[]): GroupingResult {
  const typeMap: Map<string, Document[]> = new Map();

  const typeLabels: Record<string, { label: string; icon: string }> = {
    // Poziom 1 - Krytyczne
    budget_act: { label: "Uchwały budżetowe", icon: "💰" },
    resolution: { label: "Uchwały", icon: "📜" },
    session_order: { label: "Porządki obrad", icon: "📋" },
    // Poziom 2 - Wysokie
    resolution_project: { label: "Projekty uchwał", icon: "📝" },
    protocol: { label: "Protokoły", icon: "📋" },
    interpellation: { label: "Interpelacje", icon: "❓" },
    transcription: { label: "Transkrypcje", icon: "🎙️" },
    // Poziom 3 - Średnie
    video: { label: "Nagrania wideo", icon: "🎬" },
    committee_opinion: { label: "Opinie komisji", icon: "👥" },
    justification: { label: "Uzasadnienia", icon: "📑" },
    session_materials: { label: "Materiały sesyjne", icon: "📁" },
    // Poziom 4 - Niskie
    order: { label: "Zarządzenia", icon: "📋" },
    announcement: { label: "Ogłoszenia", icon: "📢" },
    // Poziom 5 - Tło
    attachment: { label: "Załączniki", icon: "📎" },
    reference_material: { label: "Materiały referencyjne", icon: "📚" },
    news: { label: "Aktualności", icon: "📰" },
    report: { label: "Raporty", icon: "📊" },
    opinion: { label: "Opinie", icon: "💭" },
    motion: { label: "Wnioski", icon: "✍️" },
    article: { label: "Artykuły", icon: "📝" },
    other: { label: "Inne", icon: "📄" },
  };

  for (const doc of documents) {
    const type = doc.document_type || "other";
    if (!typeMap.has(type)) {
      typeMap.set(type, []);
    }
    typeMap.get(type)!.push(doc);
  }

  const groups: DocumentGroup[] = [];
  for (const [type, docs] of typeMap) {
    const info = typeLabels[type] || { label: type, icon: "📄" };
    docs.sort((a, b) =>
      (b.publish_date || "").localeCompare(a.publish_date || "")
    );
    groups.push({
      id: `type-${type}`,
      title: info.label,
      icon: info.icon,
      documents: docs,
      isExpanded: true,
      metadata: { count: docs.length },
    });
  }

  // Sortuj grupy według liczby dokumentów
  groups.sort((a, b) => (b.metadata?.count || 0) - (a.metadata?.count || 0));

  return {
    scheme: "by_type",
    groups,
    ungrouped: [],
    totalDocuments: documents.length,
  };
}

// Grupowanie według daty (miesiąc/rok)
export function groupByDate(documents: Document[]): GroupingResult {
  const monthMap: Map<string, Document[]> = new Map();
  const noDate: Document[] = [];

  for (const doc of documents) {
    if (doc.publish_date) {
      const date = new Date(doc.publish_date);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, []);
      }
      monthMap.get(monthKey)!.push(doc);
    } else {
      noDate.push(doc);
    }
  }

  const groups: DocumentGroup[] = [];
  const sortedMonths = Array.from(monthMap.keys()).sort().reverse();

  const monthNames = [
    "Styczeń",
    "Luty",
    "Marzec",
    "Kwiecień",
    "Maj",
    "Czerwiec",
    "Lipiec",
    "Sierpień",
    "Wrzesień",
    "Październik",
    "Listopad",
    "Grudzień",
  ];

  for (const monthKey of sortedMonths) {
    const [year, month] = monthKey.split("-");
    const monthName = monthNames[parseInt(month) - 1];
    const docs = monthMap.get(monthKey)!;
    docs.sort((a, b) =>
      (b.publish_date || "").localeCompare(a.publish_date || "")
    );

    groups.push({
      id: `date-${monthKey}`,
      title: `${monthName} ${year}`,
      icon: "📅",
      documents: docs,
      isExpanded: groups.length < 3, // Rozwiń tylko 3 najnowsze
      metadata: { count: docs.length },
    });
  }

  return {
    scheme: "by_date",
    groups,
    ungrouped: noDate,
    totalDocuments: documents.length,
  };
}

// Wykryj referencje do innych dokumentów w treści
function findReferences(content: string): string[] {
  const references: string[] = [];

  // Wzorce referencji: "Uchwała nr ...", "Druk nr ...", "Protokół z ..."
  const patterns = [
    /uchwa[łl][aęy]\s+n?r?\.?\s*([IVXLCDM\d]+[\/\-]?\d*)/gi,
    /druk\s+n?r?\.?\s*([IVXLCDM\d]+[\/\-]?\d*)/gi,
    /protoko[łl]\s+(?:z|nr\.?)\s*([^,\.]+)/gi,
    /za[łl][aą]cznik\s+n?r?\.?\s*(\d+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      references.push(match[0].trim());
    }
  }

  return [...new Set(references)]; // Usuń duplikaty
}

// Grupowanie według powiązań (dokumenty referencyjne)
export function groupByReference(documents: Document[]): GroupingResult {
  const referenceMap: Map<string, { doc: Document; refs: string[] }> =
    new Map();
  const clusters: Map<string, Document[]> = new Map();
  const standalone: Document[] = [];

  // Znajdź referencje dla każdego dokumentu
  for (const doc of documents) {
    const refs = findReferences(doc.content || "");
    referenceMap.set(doc.id, { doc, refs });
  }

  // Twórz klastry na podstawie wspólnych referencji
  const processed = new Set<string>();

  for (const [id, { doc, refs }] of referenceMap) {
    if (processed.has(id)) continue;

    if (refs.length === 0) {
      standalone.push(doc);
      processed.add(id);
      continue;
    }

    // Znajdź dokumenty z podobnymi referencjami
    const cluster: Document[] = [doc];
    processed.add(id);

    for (const [otherId, { doc: otherDoc, refs: otherRefs }] of referenceMap) {
      if (processed.has(otherId)) continue;

      // Sprawdź czy mają wspólne referencje
      const commonRefs = refs.filter((r) =>
        otherRefs.some(
          (or) =>
            or.toLowerCase().includes(r.toLowerCase()) ||
            r.toLowerCase().includes(or.toLowerCase())
        )
      );

      if (commonRefs.length > 0) {
        cluster.push(otherDoc);
        processed.add(otherId);
      }
    }

    if (cluster.length > 1) {
      const clusterId = `cluster-${id}`;
      clusters.set(clusterId, cluster);
    } else {
      standalone.push(doc);
    }
  }

  const groups: DocumentGroup[] = [];

  for (const [clusterId, docs] of clusters) {
    docs.sort((a, b) =>
      (b.publish_date || "").localeCompare(a.publish_date || "")
    );
    const mainDoc = docs[0];
    groups.push({
      id: clusterId,
      title: `Powiązane: ${mainDoc.title.substring(0, 50)}...`,
      icon: "🔗",
      documents: docs,
      isExpanded: true,
      metadata: { count: docs.length },
    });
  }

  // Sortuj klastry według liczby dokumentów
  groups.sort((a, b) => (b.metadata?.count || 0) - (a.metadata?.count || 0));

  return {
    scheme: "by_reference",
    groups,
    ungrouped: standalone,
    totalDocuments: documents.length,
  };
}

// Mapowanie typów dokumentów na poziomy hierarchii
const HIERARCHY_LEVELS: Record<string, number> = {
  budget_act: 1,
  resolution: 1,
  session_order: 1,
  resolution_project: 2,
  protocol: 2,
  interpellation: 2,
  transcription: 2,
  video: 3,
  committee_opinion: 3,
  justification: 3,
  session_materials: 3,
  order: 4,
  announcement: 4,
  attachment: 5,
  reference_material: 5,
  news: 5,
  report: 5,
  opinion: 5,
  motion: 5,
  other: 5,
};

// Grupowanie według hierarchii ważności (5 poziomów)
export function groupByHierarchy(documents: Document[]): GroupingResult {
  const levelMap: Map<number, Document[]> = new Map();

  const levelLabels: Record<number, { label: string; icon: string }> = {
    1: { label: "🔴 Krytyczne (Budżet, Uchwały, Porządek)", icon: "🔴" },
    2: { label: "🟠 Wysokie (Projekty, Protokoły, Interpelacje)", icon: "🟠" },
    3: { label: "🟡 Średnie (Wideo, Opinie, Materiały)", icon: "🟡" },
    4: { label: "🔵 Niskie (Zarządzenia, Ogłoszenia)", icon: "🔵" },
    5: { label: "⚪ Tło (Załączniki, Inne)", icon: "⚪" },
  };

  for (const doc of documents) {
    const docType = doc.document_type || "other";
    const level = HIERARCHY_LEVELS[docType] || 5;
    if (!levelMap.has(level)) {
      levelMap.set(level, []);
    }
    levelMap.get(level)!.push(doc);
  }

  const groups: DocumentGroup[] = [];
  // Sortuj poziomy rosnąco (1 = najważniejsze na górze)
  const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);

  for (const level of sortedLevels) {
    const docs = levelMap.get(level)!;
    const info = levelLabels[level] || { label: `Poziom ${level}`, icon: "📄" };

    // Sortuj dokumenty w grupie według daty
    docs.sort((a, b) =>
      (b.publish_date || "").localeCompare(a.publish_date || "")
    );

    groups.push({
      id: `hierarchy-${level}`,
      title: info.label,
      icon: info.icon,
      documents: docs,
      isExpanded: level <= 2, // Rozwiń tylko krytyczne i wysokie
      metadata: { count: docs.length },
    });
  }

  return {
    scheme: "by_hierarchy",
    groups,
    ungrouped: [],
    totalDocuments: documents.length,
  };
}

// Główna funkcja grupowania
export function groupDocuments(
  documents: Document[],
  scheme: GroupingScheme,
  sortBy: string = "date",
  sortOrder: "asc" | "desc" = "desc"
): GroupingResult {
  // Funkcja wyciągająca numer z tytułu (np. "Sesja 23", "Uchwała nr 45/2024")
  const extractNumber = (title: string): number => {
    // Szukaj numerów: rzymskich lub arabskich
    const patterns = [
      /(?:nr|numer|sesja|uchwała)[\s.:]*(\d+)/i,
      /(\d+)(?:\/\d+)?/,
      /([IVXLCDM]+)\s*(?:sesj|uchwal)/i,
    ];
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        const num = match[1];
        // Konwersja rzymskich na arabskie (uproszczona)
        if (/^[IVXLCDM]+$/i.test(num)) {
          const roman: Record<string, number> = {
            I: 1,
            V: 5,
            X: 10,
            L: 50,
            C: 100,
            D: 500,
            M: 1000,
          };
          let result = 0,
            prev = 0;
          for (const char of num.toUpperCase().split("").reverse()) {
            const val = roman[char] || 0;
            result += val < prev ? -val : val;
            prev = val;
          }
          return result;
        }
        return parseInt(num) || 0;
      }
    }
    return 0;
  };

  // Najpierw sortuj dokumenty
  const sortedDocs = [...documents].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "date":
        comparison = (a.publish_date || "").localeCompare(b.publish_date || "");
        break;
      case "title":
        comparison = a.title.localeCompare(b.title, "pl");
        break;
      case "number":
        comparison = extractNumber(a.title) - extractNumber(b.title);
        break;
      case "score":
        comparison = (a.score?.totalScore || 0) - (b.score?.totalScore || 0);
        break;
      default:
        comparison = (a.publish_date || "").localeCompare(b.publish_date || "");
    }

    return sortOrder === "desc" ? -comparison : comparison;
  });

  switch (scheme) {
    case "cascade":
      return groupCascade(sortedDocs);
    case "by_type":
      return groupByType(sortedDocs);
    case "by_date":
      return groupByDate(sortedDocs);
    case "by_reference":
      return groupByReference(sortedDocs);
    case "by_hierarchy":
      return groupByHierarchy(sortedDocs);
    case "flat":
    default:
      return {
        scheme: "flat",
        groups: [],
        ungrouped: sortedDocs,
        totalDocuments: sortedDocs.length,
      };
  }
}

// Etykiety schematów grupowania
export const GROUPING_SCHEME_LABELS: Record<
  GroupingScheme,
  { label: string; icon: string; description: string }
> = {
  flat: {
    label: "Płaska lista",
    icon: "📋",
    description: "Wszystkie dokumenty w jednej liście",
  },
  cascade: {
    label: "Kaskadowe (Sesje/Komisje)",
    icon: "🏛️",
    description: "Grupowanie: Sesje Rady > Komisje > Inne",
  },
  by_type: {
    label: "Według typu",
    icon: "📁",
    description: "Grupowanie według typu dokumentu",
  },
  by_date: {
    label: "Według daty",
    icon: "📅",
    description: "Grupowanie według miesiąca publikacji",
  },
  by_reference: {
    label: "Powiązane dokumenty",
    icon: "🔗",
    description: "Grupowanie według referencji w treści",
  },
  by_hierarchy: {
    label: "Według ważności",
    icon: "⭐",
    description:
      "Grupowanie według hierarchii: Krytyczne > Ważne > Standardowe > Niskie > Tło",
  },
};
