"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  Clock,
  MapPin,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_type:
    | "session"
    | "committee"
    | "meeting"
    | "deadline"
    | "reminder"
    | "other";
  start_date: string;
  end_date?: string;
  all_day: boolean;
  location?: string;
  document_id?: string;
  color: string;
}

interface CalendarWidgetProps {
  onEventClick?: (event: CalendarEvent) => void;
}

const EVENT_TYPE_CONFIG = {
  session: {
    icon: "🏛️",
    label: "Sesja Rady",
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
  committee: {
    icon: "👥",
    label: "Komisja",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  meeting: {
    icon: "📅",
    label: "Spotkanie",
    color: "bg-green-100 text-green-700 border-green-200",
  },
  deadline: {
    icon: "⏰",
    label: "Termin",
    color: "bg-red-100 text-red-700 border-red-200",
  },
  reminder: {
    icon: "🔔",
    label: "Przypomnienie",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  other: {
    icon: "📌",
    label: "Inne",
    color: "bg-gray-100 text-gray-700 border-gray-200",
  },
};

const DAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];
const MONTHS = [
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

const DAY_NAMES = [
  "Niedziela",
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
];

// Godziny od 6:00 do 20:00
const SCHEDULE_HOURS = Array.from({ length: 15 }, (_, i) => i + 6);

interface DayScheduleModalProps {
  date: Date;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick?: (event: CalendarEvent) => void;
  onDeleteEvent?: (eventId: string) => void;
}

function DayScheduleModal({
  date,
  events,
  onClose,
  onEventClick,
  onDeleteEvent,
}: DayScheduleModalProps) {
  const formatDate = (d: Date) => {
    return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${
      MONTHS[d.getMonth()]
    } ${d.getFullYear()}`;
  };

  const getEventHour = (event: CalendarEvent): number => {
    const eventDate = new Date(event.start_date);
    return eventDate.getHours();
  };

  const formatTime = (event: CalendarEvent): string => {
    const eventDate = new Date(event.start_date);
    return eventDate.toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEventsForHour = (hour: number): CalendarEvent[] => {
    return events.filter((event) => {
      if (event.all_day) return false; // Całodzienne osobno
      const eventHour = getEventHour(event);
      return eventHour === hour;
    });
  };

  // Wydarzenia poza zakresem godzinowym (całodzienne lub godzina < 6 lub > 20)
  const outsideRangeEvents = events.filter((event) => {
    if (event.all_day) return true;
    const hour = getEventHour(event);
    return hour < 6 || hour > 20;
  });

  // Sortuj wydarzenia po godzinie
  const sortedEvents = [...events].sort((a, b) => {
    const timeA = new Date(a.start_date).getTime();
    const timeB = new Date(b.start_date).getTime();
    return timeA - timeB;
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary-50 to-white rounded-t-2xl">
          <div>
            <h3 className="font-bold text-lg text-text flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary-500" />
              Grafik dnia
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              {formatDate(date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lista wydarzeń */}
        <div className="p-4 overflow-y-auto flex-1">
          {sortedEvents.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              Brak wydarzeń w tym dniu
            </div>
          ) : (
            <div className="space-y-2">
              {/* Wydarzenia całodzienne lub poza zakresem */}
              {outsideRangeEvents.length > 0 && (
                <div className="mb-4 pb-3 border-b-2 border-primary-200">
                  <div className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                    📌 Wydarzenia bez ustalonej godziny
                  </div>
                  <div className="space-y-2">
                    {outsideRangeEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`
                          p-3 rounded-lg border transition-all
                          hover:shadow-md
                          ${EVENT_TYPE_CONFIG[event.event_type].color}
                        `}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg">
                            {EVENT_TYPE_CONFIG[event.event_type].icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {event.title}
                              </span>
                              {!event.all_day && (
                                <span className="text-xs opacity-75 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(event)}
                                </span>
                              )}
                              {event.all_day && (
                                <span className="text-xs bg-white/50 px-2 py-0.5 rounded">
                                  Cały dzień
                                </span>
                              )}
                            </div>
                            {event.location && (
                              <div className="text-xs mt-1 flex items-center gap-1 opacity-75">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </div>
                            )}
                            {event.description && (
                              <p className="text-xs mt-1 opacity-75 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  "Czy na pewno chcesz usunąć to wydarzenie?"
                                )
                              ) {
                                onDeleteEvent?.(event.id);
                              }
                            }}
                            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors text-red-500 hover:text-red-700"
                            title="Usuń wydarzenie"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Siatka godzinowa */}
              {SCHEDULE_HOURS.map((hour) => {
                const hourEvents = getEventsForHour(hour);
                const hasEvents = hourEvents.length > 0;

                return (
                  <div
                    key={hour}
                    className={`flex gap-3 py-2 border-b border-secondary-100 ${
                      hasEvents ? "bg-primary-50/30" : ""
                    }`}
                  >
                    {/* Godzina */}
                    <div className="w-16 flex-shrink-0 text-right">
                      <span
                        className={`text-sm font-medium ${
                          hasEvents ? "text-primary-600" : "text-text-secondary"
                        }`}
                      >
                        {hour.toString().padStart(2, "0")}:00
                      </span>
                    </div>

                    {/* Linia lub wydarzenia */}
                    <div className="flex-1 min-h-[40px]">
                      {hasEvents ? (
                        <div className="space-y-2">
                          {hourEvents.map((event) => (
                            <div
                              key={event.id}
                              className={`
                                p-3 rounded-lg border transition-all
                                hover:shadow-md
                                ${EVENT_TYPE_CONFIG[event.event_type].color}
                              `}
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-lg">
                                  {EVENT_TYPE_CONFIG[event.event_type].icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">
                                      {event.title}
                                    </span>
                                    <span className="text-xs opacity-75 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatTime(event)}
                                    </span>
                                  </div>
                                  {event.location && (
                                    <div className="text-xs mt-1 flex items-center gap-1 opacity-75">
                                      <MapPin className="h-3 w-3" />
                                      {event.location}
                                    </div>
                                  )}
                                  {event.description && (
                                    <p className="text-xs mt-1 opacity-75 line-clamp-2">
                                      {event.description}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                      confirm(
                                        "Czy na pewno chcesz usunąć to wydarzenie?"
                                      )
                                    ) {
                                      onDeleteEvent?.(event.id);
                                    }
                                  }}
                                  className="p-1.5 hover:bg-red-100 rounded-lg transition-colors text-red-500 hover:text-red-700"
                                  title="Usuń wydarzenie"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex items-center">
                          <div className="w-full border-t border-dashed border-secondary-200" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Podsumowanie */}
        <div className="px-6 py-3 border-t border-border bg-secondary-50 rounded-b-2xl">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">
              Łącznie: <strong className="text-text">{events.length}</strong>{" "}
              {events.length === 1
                ? "wydarzenie"
                : events.length < 5
                ? "wydarzenia"
                : "wydarzeń"}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm"
            >
              Zamknij
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CalendarWidget({ onEventClick }: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);

  // Formularz nowego wydarzenia
  const [newEvent, setNewEvent] = useState({
    title: "",
    event_type: "meeting" as const,
    start_date: "",
    location: "",
    description: "",
  });

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Pobierz zakres dat dla widoku
      const startOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const endOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0
      );

      const response = await fetch(
        `${API_URL}/api/dashboard/calendar?from=${startOfMonth.toISOString()}&to=${endOfMonth.toISOString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error("Error loading calendar events:", error);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.start_date) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/dashboard/calendar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newEvent),
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewEvent({
          title: "",
          event_type: "meeting",
          start_date: "",
          location: "",
          description: "",
        });
        loadEvents();
      }
    } catch (error) {
      console.error("Error adding event:", error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${API_URL}/api/dashboard/calendar/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      loadEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  // Generuj dni miesiąca
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Poniedziałek = 0

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Dni z poprzedniego miesiąca
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }

    // Dni bieżącego miesiąca
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Dni następnego miesiąca (dopełnienie do 42 dni)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start_date);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const days = generateCalendarDays();

  return (
    <div className="bg-white rounded-2xl border border-border shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-text">Kalendarz</h3>
              <p className="text-xs text-text-secondary">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setCurrentDate(
                  new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth() - 1
                  )
                )
              }
              className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              Dziś
            </button>
            <button
              onClick={() =>
                setCurrentDate(
                  new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth() + 1
                  )
                )
              }
              className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setSelectedDate(new Date());
                setNewEvent((prev) => ({
                  ...prev,
                  start_date: new Date().toISOString().slice(0, 16),
                }));
                setShowAddModal(true);
              }}
              className="ml-2 p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              title="Dodaj wydarzenie"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Dni tygodnia */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-text-secondary py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Dni miesiąca */}
            <div className="grid grid-cols-7 gap-1">
              {days.map(({ date, isCurrentMonth }, index) => {
                const dayEvents = getEventsForDate(date);
                const today = isToday(date);

                return (
                  <div
                    key={index}
                    onClick={() => {
                      setSelectedDate(date);
                      setNewEvent((prev) => ({
                        ...prev,
                        start_date: date.toISOString().slice(0, 16),
                      }));
                      // Otwórz modal godzinowy jeśli są wydarzenia
                      if (dayEvents.length > 0) {
                        setDayModalDate(date);
                        setShowDayModal(true);
                      }
                    }}
                    className={`
                      min-h-[60px] p-1 rounded-lg border cursor-pointer transition-all
                      ${isCurrentMonth ? "bg-white" : "bg-secondary-50"}
                      ${
                        today
                          ? "border-primary-400 bg-primary-50"
                          : "border-transparent hover:border-secondary-200"
                      }
                      ${
                        selectedDate?.getTime() === date.getTime()
                          ? "ring-2 ring-primary-300"
                          : ""
                      }
                    `}
                  >
                    <div
                      className={`
                        text-xs font-medium text-center mb-1
                        ${isCurrentMonth ? "text-text" : "text-text-secondary"}
                        ${today ? "text-primary-600 font-bold" : ""}
                      `}
                    >
                      {date.getDate()}
                    </div>
                    <div className="space-y-0.5 pointer-events-none">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`
                            text-[10px] px-1 py-0.5 rounded truncate
                            ${EVENT_TYPE_CONFIG[event.event_type].color}
                          `}
                          title={event.title}
                        >
                          {EVENT_TYPE_CONFIG[event.event_type].icon}{" "}
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-text-secondary text-center">
                          +{dayEvents.length - 2} więcej
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Legenda */}
      <div className="px-4 py-3 border-t border-border bg-secondary-50">
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(EVENT_TYPE_CONFIG)
            .slice(0, 4)
            .map(([key, config]) => (
              <div key={key} className="flex items-center gap-1">
                <span>{config.icon}</span>
                <span className="text-text-secondary">{config.label}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Modal widoku godzinowego dnia */}
      {showDayModal && dayModalDate && (
        <DayScheduleModal
          date={dayModalDate}
          events={getEventsForDate(dayModalDate)}
          onClose={() => setShowDayModal(false)}
          onEventClick={onEventClick}
          onDeleteEvent={handleDeleteEvent}
        />
      )}

      {/* Modal dodawania wydarzenia */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-text">Nowe wydarzenie</h3>
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
                  Tytuł *
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) =>
                    setNewEvent((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-300"
                  placeholder="Nazwa wydarzenia"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Typ
                </label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) =>
                    setNewEvent((prev) => ({
                      ...prev,
                      event_type: e.target.value as any,
                    }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-300"
                >
                  {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.icon} {config.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Data i godzina *
                </label>
                <input
                  type="datetime-local"
                  value={newEvent.start_date}
                  onChange={(e) =>
                    setNewEvent((prev) => ({
                      ...prev,
                      start_date: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Miejsce
                </label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) =>
                    setNewEvent((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-300"
                  placeholder="np. Sala obrad, Urząd Miejski"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Opis
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) =>
                    setNewEvent((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-300"
                  rows={3}
                  placeholder="Dodatkowe informacje..."
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
                onClick={handleAddEvent}
                disabled={!newEvent.title || !newEvent.start_date}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                Dodaj wydarzenie
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
