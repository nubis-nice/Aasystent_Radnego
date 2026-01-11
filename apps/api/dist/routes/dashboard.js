/**
 * Dashboard API Routes
 */
import { createClient } from "@supabase/supabase-js";
export async function dashboardRoutes(fastify) {
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
            // Get messages count
            const { count: messagesCount } = await supabase
                .from("messages")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId);
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
}
//# sourceMappingURL=dashboard.js.map