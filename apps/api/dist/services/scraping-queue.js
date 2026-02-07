/**
 * Scraping Queue Manager
 *
 * Zarządza kolejką zadań scrapingu z limitem równoczesnych procesów.
 * Implementuje priorytetyzację źródeł i równoległe przetwarzanie.
 * Używa BullMQ + Redis dla persistence.
 */
import EventEmitter from "events";
import { wsHub } from "./websocket-hub.js";
import { backgroundTaskService } from "./background-task-service.js";
// ============================================================================
// SCRAPING QUEUE MANAGER
// ============================================================================
export class ScrapingQueueManager extends EventEmitter {
    static instance = null;
    config;
    queue = [];
    runningJobs = new Map();
    completedJobs = [];
    failedJobs = [];
    isProcessing = false;
    constructor(config) {
        super();
        this.config = {
            maxConcurrent: 3, // Max 3 równoczesne scrapingi
            maxPagesParallel: 5, // Max 5 stron jednocześnie w ramach jednego scrapingu
            defaultPriority: 50,
            ...config,
        };
        console.log(`[ScrapingQueue] Initialized: maxConcurrent=${this.config.maxConcurrent}, maxPagesParallel=${this.config.maxPagesParallel}`);
    }
    /**
     * Singleton - jedna instancja kolejki dla całej aplikacji
     */
    static getInstance(config) {
        if (!ScrapingQueueManager.instance) {
            ScrapingQueueManager.instance = new ScrapingQueueManager(config);
        }
        return ScrapingQueueManager.instance;
    }
    /**
     * Dodaj zadanie do kolejki
     */
    async enqueue(sourceId, userId, options) {
        // Sprawdź czy zadanie dla tego źródła już istnieje
        const existingQueued = this.queue.find((j) => j.sourceId === sourceId);
        const existingRunning = Array.from(this.runningJobs.values()).find((j) => j.sourceId === sourceId);
        if (existingQueued) {
            console.log(`[ScrapingQueue] Job for source ${sourceId} already queued, skipping`);
            return existingQueued.id;
        }
        if (existingRunning) {
            console.log(`[ScrapingQueue] Job for source ${sourceId} already running, skipping`);
            return existingRunning.id;
        }
        const job = {
            id: `job_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            sourceId,
            userId,
            priority: options?.priority ?? this.config.defaultPriority,
            config: options?.config,
            createdAt: new Date(),
            status: "queued",
        };
        this.queue.push(job);
        // Sortuj kolejkę po priorytecie (wyższy priorytet = wcześniej)
        this.queue.sort((a, b) => b.priority - a.priority);
        console.log(`[ScrapingQueue] Enqueued job ${job.id} for source ${sourceId} (priority: ${job.priority}, queue size: ${this.queue.length})`);
        this.emit("job:queued", job);
        // Powiadom przez WebSocket
        wsHub.registerTask(userId, {
            id: job.id,
            type: "scraping",
            status: "queued",
            title: `Scraping źródła`,
            description: `Zadanie w kolejce (pozycja: ${this.queue.length})`,
            startedAt: job.createdAt.toISOString(),
        });
        // Zapisz do background_tasks dla Supabase Realtime
        backgroundTaskService
            .createTask({
            userId,
            taskType: "scraping",
            title: `Scraping źródła`,
            description: `Zadanie w kolejce (pozycja: ${this.queue.length})`,
            metadata: { jobId: job.id, sourceId },
        })
            .catch((err) => console.error("[ScrapingQueue] Background task error:", err));
        // Uruchom przetwarzanie kolejki
        this.processQueue();
        return job.id;
    }
    /**
     * Przetwarzaj kolejkę - uruchamiaj zadania do limitu
     */
    async processQueue() {
        if (this.isProcessing) {
            return; // Już przetwarzamy
        }
        this.isProcessing = true;
        try {
            while (this.queue.length > 0 &&
                this.runningJobs.size < this.config.maxConcurrent) {
                const job = this.queue.shift();
                if (!job)
                    break;
                // Uruchom zadanie
                this.startJob(job);
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * Uruchom pojedyncze zadanie scrapingu
     */
    async startJob(job) {
        job.status = "running";
        job.startedAt = new Date();
        this.runningJobs.set(job.id, job);
        console.log(`[ScrapingQueue] Starting job ${job.id} for source ${job.sourceId} (${this.runningJobs.size}/${this.config.maxConcurrent} running)`);
        this.emit("job:started", job);
        // Powiadom przez WebSocket - zadanie uruchomione
        wsHub.updateTask(job.userId, job.id, {
            status: "running",
            description: `Scraping w toku...`,
        });
        // Aktualizuj background_tasks
        backgroundTaskService
            .updateByJobId(job.id, {
            status: "running",
            description: "Scraping w toku...",
        })
            .catch((err) => console.error("[ScrapingQueue] Background task error:", err));
        try {
            // Import dynamiczny aby uniknąć circular dependency
            const { intelligentScrapeDataSource } = await import("./intelligent-scraper.js");
            // Uruchom scraping z konfiguracją równoległości
            const result = await intelligentScrapeDataSource(job.sourceId, job.userId, {
                ...job.config,
                maxPagesParallel: this.config.maxPagesParallel, // Przekaż konfigurację równoległości
            });
            // Zadanie zakończone sukcesem
            job.status = "completed";
            job.finishedAt = new Date();
            job.result = result;
            this.runningJobs.delete(job.id);
            this.completedJobs.push(job);
            console.log(`[ScrapingQueue] Completed job ${job.id} for source ${job.sourceId} (duration: ${job.finishedAt.getTime() - job.startedAt.getTime()}ms)`);
            this.emit("job:completed", job);
            // Powiadom przez WebSocket - zadanie zakończone
            wsHub.updateTask(job.userId, job.id, {
                status: "completed",
                description: `Scraping zakończony pomyślnie`,
            });
            // Aktualizuj background_tasks
            backgroundTaskService
                .updateByJobId(job.id, {
                status: "completed",
                progress: 100,
                description: "Scraping zakończony pomyślnie",
            })
                .catch((err) => console.error("[ScrapingQueue] Background task error:", err));
        }
        catch (error) {
            // Zadanie zakończone błędem
            job.status = "failed";
            job.finishedAt = new Date();
            job.error = error instanceof Error ? error.message : String(error);
            this.runningJobs.delete(job.id);
            this.failedJobs.push(job);
            console.error(`[ScrapingQueue] Failed job ${job.id} for source ${job.sourceId}:`, error);
            this.emit("job:failed", job);
            // Powiadom przez WebSocket - błąd zadania
            wsHub.updateTask(job.userId, job.id, {
                status: "failed",
                description: `Błąd: ${job.error}`,
                error: job.error,
            });
            // Aktualizuj background_tasks
            backgroundTaskService
                .updateByJobId(job.id, {
                status: "failed",
                error_message: job.error,
            })
                .catch((err) => console.error("[ScrapingQueue] Background task error:", err));
        }
        finally {
            // Kontynuuj przetwarzanie kolejki
            this.processQueue();
        }
    }
    /**
     * Pobierz status zadania
     */
    getJobStatus(jobId) {
        // Sprawdź w kolejce
        const queued = this.queue.find((j) => j.id === jobId);
        if (queued)
            return queued;
        // Sprawdź w uruchomionych
        const running = this.runningJobs.get(jobId);
        if (running)
            return running;
        // Sprawdź w zakończonych
        const completed = this.completedJobs.find((j) => j.id === jobId);
        if (completed)
            return completed;
        // Sprawdź w nieudanych
        const failed = this.failedJobs.find((j) => j.id === jobId);
        if (failed)
            return failed;
        return null;
    }
    /**
     * Pobierz statystyki kolejki
     */
    getStats() {
        return {
            queued: this.queue.length,
            running: this.runningJobs.size,
            completed: this.completedJobs.length,
            failed: this.failedJobs.length,
            totalProcessed: this.completedJobs.length + this.failedJobs.length,
            activeJobs: Array.from(this.runningJobs.values()),
        };
    }
    /**
     * Anuluj zadanie (jeśli jest w kolejce)
     */
    cancelJob(jobId) {
        const index = this.queue.findIndex((j) => j.id === jobId);
        if (index !== -1) {
            const job = this.queue.splice(index, 1)[0];
            if (job) {
                job.status = "failed";
                job.error = "Cancelled by user";
                this.failedJobs.push(job);
                console.log(`[ScrapingQueue] Cancelled job ${jobId}`);
                this.emit("job:cancelled", job);
                return true;
            }
        }
        // Nie można anulować zadania, które już się wykonuje
        return false;
    }
    /**
     * Wyczyść historię zakończonych zadań
     */
    clearHistory() {
        this.completedJobs = [];
        this.failedJobs = [];
        console.log("[ScrapingQueue] Cleared job history");
    }
    /**
     * Pobierz konfigurację równoległości dla scrapingu
     */
    getParallelConfig() {
        return {
            maxPagesParallel: this.config.maxPagesParallel,
        };
    }
    /**
     * Dodaj wiele źródeł do kolejki naraz (bulk enqueue)
     * Używane przez przycisk "Scrapuj wszystkie"
     */
    async enqueueBulk(sources) {
        const queued = [];
        const skipped = [];
        for (const source of sources) {
            // Sprawdź czy źródło już jest w kolejce lub się wykonuje
            const existingQueued = this.queue.find((j) => j.sourceId === source.sourceId);
            const existingRunning = Array.from(this.runningJobs.values()).find((j) => j.sourceId === source.sourceId);
            if (existingQueued || existingRunning) {
                skipped.push(source.sourceId);
                continue;
            }
            // Oblicz priorytet na podstawie typu źródła
            let priority = source.priority ?? this.config.defaultPriority;
            if (source.sourceType === "youtube")
                priority += 20;
            if (source.sourceType === "bip" || source.sourceType === "scraper_bip")
                priority += 15;
            if (source.sourceType === "municipality")
                priority += 10;
            const jobId = await this.enqueue(source.sourceId, source.userId, {
                priority,
            });
            queued.push(jobId);
        }
        console.log(`[ScrapingQueue] Bulk enqueue: ${queued.length} queued, ${skipped.length} skipped`);
        return {
            queued,
            skipped,
            totalQueued: queued.length,
        };
    }
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Oblicz priorytet źródła na podstawie metadanych
 */
export function calculateSourcePriority(source) {
    let priority = 50; // Domyślny priorytet
    // Wyższy priorytet dla źródeł YouTube (sesje rady)
    if (source.type === "youtube") {
        priority += 20;
    }
    // Wyższy priorytet dla źródeł BIP
    if (source.type === "bip") {
        priority += 15;
    }
    // Wyższy priorytet dla źródeł, które dawno nie były scrapowane
    if (source.last_scraped_at) {
        const daysSinceLastScrape = (Date.now() - new Date(source.last_scraped_at).getTime()) /
            (1000 * 60 * 60 * 24);
        if (daysSinceLastScrape > 7) {
            priority += 10; // Nie scrapowane przez tydzień
        }
        else if (daysSinceLastScrape > 30) {
            priority += 20; // Nie scrapowane przez miesiąc
        }
    }
    else {
        priority += 30; // Nigdy nie scrapowane - najwyższy priorytet
    }
    // Priorytet z metadanych (jeśli ustawiony ręcznie)
    if (source.metadata?.priority) {
        priority = source.metadata.priority;
    }
    return Math.min(100, Math.max(0, priority)); // Ogranicz do 0-100
}
//# sourceMappingURL=scraping-queue.js.map