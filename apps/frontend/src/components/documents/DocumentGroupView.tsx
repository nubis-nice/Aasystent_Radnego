"use client";

import { useState, memo, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Calendar,
  AlertTriangle,
  Brain,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { Document, DocumentPriority } from "@/lib/api/documents-list";
import type { DocumentGroup, GroupingResult } from "@/lib/documents/grouping";

// Normalizacja tytułu - usuwa śmieci i zamienia angielskie nazwy na polskie
function normalizeTitle(title: string | null | undefined): string {
  if (!title) return "Bez tytułu";
  return title
    .replace(/\s*\|.*$/g, "")
    .replace(/\s*-?\s*System\s+Rada.*$/gi, "")
    .replace(/\s*-?\s*BIP\s*.*$/gi, "")
    .replace(/\bresolution\s+nr\b/gi, "Uchwała nr")
    .replace(/\bresolution\b/gi, "Uchwała")
    .replace(/\bprotocol\b/gi, "Protokół")
    .replace(/\bdraft\b/gi, "Projekt")
    .replace(/\battachment\b/gi, "Załącznik")
    .replace(/\bsession\b/gi, "Sesja")
    .replace(/\s+/g, " ")
    .trim();
}

interface DocumentCardProps {
  doc: Document;
  onAnalyze?: (id: string) => void;
  isAnalyzing?: boolean;
  getPriorityStyles: (p: DocumentPriority | undefined) => {
    bg: string;
    border: string;
    badge: string;
    icon: string;
    label: string;
  };
  getDocumentTypeLabel: (type: string) => string;
}

const DocumentCard = memo(function DocumentCard({
  doc,
  onAnalyze,
  isAnalyzing,
  getPriorityStyles,
  getDocumentTypeLabel,
}: DocumentCardProps) {
  const priorityStyles = getPriorityStyles(doc.score?.priority);

  return (
    <div className="bg-white rounded-xl border border-border hover:border-primary-300 hover:shadow-md transition-all duration-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priorityStyles.badge} ${priorityStyles.border} border`}
            >
              {priorityStyles.label}
            </span>
            <span className="text-xs text-text-secondary bg-secondary-100 px-2 py-0.5 rounded-full">
              {getDocumentTypeLabel(doc.document_type)}
            </span>
          </div>

          <Link
            href={`/documents/${doc.id}`}
            className="text-lg font-semibold text-text hover:text-primary-600 line-clamp-2 block"
          >
            {normalizeTitle(doc.title)}
          </Link>

          {doc.summary && (
            <p className="text-sm text-text-secondary mt-2 line-clamp-2">
              {doc.summary}
            </p>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
            {doc.publish_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(doc.publish_date).toLocaleDateString("pl-PL")}
              </span>
            )}
            {doc.score && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Score: {doc.score.totalScore.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href={`/documents/${doc.id}`}
            className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
          >
            Szczegóły
          </Link>
          {onAnalyze && (
            <button
              onClick={() => onAnalyze(doc.id)}
              disabled={isAnalyzing}
              className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {isAnalyzing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Brain className="h-3 w-3" />
              )}
              Analizuj
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

interface GroupHeaderProps {
  group: DocumentGroup;
  isExpanded: boolean;
  onToggle: () => void;
  level?: number;
}

const GroupHeader = memo(function GroupHeader({
  group,
  isExpanded,
  onToggle,
  level = 0,
}: GroupHeaderProps) {
  const paddingLeft = level * 16;

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-secondary-50 to-white hover:from-secondary-100 rounded-xl transition-colors text-left ${
        level > 0 ? "border-l-4 border-primary-200" : ""
      }`}
      style={{ marginLeft: paddingLeft }}
    >
      <span className="text-xl">{group.icon}</span>
      <div className="flex-1">
        <span className="font-semibold text-text">{group.title}</span>
        <span className="ml-2 text-sm text-text-secondary">
          ({group.metadata?.count || group.documents.length}{" "}
          {(group.metadata?.count || group.documents.length) === 1
            ? "dokument"
            : "dokumentów"}
          )
        </span>
      </div>
      {isExpanded ? (
        <ChevronDown className="h-5 w-5 text-text-secondary" />
      ) : (
        <ChevronRight className="h-5 w-5 text-text-secondary" />
      )}
    </button>
  );
});

interface GroupContentProps {
  group: DocumentGroup;
  onAnalyze?: (id: string) => void;
  analyzingId?: string | null;
  getPriorityStyles: DocumentCardProps["getPriorityStyles"];
  getDocumentTypeLabel: DocumentCardProps["getDocumentTypeLabel"];
  level?: number;
  expandedGroups: Set<string>;
  onToggleGroup: (id: string) => void;
}

const GroupContent = memo(function GroupContent({
  group,
  onAnalyze,
  analyzingId,
  getPriorityStyles,
  getDocumentTypeLabel,
  level = 0,
  expandedGroups,
  onToggleGroup,
}: GroupContentProps) {
  const isExpanded = expandedGroups.has(group.id);
  const paddingLeft = level * 16;

  return (
    <div className="space-y-2" style={{ marginLeft: paddingLeft }}>
      <GroupHeader
        group={group}
        isExpanded={isExpanded}
        onToggle={() => onToggleGroup(group.id)}
        level={0}
      />

      {isExpanded && (
        <div className="space-y-3 pl-4 pt-2">
          {/* Podgrupy */}
          {group.subgroups?.map((subgroup) => (
            <GroupContent
              key={subgroup.id}
              group={subgroup}
              onAnalyze={onAnalyze}
              analyzingId={analyzingId}
              getPriorityStyles={getPriorityStyles}
              getDocumentTypeLabel={getDocumentTypeLabel}
              level={level + 1}
              expandedGroups={expandedGroups}
              onToggleGroup={onToggleGroup}
            />
          ))}

          {/* Dokumenty w grupie */}
          {group.documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onAnalyze={onAnalyze}
              isAnalyzing={analyzingId === doc.id}
              getPriorityStyles={getPriorityStyles}
              getDocumentTypeLabel={getDocumentTypeLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
});

interface DocumentGroupViewProps {
  groupingResult: GroupingResult;
  onAnalyze?: (id: string) => void;
  analyzingId?: string | null;
  getPriorityStyles: DocumentCardProps["getPriorityStyles"];
  getDocumentTypeLabel: DocumentCardProps["getDocumentTypeLabel"];
}

export function DocumentGroupView({
  groupingResult,
  onAnalyze,
  analyzingId,
  getPriorityStyles,
  getDocumentTypeLabel,
}: DocumentGroupViewProps) {
  // Inicjalizuj rozwinięte grupy
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();

    const addExpanded = (groups: DocumentGroup[]) => {
      for (const group of groups) {
        if (group.isExpanded !== false) {
          initial.add(group.id);
        }
        if (group.subgroups) {
          addExpanded(group.subgroups);
        }
      }
    };

    addExpanded(groupingResult.groups);
    return initial;
  });

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Płaska lista (brak grupowania)
  if (groupingResult.scheme === "flat") {
    return (
      <div className="space-y-3">
        {groupingResult.ungrouped.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            onAnalyze={onAnalyze}
            isAnalyzing={analyzingId === doc.id}
            getPriorityStyles={getPriorityStyles}
            getDocumentTypeLabel={getDocumentTypeLabel}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Grupy */}
      {groupingResult.groups.map((group) => (
        <GroupContent
          key={group.id}
          group={group}
          onAnalyze={onAnalyze}
          analyzingId={analyzingId}
          getPriorityStyles={getPriorityStyles}
          getDocumentTypeLabel={getDocumentTypeLabel}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
        />
      ))}

      {/* Dokumenty bez grupy */}
      {groupingResult.ungrouped.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-4 py-2 text-text-secondary">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">
              Pozostałe dokumenty ({groupingResult.ungrouped.length})
            </span>
          </div>
          <div className="space-y-3 pl-4">
            {groupingResult.ungrouped.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onAnalyze={onAnalyze}
                isAnalyzing={analyzingId === doc.id}
                getPriorityStyles={getPriorityStyles}
                getDocumentTypeLabel={getDocumentTypeLabel}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
