"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface ConversationItemProps {
  id: string;
  title: string | null;
  lastMessage: string | null;
  lastMessageAt?: string;
  messageCount?: number;
  isActive: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
}

export function ConversationItem({
  id,
  title,
  lastMessage,
  lastMessageAt,
  messageCount,
  isActive,
  onClick,
  onDelete,
}: ConversationItemProps) {
  const displayTitle = title || "Nowa konwersacja";
  const timeAgo = lastMessageAt
    ? formatDistanceToNow(new Date(lastMessageAt), {
        addSuffix: true,
        locale: pl,
      })
    : "niedawno";

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(id);
  };

  return (
    <div
      onClick={onClick}
      className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
        isActive
          ? "bg-primary-50 border-2 border-primary-300"
          : "hover:bg-secondary-50 border-2 border-transparent"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg flex-shrink-0 ${
            isActive ? "bg-primary-100" : "bg-secondary-100"
          }`}
        >
          <MessageSquare
            className={`h-4 w-4 ${
              isActive ? "text-primary-600" : "text-secondary-600"
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`font-semibold text-sm truncate ${
                isActive ? "text-primary-900" : "text-text"
              }`}
            >
              {displayTitle}
            </h3>
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity"
              title="Usuń konwersację"
            >
              <Trash2 className="h-3 w-3 text-red-600" />
            </button>
          </div>

          {lastMessage && (
            <p className="text-xs text-text-secondary mt-1 line-clamp-2">
              {lastMessage}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-text-secondary">{timeAgo}</span>
            <span className="text-xs text-text-secondary">•</span>
            <span className="text-xs text-text-secondary">
              {messageCount} {messageCount === 1 ? "wiadomość" : "wiadomości"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
