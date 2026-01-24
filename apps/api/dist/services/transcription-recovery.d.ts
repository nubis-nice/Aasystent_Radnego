/**
 * Transcription Recovery Service - Odzyskiwanie utkniętych zadań transkrypcji
 *
 * Funkcje:
 * - Wykrywanie zadań które utknęły po restarcie API
 * - Auto-recovery przy starcie aplikacji
 * - Oznaczanie zadań jako failed po timeout
 */
export declare class TranscriptionRecoveryService {
    /**
     * Odzyskaj utknięte zadania przy starcie aplikacji
     */
    static recoverStuckJobs(): Promise<{
        recovered: number;
        failed: number;
    }>;
    /**
     * Oznacz zadania które przekroczyły timeout
     */
    static markTimeoutJobs(): Promise<number>;
    /**
     * Wyczyść stare zadania (completed/failed starsze niż 30 dni)
     */
    static cleanupOldJobs(): Promise<number>;
    /**
     * Uruchom pełny recovery cycle
     */
    static runRecoveryCycle(): Promise<void>;
}
/**
 * Automatyczny recovery przy starcie aplikacji
 */
export declare function initializeTranscriptionRecovery(): Promise<void>;
//# sourceMappingURL=transcription-recovery.d.ts.map