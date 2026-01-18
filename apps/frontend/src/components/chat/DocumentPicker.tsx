"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  X,
  Plus,
  Check,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useVoice, AttachedDocument } from "@/contexts/VoiceContext";

interface Document {
  id: string;
  title: string;
  content: string;
  document_type?: string;
  source_url?: string;
  created_at: string;
}

interface DocumentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (doc: AttachedDocument) => void;
}

export function DocumentPicker({
  isOpen,
  onClose,
  onSelect,
}: DocumentPickerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { attachDocument, attachedDocuments } = useVoice();

  // Pobierz dokumenty z bazy
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("processed_documents")
        .select("id, title, content, document_type, source_url, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (searchQuery.trim()) {
        query = query.ilike("title", `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("[DocumentPicker] Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
      // Ustaw już załączone dokumenty jako wybrane
      setSelectedIds(new Set(attachedDocuments.map((d) => d.id)));
    }
  }, [isOpen, fetchDocuments, attachedDocuments]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        fetchDocuments();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, fetchDocuments]);

  const handleSelect = (doc: Document) => {
    const attachedDoc: AttachedDocument = {
      id: doc.id,
      title: doc.title,
      content: doc.content.substring(0, 2000), // Limit content size
      source: doc.source_url,
      contentType: doc.document_type,
    };

    if (selectedIds.has(doc.id)) {
      // Deselect
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    } else {
      // Select
      setSelectedIds((prev) => new Set(prev).add(doc.id));
      attachDocument(attachedDoc);
      onSelect?.(attachedDoc);
    }
  };

  const handleConfirm = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
              <FolderOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                Załącz dokumenty
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Wybierz dokumenty do kontekstu rozmowy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj dokumentów..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Selected count */}
        {selectedIds.size > 0 && (
          <div className="px-6 py-2 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800">
            <p className="text-sm text-violet-700 dark:text-violet-300">
              <Check className="inline h-4 w-4 mr-1" />
              Wybrano {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "dokument" : "dokumentów"}
            </p>
          </div>
        )}

        {/* Documents list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Brak dokumentów</p>
              <p className="text-sm mt-1">
                Dodaj dokumenty w zakładce Źródła danych
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const isSelected = selectedIds.has(doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() => handleSelect(doc)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isSelected
                            ? "bg-violet-500 text-white"
                            : "bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300"
                        }`}
                      >
                        {isSelected ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {doc.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {doc.content.substring(0, 150)}...
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {doc.document_type && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                              {doc.document_type}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(doc.created_at).toLocaleDateString("pl")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 rounded-lg shadow-lg shadow-violet-500/30 transition-all"
          >
            Zatwierdź ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}
