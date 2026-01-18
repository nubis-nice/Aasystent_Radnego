/**
 * Transcription Recovery Service - Odzyskiwanie utkniętych zadań transkrypcji
 *
 * Funkcje:
 * - Wykrywanie zadań które utknęły po restarcie API
 * - Auto-recovery przy starcie aplikacji
 * - Oznaczanie zadań jako failed po timeout
 */

import { createClient } from "@supabase/supabase-js";
import { transcriptionQueue } from "./transcription-queue.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class TranscriptionRecoveryService {
  /**
   * Odzyskaj utknięte zadania przy starcie aplikacji
   */
  static async recoverStuckJobs(): Promise<{
    recovered: number;
    failed: number;
  }> {
    console.log("[TranscriptionRecovery] Checking for stuck jobs...");

    // Znajdź zadania które są w trakcie ale nie są w queue
    const { data: stuckJobs, error } = await supabase
      .from("transcription_jobs")
      .select("*")
      .in("status", [
        "pending",
        "downloading",
        "preprocessing",
        "transcribing",
        "analyzing",
        "saving",
      ])
      .lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()); // Starsze niż 10 minut

    if (error || !stuckJobs || stuckJobs.length === 0) {
      console.log("[TranscriptionRecovery] No stuck jobs found");
      return { recovered: 0, failed: 0 };
    }

    console.log(
      `[TranscriptionRecovery] Found ${stuckJobs.length} potentially stuck jobs`
    );

    let recovered = 0;
    let failed = 0;

    for (const job of stuckJobs) {
      try {
        // Sprawdź czy job istnieje w queue
        const queueStatus = await transcriptionQueue.getJobStatus(job.id);

        if (!queueStatus) {
          // Job nie istnieje w queue - został utracony
          console.log(
            `[TranscriptionRecovery] Job ${job.id} not in queue - marking as failed`
          );

          await supabase
            .from("transcription_jobs")
            .update({
              status: "failed",
              error: "Process interrupted (API restart)",
              completed_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          failed++;
        } else if (queueStatus.status === "failed") {
          // Job failed w queue ale DB nie jest updated
          console.log(
            `[TranscriptionRecovery] Job ${job.id} failed in queue - updating DB`
          );

          await supabase
            .from("transcription_jobs")
            .update({
              status: "failed",
              error: queueStatus.error || "Unknown error",
              completed_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          failed++;
        } else {
          // Job nadal w queue - OK
          console.log(
            `[TranscriptionRecovery] Job ${job.id} still in queue - OK`
          );
          recovered++;
        }
      } catch (err) {
        console.error(
          `[TranscriptionRecovery] Error processing job ${job.id}:`,
          err
        );
      }
    }

    console.log(
      `[TranscriptionRecovery] Recovery complete: ${recovered} recovered, ${failed} marked as failed`
    );

    return { recovered, failed };
  }

  /**
   * Oznacz zadania które przekroczyły timeout
   */
  static async markTimeoutJobs(): Promise<number> {
    const TIMEOUT_HOURS = 3; // 3 godziny timeout
    const timeoutDate = new Date(Date.now() - TIMEOUT_HOURS * 60 * 60 * 1000);

    const { data: timeoutJobs, error } = await supabase
      .from("transcription_jobs")
      .select("id")
      .in("status", [
        "downloading",
        "preprocessing",
        "transcribing",
        "analyzing",
        "saving",
      ])
      .lt("created_at", timeoutDate.toISOString());

    if (error || !timeoutJobs || timeoutJobs.length === 0) {
      return 0;
    }

    console.log(
      `[TranscriptionRecovery] Found ${timeoutJobs.length} timeout jobs`
    );

    for (const job of timeoutJobs) {
      await supabase
        .from("transcription_jobs")
        .update({
          status: "failed",
          error: `Timeout after ${TIMEOUT_HOURS} hours`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }

    return timeoutJobs.length;
  }

  /**
   * Wyczyść stare zadania (completed/failed starsze niż 30 dni)
   */
  static async cleanupOldJobs(): Promise<number> {
    const RETENTION_DAYS = 30;
    const cutoffDate = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    const { error, count } = await supabase
      .from("transcription_jobs")
      .delete()
      .in("status", ["completed", "failed"])
      .lt("completed_at", cutoffDate.toISOString());

    if (error) {
      console.error("[TranscriptionRecovery] Cleanup error:", error);
      return 0;
    }

    if (count && count > 0) {
      console.log(`[TranscriptionRecovery] Cleaned up ${count} old jobs`);
    }

    return count || 0;
  }

  /**
   * Uruchom pełny recovery cycle
   */
  static async runRecoveryCycle(): Promise<void> {
    console.log("[TranscriptionRecovery] Starting recovery cycle...");

    const stuck = await this.recoverStuckJobs();
    const timeout = await this.markTimeoutJobs();
    const cleaned = await this.cleanupOldJobs();

    console.log(
      `[TranscriptionRecovery] Cycle complete: ${stuck.recovered} recovered, ${
        stuck.failed + timeout
      } failed, ${cleaned} cleaned`
    );
  }
}

/**
 * Automatyczny recovery przy starcie aplikacji
 */
export async function initializeTranscriptionRecovery(): Promise<void> {
  console.log("[TranscriptionRecovery] Initializing recovery system...");

  // Odzyskaj utknięte zadania
  await TranscriptionRecoveryService.recoverStuckJobs();

  // Ustaw cykliczne sprawdzanie (co godzinę)
  globalThis.setInterval(async () => {
    try {
      await TranscriptionRecoveryService.runRecoveryCycle();
    } catch (error) {
      console.error("[TranscriptionRecovery] Cycle error:", error);
    }
  }, 60 * 60 * 1000); // Co godzinę

  console.log("[TranscriptionRecovery] Recovery system initialized");
}
