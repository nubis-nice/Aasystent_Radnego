/**
 * Dashboard API Routes
 * Kalendarz, Zadania, Alerty, Statystyki
 */
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { batchImportExistingDocuments } from "../services/calendar-auto-import.js";
// Schemas
const CalendarEventSchema = z.object({
    title: z.string().min(1).max(500),
    description: z.string().optional(),
    event_type: z
        .enum(["session", "committee", "meeting", "deadline", "reminder", "other"])
        .default("other"),
    start_date: z.string(),
    end_date: z.string().optional(),
    all_day: z.boolean().default(false),
    location: z.string().max(300).optional(),
    document_id: z.string().uuid().optional(),
    source_url: z.string().url().optional(),
    reminder_minutes: z.array(z.number()).default([1440, 60]),
    color: z.string().max(20).default("primary"),
});
const TaskSchema = z.object({
    title: z.string().min(1).max(500),
    description: z.string().optional(),
    status: z
        .enum(["pending", "in_progress", "completed", "cancelled"])
        .default("pending"),
    priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
    due_date: z.string().optional(),
    category: z
        .enum([
        "interpellation",
        "commission",
        "session",
        "citizen",
        "budget",
        "legal",
        "general",
    ])
        .default("general"),
    document_id: z.string().uuid().optional(),
    calendar_event_id: z.string().uuid().optional(),
    related_url: z.string().url().optional(),
    reminder_date: z.string().optional(),
    tags: z.array(z.string()).default([]),
});
export async function dashboardRoutes(fastify) {
    const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // GET /api/dashboard/stats - Dashboard statistics
    fastify.get("/dashboard/stats", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.code(401).send({ error: "Unauthorized" });
        }
        try {
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            // Get documents count
            const { count: documentsCount } = await supabase
                .from("processed_documents")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId);
            // Get documents this week
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const { count: documentsThisWeek } = await supabase
                .from("processed_documents")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .gte("created_at", oneWeekAgo.toISOString());
            // Get conversations count
            const { count: conversationsCount } = await supabase
                .from("conversations")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId);
            // Get messages count (tylko wiadomości użytkownika = zapytania AI)
            const { count: messagesCount } = await supabase
                .from("messages")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("role", "user");
            // Get recent activity
            const { data: recentDocs } = await supabase
                .from("processed_documents")
                .select("id, title, created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(5);
            const { data: recentConversations } = await supabase
                .from("conversations")
                .select("id, title, created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(5);
            // Combine and sort recent activity
            const recentActivity = [
                ...(recentDocs || []).map((doc) => ({
                    id: doc.id,
                    type: "document",
                    title: doc.title || "Dokument bez tytułu",
                    timestamp: doc.created_at,
                })),
                ...(recentConversations || []).map((conv) => ({
                    id: conv.id,
                    type: "conversation",
                    title: conv.title || "Rozmowa z AI",
                    timestamp: conv.created_at,
                })),
            ]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 10);
            return reply.send({
                documentsCount: documentsCount || 0,
                documentsThisWeek: documentsThisWeek || 0,
                conversationsCount: conversationsCount || 0,
                messagesCount: messagesCount || 0,
                recentActivity,
            });
        }
        catch (error) {
            fastify.log.error("[Dashboard] Failed to fetch stats: %s", error instanceof Error ? error.message : String(error));
            return reply.code(500).send({
                error: "Failed to fetch dashboard stats",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // PRZYPOMNIENIA / NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════════════════════
    // GET /api/dashboard/notifications/upcoming - Nadchodzące przypomnienia
    fastify.get("/dashboard/notifications/upcoming", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const supabase = getSupabase();
        const now = new Date();
        try {
            // Pobierz wydarzenia z następnych 24h które mają reminder_minutes
            const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const { data: events, error } = await supabase
                .from("user_calendar_events")
                .select("*")
                .eq("user_id", userId)
                .gte("start_date", now.toISOString())
                .lte("start_date", next24h.toISOString())
                .order("start_date", { ascending: true });
            if (error)
                throw error;
            // Filtruj wydarzenia gdzie przypomnienie powinno być wyświetlone
            const notifications = (events || [])
                .map((event) => {
                const eventStart = new Date(event.start_date);
                const reminderMinutes = event.reminder_minutes || [60];
                // Sprawdź każdy reminder_minutes
                for (const minutes of reminderMinutes) {
                    const reminderTime = new Date(eventStart.getTime() - minutes * 60 * 1000);
                    const minutesUntilReminder = (reminderTime.getTime() - now.getTime()) / (60 * 1000);
                    // Przypomnienie w ciągu następnych 5 minut lub już minęło (ale max 30 min temu)
                    if (minutesUntilReminder <= 5 && minutesUntilReminder >= -30) {
                        const minutesUntilEvent = (eventStart.getTime() - now.getTime()) / (60 * 1000);
                        return {
                            id: `${event.id}-${minutes}`,
                            event_id: event.id,
                            title: event.title,
                            event_type: event.event_type,
                            start_date: event.start_date,
                            location: event.location,
                            minutes_until_event: Math.round(minutesUntilEvent),
                            reminder_type: minutes >= 1440 ? "day" : minutes >= 60 ? "hour" : "minutes",
                            reminder_minutes: minutes,
                        };
                    }
                }
                return null;
            })
                .filter(Boolean);
            return reply.send({
                notifications,
                count: notifications.length,
                checked_at: now.toISOString(),
            });
        }
        catch (error) {
            fastify.log.error(`[Notifications] Error: ${error instanceof Error ? error.message : String(error)}`);
            return reply.code(500).send({ error: "Failed to fetch notifications" });
        }
    });
    // POST /api/dashboard/notifications/:id/dismiss - Odrzuć przypomnienie
    fastify.post("/dashboard/notifications/:id/dismiss", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        // W przyszłości można zapisywać dismissed notifications w bazie
        // Na razie tylko potwierdzamy
        return reply.send({ dismissed: true, id: request.params.id });
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // KALENDARZ - CRUD
    // ═══════════════════════════════════════════════════════════════════════════
    // GET /api/dashboard/calendar/debug - Wszystkie wydarzenia (do debugowania)
    fastify.get("/dashboard/calendar/debug", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("user_calendar_events")
            .select("id, title, start_date, event_type, location, created_at")
            .eq("user_id", userId)
            .order("start_date", { ascending: true })
            .limit(20);
        if (error) {
            return reply.code(500).send({ error: error.message });
        }
        return reply.send({
            userId,
            totalEvents: data?.length || 0,
            events: data || [],
            serverTime: new Date().toISOString(),
        });
    });
    // GET /api/dashboard/calendar - Lista wydarzeń
    fastify.get("/dashboard/calendar", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const query = request.query;
        const supabase = getSupabase();
        try {
            let dbQuery = supabase
                .from("user_calendar_events")
                .select("*")
                .eq("user_id", userId)
                .order("start_date", { ascending: true });
            if (query.from)
                dbQuery = dbQuery.gte("start_date", query.from);
            if (query.to)
                dbQuery = dbQuery.lte("start_date", query.to);
            if (query.type)
                dbQuery = dbQuery.eq("event_type", query.type);
            const { data, error } = await dbQuery;
            if (error)
                throw error;
            // Debug log
            console.log(`[Calendar] User ${userId} - found ${data?.length || 0} events (from: ${query.from}, to: ${query.to})`);
            return reply.send({ events: data || [] });
        }
        catch (error) {
            fastify.log.error(`[Calendar] Error: ${error instanceof Error ? error.message : String(error)}`);
            return reply.code(500).send({ error: "Failed to fetch calendar events" });
        }
    });
    // POST /api/dashboard/calendar - Dodaj wydarzenie
    fastify.post("/dashboard/calendar", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        try {
            const body = CalendarEventSchema.parse(request.body);
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from("user_calendar_events")
                .insert({ ...body, user_id: userId })
                .select()
                .single();
            if (error)
                throw error;
            return reply.code(201).send({ event: data });
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return reply
                    .code(400)
                    .send({ error: "Invalid data", details: error.errors });
            }
            fastify.log.error(`[Calendar] Create error: ${error instanceof Error ? error.message : String(error)}`);
            return reply.code(500).send({ error: "Failed to create event" });
        }
    });
    // PUT /api/dashboard/calendar/:id - Aktualizuj wydarzenie
    fastify.put("/dashboard/calendar/:id", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        try {
            const body = CalendarEventSchema.partial().parse(request.body);
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from("user_calendar_events")
                .update(body)
                .eq("id", request.params.id)
                .eq("user_id", userId)
                .select()
                .single();
            if (error)
                throw error;
            if (!data)
                return reply.code(404).send({ error: "Event not found" });
            return reply.send({ event: data });
        }
        catch (error) {
            fastify.log.error(`[Calendar] Update error: ${error instanceof Error ? error.message : String(error)}`);
            return reply.code(500).send({ error: "Failed to update event" });
        }
    });
    // DELETE /api/dashboard/calendar/:id - Usuń wydarzenie
    fastify.delete("/dashboard/calendar/:id", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const supabase = getSupabase();
        const { error } = await supabase
            .from("user_calendar_events")
            .delete()
            .eq("id", request.params.id)
            .eq("user_id", userId);
        if (error) {
            fastify.log.error(`[Calendar] Delete error: ${error.message}`);
            return reply.code(500).send({ error: "Failed to delete event" });
        }
        return reply.code(204).send();
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // ZADANIA - CRUD
    // ═══════════════════════════════════════════════════════════════════════════
    // GET /api/dashboard/tasks - Lista zadań
    fastify.get("/dashboard/tasks", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const query = request.query;
        const supabase = getSupabase();
        try {
            let dbQuery = supabase
                .from("user_tasks")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });
            if (query.status)
                dbQuery = dbQuery.eq("status", query.status);
            if (query.priority)
                dbQuery = dbQuery.eq("priority", query.priority);
            if (query.category)
                dbQuery = dbQuery.eq("category", query.category);
            const { data, error } = await dbQuery;
            if (error)
                throw error;
            return reply.send({ tasks: data || [] });
        }
        catch (error) {
            fastify.log.error(`[Tasks] Error: ${error instanceof Error ? error.message : String(error)}`);
            return reply.code(500).send({ error: "Failed to fetch tasks" });
        }
    });
    // POST /api/dashboard/tasks - Dodaj zadanie
    fastify.post("/dashboard/tasks", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        try {
            const body = TaskSchema.parse(request.body);
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from("user_tasks")
                .insert({ ...body, user_id: userId })
                .select()
                .single();
            if (error)
                throw error;
            return reply.code(201).send({ task: data });
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return reply
                    .code(400)
                    .send({ error: "Invalid data", details: error.errors });
            }
            fastify.log.error(`[Tasks] Create error: ${error instanceof Error ? error.message : String(error)}`);
            return reply.code(500).send({ error: "Failed to create task" });
        }
    });
    // PUT /api/dashboard/tasks/:id - Aktualizuj zadanie
    fastify.put("/dashboard/tasks/:id", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        try {
            const body = TaskSchema.partial().parse(request.body);
            const supabase = getSupabase();
            // Jeśli status zmienia się na completed, ustaw completed_at
            const updateData = { ...body };
            if (body.status === "completed") {
                updateData.completed_at = new Date().toISOString();
            }
            const { data, error } = await supabase
                .from("user_tasks")
                .update(updateData)
                .eq("id", request.params.id)
                .eq("user_id", userId)
                .select()
                .single();
            if (error)
                throw error;
            if (!data)
                return reply.code(404).send({ error: "Task not found" });
            return reply.send({ task: data });
        }
        catch (error) {
            fastify.log.error(`[Tasks] Update error: ${error instanceof Error ? error.message : String(error)}`);
            return reply.code(500).send({ error: "Failed to update task" });
        }
    });
    // DELETE /api/dashboard/tasks/:id - Usuń zadanie
    fastify.delete("/dashboard/tasks/:id", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const supabase = getSupabase();
        const { error } = await supabase
            .from("user_tasks")
            .delete()
            .eq("id", request.params.id)
            .eq("user_id", userId);
        if (error) {
            fastify.log.error(`[Tasks] Delete error: ${error.message}`);
            return reply.code(500).send({ error: "Failed to delete task" });
        }
        return reply.code(204).send();
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // ALERTY / POWIADOMIENIA
    // ═══════════════════════════════════════════════════════════════════════════
    // GET /api/dashboard/alerts - Lista alertów
    fastify.get("/dashboard/alerts", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const query = request.query;
        const supabase = getSupabase();
        try {
            let dbQuery = supabase
                .from("user_alerts")
                .select("*")
                .eq("user_id", userId)
                .eq("is_dismissed", false)
                .order("created_at", { ascending: false })
                .limit(20);
            if (query.unread_only === "true") {
                dbQuery = dbQuery.eq("is_read", false);
            }
            const { data, error } = await dbQuery;
            if (error)
                throw error;
            // Count unread
            const { count: unreadCount } = await supabase
                .from("user_alerts")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("is_read", false)
                .eq("is_dismissed", false);
            return reply.send({ alerts: data || [], unreadCount: unreadCount || 0 });
        }
        catch (error) {
            fastify.log.error(`[Alerts] Error: ${error instanceof Error ? error.message : String(error)}`);
            return reply.code(500).send({ error: "Failed to fetch alerts" });
        }
    });
    // PUT /api/dashboard/alerts/:id/read - Oznacz jako przeczytany
    fastify.put("/dashboard/alerts/:id/read", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const supabase = getSupabase();
        const { error } = await supabase
            .from("user_alerts")
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq("id", request.params.id)
            .eq("user_id", userId);
        if (error) {
            return reply.code(500).send({ error: "Failed to mark alert as read" });
        }
        return reply.send({ success: true });
    });
    // PUT /api/dashboard/alerts/read-all - Oznacz wszystkie jako przeczytane
    fastify.put("/dashboard/alerts/read-all", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const supabase = getSupabase();
        const { error } = await supabase
            .from("user_alerts")
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("is_read", false);
        if (error) {
            return reply.code(500).send({ error: "Failed to mark alerts as read" });
        }
        return reply.send({ success: true });
    });
    // DELETE /api/dashboard/alerts/:id - Odrzuć alert
    fastify.delete("/dashboard/alerts/:id", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const supabase = getSupabase();
        const { error } = await supabase
            .from("user_alerts")
            .update({ is_dismissed: true })
            .eq("id", request.params.id)
            .eq("user_id", userId);
        if (error) {
            return reply.code(500).send({ error: "Failed to dismiss alert" });
        }
        return reply.code(204).send();
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // UPCOMING EVENTS - z dokumentów
    // ═══════════════════════════════════════════════════════════════════════════
    // GET /api/dashboard/upcoming - Nadchodzące wydarzenia z dokumentów
    fastify.get("/dashboard/upcoming", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const supabase = getSupabase();
        try {
            // Pobierz nadchodzące sesje i komisje z processed_documents
            const { data: upcomingSessions } = await supabase
                .from("processed_documents")
                .select("id, title, document_type, session_number, normalized_publish_date, source_url")
                .eq("user_id", userId)
                .in("document_type", ["session_agenda", "committee_meeting"])
                .gte("normalized_publish_date", new Date().toISOString().split("T")[0])
                .order("normalized_publish_date", { ascending: true })
                .limit(10);
            // Pobierz zadania z terminami
            const { data: upcomingTasks } = await supabase
                .from("user_tasks")
                .select("id, title, due_date, priority, category")
                .eq("user_id", userId)
                .in("status", ["pending", "in_progress"])
                .not("due_date", "is", null)
                .gte("due_date", new Date().toISOString())
                .order("due_date", { ascending: true })
                .limit(10);
            // Pobierz wydarzenia z kalendarza
            const { data: calendarEvents } = await supabase
                .from("user_calendar_events")
                .select("id, title, start_date, event_type, location")
                .eq("user_id", userId)
                .gte("start_date", new Date().toISOString())
                .order("start_date", { ascending: true })
                .limit(10);
            return reply.send({
                sessions: upcomingSessions || [],
                tasks: upcomingTasks || [],
                events: calendarEvents || [],
            });
        }
        catch (error) {
            fastify.log.error(`[Upcoming] Error: ${error instanceof Error ? error.message : String(error)}`);
            return reply.code(500).send({ error: "Failed to fetch upcoming events" });
        }
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // BATCH IMPORT - importuj istniejące dokumenty sesji/komisji do kalendarza
    // ═══════════════════════════════════════════════════════════════════════════
    // POST /api/dashboard/calendar/batch-import - Import wydarzeń z dokumentów
    fastify.post("/dashboard/calendar/batch-import", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        try {
            const stats = await batchImportExistingDocuments(userId);
            return reply.send({
                success: true,
                message: `Zaimportowano ${stats.imported} wydarzeń, pominięto ${stats.skipped}, błędów: ${stats.errors}`,
                stats,
            });
        }
        catch (error) {
            fastify.log.error(`[BatchImport] Error: ${error instanceof Error ? error.message : String(error)}`);
            return reply.code(500).send({ error: "Failed to batch import events" });
        }
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // STATUS POLLING - Prosty endpoint do sprawdzania statusu systemu
    // ═══════════════════════════════════════════════════════════════════════════
    // GET /api/dashboard/status - Status systemu i aktywne zadania
    fastify.get("/dashboard/status", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        try {
            const supabase = getSupabase();
            // Pobierz aktywne zadania z Redis/BullMQ (jeśli dostępne)
            // Na razie zwracamy pusty array - można rozszerzyć o integrację z kolejką
            const activeTasks = [];
            // Pobierz ostatnie powiadomienia GIS (nieprzeczytane)
            const { data: notifications, error: notifError } = await supabase
                .from("gis_notifications")
                .select("id, title, notification_type, priority, created_at")
                .eq("user_id", userId)
                .is("read_at", null)
                .order("created_at", { ascending: false })
                .limit(5);
            // Pobierz licznik nieprzeczytanych
            const { count: unreadCount } = await supabase
                .from("gis_notifications")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .is("read_at", null);
            return reply.send({
                status: "ok",
                timestamp: new Date().toISOString(),
                activeTasks,
                notifications: notifError ? [] : notifications || [],
                unreadNotificationsCount: unreadCount || 0,
                systemHealth: {
                    api: "ok",
                    database: "ok",
                },
            });
        }
        catch (error) {
            fastify.log.error(`[Dashboard Status] Error: ${error instanceof Error ? error.message : String(error)}`);
            return reply.send({
                status: "ok",
                timestamp: new Date().toISOString(),
                activeTasks: [],
                notifications: [],
                unreadNotificationsCount: 0,
                systemHealth: {
                    api: "ok",
                    database: "error",
                },
            });
        }
    });
}
//# sourceMappingURL=dashboard.js.map