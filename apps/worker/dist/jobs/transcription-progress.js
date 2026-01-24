/**
 * Transcription Progress Helper - Zarządzanie detailed progress w workerze
 */
const STEPS = [
    {
        name: "download",
        label: "📥 Pobieranie audio",
        globalProgressRange: [0, 15],
    },
    {
        name: "preprocessing",
        label: "🎚️ Przetwarzanie audio",
        globalProgressRange: [15, 25],
    },
    {
        name: "transcription",
        label: "🎤 Transkrypcja",
        globalProgressRange: [25, 65],
    },
    {
        name: "analysis",
        label: "🔍 Analiza i identyfikacja",
        globalProgressRange: [65, 85],
    },
    {
        name: "saving",
        label: "💾 Zapisywanie do bazy",
        globalProgressRange: [85, 100],
    },
];
export class TranscriptionProgressTracker {
    detailedProgress;
    job;
    stepStartTimes = new Map();
    constructor(job) {
        this.job = job;
        this.detailedProgress = {
            globalProgress: 0,
            globalMessage: "Inicjalizacja...",
            currentStep: "download",
            steps: STEPS.map((step) => ({
                name: step.name,
                label: step.label,
                status: "pending",
                progress: 0,
            })),
            startedAt: new Date().toISOString(),
            lastUpdate: new Date().toISOString(),
        };
    }
    /**
     * Rozpocznij krok
     */
    async startStep(stepName, message, details) {
        this.stepStartTimes.set(stepName, Date.now());
        const stepIndex = this.detailedProgress.steps.findIndex((s) => s.name === stepName);
        if (stepIndex === -1)
            return;
        // Aktualizuj status kroku
        this.detailedProgress.steps[stepIndex] = {
            ...this.detailedProgress.steps[stepIndex],
            status: "active",
            progress: 0,
            startTime: new Date().toISOString(),
            details: details || {},
        };
        // Aktualizuj globalny progress
        const stepConfig = STEPS.find((s) => s.name === stepName);
        if (stepConfig) {
            this.detailedProgress.globalProgress = stepConfig.globalProgressRange[0];
        }
        this.detailedProgress.currentStep = stepName;
        this.detailedProgress.globalMessage = message;
        this.detailedProgress.lastUpdate = new Date().toISOString();
        await this.updateJob();
    }
    /**
     * Aktualizuj postęp kroku
     */
    async updateStep(stepName, stepProgress, message, details) {
        const stepIndex = this.detailedProgress.steps.findIndex((s) => s.name === stepName);
        if (stepIndex === -1)
            return;
        // Aktualizuj progress kroku
        this.detailedProgress.steps[stepIndex].progress = Math.min(100, Math.max(0, stepProgress));
        // Merge details
        if (details) {
            this.detailedProgress.steps[stepIndex].details = {
                ...this.detailedProgress.steps[stepIndex].details,
                ...details,
            };
        }
        // Oblicz globalny progress (interpolacja w range kroku)
        const stepConfig = STEPS.find((s) => s.name === stepName);
        if (stepConfig) {
            const [min, max] = stepConfig.globalProgressRange;
            const range = max - min;
            this.detailedProgress.globalProgress = Math.round(min + (range * stepProgress) / 100);
        }
        if (message) {
            this.detailedProgress.globalMessage = message;
        }
        this.detailedProgress.lastUpdate = new Date().toISOString();
        // Estymacja czasu
        this.updateTimeEstimate();
        await this.updateJob();
    }
    /**
     * Zakończ krok
     */
    async completeStep(stepName, details) {
        const stepIndex = this.detailedProgress.steps.findIndex((s) => s.name === stepName);
        if (stepIndex === -1)
            return;
        const startTime = this.stepStartTimes.get(stepName);
        const duration = startTime ? (Date.now() - startTime) / 1000 : undefined;
        // Aktualizuj status kroku
        this.detailedProgress.steps[stepIndex] = {
            ...this.detailedProgress.steps[stepIndex],
            status: "completed",
            progress: 100,
            endTime: new Date().toISOString(),
            duration,
            details: {
                ...this.detailedProgress.steps[stepIndex].details,
                ...details,
            },
        };
        // Ustaw globalny progress na koniec range kroku
        const stepConfig = STEPS.find((s) => s.name === stepName);
        if (stepConfig) {
            this.detailedProgress.globalProgress = stepConfig.globalProgressRange[1];
        }
        this.detailedProgress.lastUpdate = new Date().toISOString();
        await this.updateJob();
    }
    /**
     * Oznacz krok jako failed
     */
    async failStep(stepName, error) {
        const stepIndex = this.detailedProgress.steps.findIndex((s) => s.name === stepName);
        if (stepIndex === -1)
            return;
        const startTime = this.stepStartTimes.get(stepName);
        const duration = startTime ? (Date.now() - startTime) / 1000 : undefined;
        this.detailedProgress.steps[stepIndex] = {
            ...this.detailedProgress.steps[stepIndex],
            status: "failed",
            endTime: new Date().toISOString(),
            duration,
            details: {
                ...this.detailedProgress.steps[stepIndex].details,
                error,
            },
        };
        this.detailedProgress.lastUpdate = new Date().toISOString();
        await this.updateJob();
    }
    /**
     * Oblicz estymację czasu pozostałego
     */
    updateTimeEstimate() {
        const startedAt = new Date(this.detailedProgress.startedAt).getTime();
        const elapsed = (Date.now() - startedAt) / 1000; // sekundy
        if (this.detailedProgress.globalProgress > 0) {
            const estimatedTotal = elapsed / (this.detailedProgress.globalProgress / 100);
            const remaining = Math.max(0, estimatedTotal - elapsed);
            this.detailedProgress.estimatedTimeRemaining = Math.round(remaining);
        }
    }
    /**
     * Aktualizuj job w queue
     */
    async updateJob() {
        await this.job.updateProgress({
            progress: this.detailedProgress.globalProgress,
            message: this.detailedProgress.globalMessage,
            detailedProgress: this.detailedProgress,
        });
    }
    /**
     * Pobierz aktualny detailed progress
     */
    getDetailedProgress() {
        return this.detailedProgress;
    }
}
//# sourceMappingURL=transcription-progress.js.map