import type { Document } from "@/lib/api/documents-list";

// Schematy grupowania dokumentów
export type GroupingScheme =
  | "flat" // Brak grupowania - płaska lista
  | "cascade" // Grupowanie kaskadowe: Sesje > Komisje > Dokumenty
  | "by_type" // Grupowanie według typu dokumentu
  | "by_date" // Grupowanie według daty (miesiąc/rok)
  | "by_reference"; // Grupowanie według powiązań (referencje w treści)

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

// Wykryj typ sesji/komisji z tytułu dokumentu
function detectSessionType(title: string): "session" | "committee" | "other" {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes("sesja") || lowerTitle.includes("sesji")) {
    return "session";
  }
  if (lowerTitle.includes("komisj") || lowerTitle.includes("komitet")) {
    return "committee";
  }
  return "other";
}

// Wyodrębnij numer sesji z tytułu
function extractSessionNumber(title: string): string | null {
  // Wzorce: "LXXX Sesja", "Sesja nr 80", "80. sesja"
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
  const sessions: DocumentGroup[] = [];
  const committees: Map<string, Document[]> = new Map();
  const otherDocs: Document[] = [];

  // Kategoryzuj dokumenty
  for (const doc of documents) {
    const sessionType = detectSessionType(doc.title);

    if (sessionType === "session") {
      const sessionNum = extractSessionNumber(doc.title) || "Sesja";
      sessions.push({
        id: `session-${doc.id}`,
        title: doc.title,
        icon: "🏛️",
        documents: [doc],
        metadata: {
          count: 1,
          dateRange: doc.publish_date
            ? { from: doc.publish_date, to: doc.publish_date }
            : undefined,
        },
      });
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

  // Sortuj sesje według daty (najnowsze pierwsze)
  sessions.sort((a, b) => {
    const dateA = a.documents[0]?.publish_date || "";
    const dateB = b.documents[0]?.publish_date || "";
    return dateB.localeCompare(dateA);
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

  if (sessions.length > 0) {
    groups.push({
      id: "sessions-group",
      title: "Sesje Rady",
      icon: "🏛️",
      documents: [],
      subgroups: sessions,
      isExpanded: true,
      metadata: { count: sessions.length },
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
    resolution: { label: "Uchwały", icon: "📜" },
    protocol: { label: "Protokoły", icon: "📋" },
    news: { label: "Aktualności", icon: "📰" },
    announcement: { label: "Ogłoszenia", icon: "📢" },
    article: { label: "Artykuły", icon: "📝" },
    report: { label: "Raporty", icon: "📊" },
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

  let clusterIndex = 1;
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
    clusterIndex++;
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

// Główna funkcja grupowania
export function groupDocuments(
  documents: Document[],
  scheme: GroupingScheme,
  sortBy: string = "date",
  sortOrder: "asc" | "desc" = "desc"
): GroupingResult {
  // Najpierw sortuj dokumenty
  const sortedDocs = [...documents].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "date":
      case "session":
        comparison = (a.publish_date || "").localeCompare(b.publish_date || "");
        break;
      case "title":
        comparison = a.title.localeCompare(b.title);
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
};
