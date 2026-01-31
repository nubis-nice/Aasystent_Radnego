/**
 * Reports API Routes
 * Endpointy dla raportów cyklicznych i powiadomień
 */
import { ScheduledReportsService } from "../services/scheduled-reports-service.js";
export const reportsRoutes = async (fastify) => {
    // Pobierz harmonogramy raportów
    fastify.get("/reports/schedules", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new ScheduledReportsService();
            await service.initialize(userId);
            const schedules = await service.getSchedules();
            return reply.send({ success: true, schedules });
        }
        catch (error) {
            fastify.log.error("Error fetching schedules: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Utwórz nowy harmonogram
    fastify.post("/reports/schedules", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new ScheduledReportsService();
            await service.initialize(userId);
            const schedule = await service.createSchedule(request.body);
            return reply.send({ success: true, schedule });
        }
        catch (error) {
            fastify.log.error("Error creating schedule: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Aktualizuj harmonogram
    fastify.put("/reports/schedules/:id", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new ScheduledReportsService();
            await service.initialize(userId);
            const schedule = await service.updateSchedule(request.params.id, request.body);
            return reply.send({ success: true, schedule });
        }
        catch (error) {
            fastify.log.error("Error updating schedule: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Usuń harmonogram
    fastify.delete("/reports/schedules/:id", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new ScheduledReportsService();
            await service.initialize(userId);
            await service.deleteSchedule(request.params.id);
            return reply.send({ success: true });
        }
        catch (error) {
            fastify.log.error("Error deleting schedule: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Generuj raport natychmiast
    fastify.post("/reports/schedules/:id/generate", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new ScheduledReportsService();
            await service.initialize(userId);
            const report = await service.generateReport(request.params.id);
            return reply.send({ success: true, report });
        }
        catch (error) {
            fastify.log.error("Error generating report: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Pobierz wygenerowane raporty
    fastify.get("/reports", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new ScheduledReportsService();
            await service.initialize(userId);
            const limit = request.query.limit ? parseInt(request.query.limit) : 20;
            const reports = await service.getReports(limit);
            return reply.send({ success: true, reports });
        }
        catch (error) {
            fastify.log.error("Error fetching reports: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Pobierz szczegóły raportu
    fastify.get("/reports/:id", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new ScheduledReportsService();
            await service.initialize(userId);
            const report = await service.getReport(request.params.id);
            if (!report) {
                return reply
                    .status(404)
                    .send({ success: false, error: "Raport nie znaleziony" });
            }
            return reply.send({ success: true, report });
        }
        catch (error) {
            fastify.log.error("Error fetching report: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
};
//# sourceMappingURL=reports.js.map