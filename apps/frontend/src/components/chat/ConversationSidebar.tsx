"use client";

import { useState, useEffect } from "react";
import { Plus, MessageSquare, Loader2, Trash2 } from "lucide-react";
import { ConversationItem } from "./ConversationItem";
import { getConversations, deleteConversation } from "@/lib/api/chat";

interface Conversation {
  id: string;
  title: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string;
  messageCount?: number;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConversationSidebarProps {
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const conversationsPerPage = 5;

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      console.error("Error loading conversations:", err);
      setError("Nie udało się załadować historii");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę konwersację?")) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));

      // Jeśli usunięto aktywną konwersację, rozpocznij nową
      if (id === activeConversationId) {
        onNewConversation();
      }
    } catch (err) {
      console.error("Error deleting conversation:", err);
      alert("Nie udało się usunąć konwersacji");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    // Filtruj konwersacje do usunięcia (wszystkie oprócz aktywnej)
    const toDelete = conversations.filter((c) => c.id !== activeConversationId);

    if (toDelete.length === 0) {
      alert(
        "Brak konwersacji do usunięcia (aktualna konwersacja zostanie zachowana)."
      );
      return;
    }

    const message = activeConversationId
      ? `Czy na pewno chcesz usunąć ${toDelete.length} konwersacji? Aktualna konwersacja zostanie zachowana.`
      : `Czy na pewno chcesz usunąć wszystkie ${toDelete.length} konwersacji?`;

    if (!confirm(message)) {
      return;
    }

    try {
      setClearingAll(true);
      // Usuń konwersacje po kolei (oprócz aktywnej)
      for (const conv of toDelete) {
        await deleteConversation(conv.id);
      }
      // Zachowaj tylko aktywną konwersację
      setConversations((prev) =>
        prev.filter((c) => c.id === activeConversationId)
      );
    } catch (err) {
      console.error("Error clearing conversations:", err);
      alert("Nie udało się usunąć wszystkich konwersacji");
      // Odśwież listę
      loadConversations();
    } finally {
      setClearingAll(false);
    }
  };

  // Grupowanie konwersacji po dacie
  const groupConversations = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: Record<string, Conversation[]> = {
      Dzisiaj: [],
      Wczoraj: [],
      "Ten tydzień": [],
      Starsze: [],
    };

    conversations.forEach((conv) => {
      const date = conv.lastMessageAt
        ? new Date(conv.lastMessageAt)
        : new Date();
      if (date >= today) {
        groups["Dzisiaj"].push(conv);
      } else if (date >= yesterday) {
        groups["Wczoraj"].push(conv);
      } else if (date >= weekAgo) {
        groups["Ten tydzień"].push(conv);
      } else {
        groups["Starsze"].push(conv);
      }
    });

    return groups;
  };

  const groupedConversations = groupConversations();

  // Paginacja - pobierz tylko 5 konwersacji dla aktualnej strony
  const allConversationsFlat = conversations;
  const totalPages = Math.ceil(
    allConversationsFlat.length / conversationsPerPage
  );
  const startIndex = currentPage * conversationsPerPage;
  const endIndex = startIndex + conversationsPerPage;
  const paginatedConversations = allConversationsFlat.slice(
    startIndex,
    endIndex
  );

  return (
    <div className="w-80 bg-white border-r border-border flex flex-col h-full transition-all duration-300 ease-in-out">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-2">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold shadow-lg hover:from-primary-600 hover:to-primary-700 transition-all"
        >
          <Plus className="h-5 w-5" />
          Nowa konwersacja
        </button>

        {conversations.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearingAll}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {clearingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {clearingAll ? "Usuwanie..." : "Wyczyść historię"}
          </button>
        )}
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={loadConversations}
              className="mt-2 text-primary-600 text-sm hover:underline"
            >
              Spróbuj ponownie
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-secondary-300 mx-auto mb-3" />
            <p className="text-text-secondary text-sm">
              Brak historii konwersacji
            </p>
            <p className="text-text-secondary text-xs mt-1">
              Rozpocznij nową rozmowę
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  id={conv.id}
                  title={conv.title}
                  lastMessage={conv.lastMessage ?? null}
                  lastMessageAt={conv.lastMessageAt}
                  messageCount={conv.messageCount}
                  isActive={conv.id === activeConversationId}
                  onClick={() => onSelectConversation(conv.id)}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {/* Paginacja */}
            {totalPages > 1 && (
              <div className="mt-4 pt-4 border-t border-secondary-100">
                <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
                  <span>
                    Strona {currentPage + 1} z {totalPages}
                  </span>
                  <span>{allConversationsFlat.length} konwersacji</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-secondary-200 hover:bg-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Poprzednia
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={currentPage === totalPages - 1}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-secondary-200 hover:bg-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Następna →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
