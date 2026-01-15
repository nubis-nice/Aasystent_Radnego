"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  Plus,
  X,
  Clock,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "critical" | "high" | "medium" | "low";
  due_date?: string;
  category: string;
  completed_at?: string;
}

const PRIORITY_CONFIG = {
  critical: {
    label: "Krytyczny",
    color: "text-red-600 bg-red-50 border-red-200",
    icon: "🔴",
  },
  high: {
    label: "Wysoki",
    color: "text-orange-600 bg-orange-50 border-orange-200",
    icon: "🟠",
  },
  medium: {
    label: "Średni",
    color: "text-yellow-600 bg-yellow-50 border-yellow-200",
    icon: "🟡",
  },
  low: {
    label: "Niski",
    color: "text-green-600 bg-green-50 border-green-200",
    icon: "🟢",
  },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  interpellation: { label: "Interpelacja", icon: "✍️" },
  commission: { label: "Komisja", icon: "👥" },
  session: { label: "Sesja", icon: "🏛️" },
  citizen: { label: "Mieszkaniec", icon: "👤" },
  budget: { label: "Budżet", icon: "💰" },
  legal: { label: "Prawne", icon: "⚖️" },
  general: { label: "Ogólne", icon: "📋" },
};

export function TasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">(
    "pending"
  );

  const [newTask, setNewTask] = useState<{
    title: string;
    description: string;
    priority: Task["priority"];
    category: string;
    due_date: string;
  }>({
    title: "",
    description: "",
    priority: "medium",
    category: "general",
    due_date: "",
  });

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      let url = "/api/dashboard/tasks";
      if (filter === "pending") url += "?status=pending";
      else if (filter === "completed") url += "?status=completed";

      const response = await fetch(`${API_URL}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleAddTask = async () => {
    if (!newTask.title) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/dashboard/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newTask,
          due_date: newTask.due_date || undefined,
        }),
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewTask({
          title: "",
          description: "",
          priority: "medium",
          category: "general",
          due_date: "",
        });
        loadTasks();
      }
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${API_URL}/api/dashboard/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      loadTasks();
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to zadanie?")) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${API_URL}/api/dashboard/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      loadTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const formatDueDate = (dueDate?: string) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Dzisiaj";
    if (date.toDateString() === tomorrow.toDateString()) return "Jutro";

    return date.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  };

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="bg-white rounded-2xl border border-border shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-emerald-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-text">Moje zadania</h3>
              <p className="text-xs text-text-secondary">
                {pendingCount} do zrobienia • {completedCount} ukończonych
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            title="Dodaj zadanie"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Filtry */}
        <div className="flex gap-2 mt-4">
          {(["pending", "completed", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                filter === f
                  ? "bg-emerald-500 text-white"
                  : "bg-secondary-100 text-text-secondary hover:bg-secondary-200"
              }`}
            >
              {f === "pending"
                ? "Do zrobienia"
                : f === "completed"
                ? "Ukończone"
                : "Wszystkie"}
            </button>
          ))}
        </div>
      </div>

      {/* Lista zadań */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-secondary-300 mx-auto mb-3" />
            <p className="text-text-secondary text-sm">
              {filter === "pending"
                ? "Brak zadań do wykonania"
                : "Brak ukończonych zadań"}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-emerald-600 text-sm font-medium hover:underline"
            >
              + Dodaj pierwsze zadanie
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`
                  group flex items-start gap-3 p-3 rounded-xl border transition-all
                  ${
                    task.status === "completed"
                      ? "bg-secondary-50 border-secondary-200"
                      : "bg-white border-secondary-200 hover:border-emerald-200 hover:shadow-sm"
                  }
                `}
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggleStatus(task)}
                  className="mt-0.5 flex-shrink-0"
                >
                  {task.status === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-secondary-400 hover:text-emerald-500 transition-colors" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm font-medium ${
                        task.status === "completed"
                          ? "text-text-secondary line-through"
                          : "text-text"
                      }`}
                    >
                      {task.title}
                    </p>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {/* Kategoria */}
                    <span className="text-xs text-text-secondary">
                      {CATEGORY_CONFIG[task.category]?.icon}{" "}
                      {CATEGORY_CONFIG[task.category]?.label}
                    </span>

                    {/* Priorytet */}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        PRIORITY_CONFIG[task.priority].color
                      }`}
                    >
                      {PRIORITY_CONFIG[task.priority].icon}{" "}
                      {PRIORITY_CONFIG[task.priority].label}
                    </span>

                    {/* Termin */}
                    {task.due_date && (
                      <span
                        className={`text-xs flex items-center gap-1 ${
                          isOverdue(task.due_date) &&
                          task.status !== "completed"
                            ? "text-red-600 font-medium"
                            : "text-text-secondary"
                        }`}
                      >
                        {isOverdue(task.due_date) &&
                        task.status !== "completed" ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {formatDueDate(task.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal dodawania zadania */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-text">Nowe zadanie</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-secondary-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Treść zadania *
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-emerald-300"
                  placeholder="Co trzeba zrobić?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-1">
                    Priorytet
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        priority: e.target.value as Task["priority"],
                      }))
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-emerald-300"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.icon} {config.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">
                    Kategoria
                  </label>
                  <select
                    value={newTask.category}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-emerald-300"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.icon} {config.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Termin wykonania
                </label>
                <input
                  type="datetime-local"
                  value={newTask.due_date}
                  onChange={(e) =>
                    setNewTask((prev) => ({
                      ...prev,
                      due_date: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-emerald-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Opis (opcjonalnie)
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-emerald-300"
                  rows={2}
                  placeholder="Dodatkowe szczegóły..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-text-secondary hover:bg-secondary-100 rounded-lg transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleAddTask}
                disabled={!newTask.title}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                Dodaj zadanie
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
