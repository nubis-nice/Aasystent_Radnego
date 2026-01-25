import { spawn } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers";
import { getSTTClient, getLLMClient, getAIConfig } from "../ai/index.js";
import { getAudioPreprocessor } from "./audio-preprocessor.js";
export class YouTubeDownloader {
    sttClient = null;
    llmClient = null;
    tempDir;
    userId = null;
    sttModel = "whisper-1";
    llmModel = "gpt-4o";
    constructor() {
        this.tempDir = join(tmpdir(), "aasystent-youtube");
        if (!existsSync(this.tempDir)) {
            mkdirSync(this.tempDir, { recursive: true });
        }
    }
    /**
     * Normalizuj nazwę modelu STT dla faster-whisper-server
     * Mapuje różne formaty nazw na prawidłowe nazwy modeli
     */
    normalizeSTTModel(modelName, provider) {
        // Dla OpenAI API używamy whisper-1
        if (provider === "openai") {
            return "whisper-1";
        }
        // Dla faster-whisper-server normalizujemy nazwy
        const normalizedModel = modelName.toLowerCase().trim();
        // Usuń suffix :latest jeśli istnieje (np. dimavz/whisper-tiny:latest)
        const withoutTag = normalizedModel.replace(/:latest$/, "");
        // Mapowanie nieprawidłowych nazw na prawidłowe
        const modelMapping = {
            whisper: "large-v3",
            "whisper-1": "large-v3",
            "whisper-tiny": "tiny",
            "whisper-base": "base",
            "whisper-small": "small",
            "whisper-medium": "medium",
            "whisper-large": "large-v3",
            "whisper-large-v2": "large-v2",
            "whisper-large-v3": "large-v3",
            "dimavz/whisper-tiny": "tiny",
            "dimavz/whisper-base": "base",
            "dimavz/whisper-small": "small",
            "dimavz/whisper-medium": "medium",
            "dimavz/whisper-large": "large-v3",
        };
        // Sprawdź czy mamy mapowanie
        if (modelMapping[withoutTag]) {
            console.log(`[YouTubeDownloader] Normalized STT model: ${modelName} -> ${modelMapping[withoutTag]}`);
            return modelMapping[withoutTag];
        }
        // Sprawdź czy to już prawidłowy format Systran/faster-whisper-*
        if (withoutTag.startsWith("systran/faster-whisper-")) {
            return modelName; // Już prawidłowy format
        }
        // Sprawdź czy to prawidłowy rozmiar modelu
        const validSizes = [
            "tiny",
            "tiny.en",
            "base",
            "base.en",
            "small",
            "small.en",
            "medium",
            "medium.en",
            "large",
            "large-v1",
            "large-v2",
            "large-v3",
            "distil-large-v2",
            "distil-medium.en",
            "distil-small.en",
            "distil-large-v3",
        ];
        if (validSizes.includes(withoutTag)) {
            return withoutTag;
        }
        // Domyślnie użyj large-v3 dla najlepszej jakości
        console.warn(`[YouTubeDownloader] Unknown STT model "${modelName}", using large-v3`);
        return "large-v3";
    }
    /**
     * Inicjalizacja z konfiguracją użytkownika przez AIClientFactory
     */
    async initializeWithUserConfig(userId) {
        this.userId = userId;
        // Pobierz klienta STT (Speech-to-Text) z fabryki
        this.sttClient = await getSTTClient(userId);
        // Pobierz konfigurację STT aby znać model
        const sttConfig = await getAIConfig(userId, "stt");
        this.sttModel = this.normalizeSTTModel(sttConfig.modelName, sttConfig.provider);
        // Pobierz klienta LLM do analizy transkryptu
        this.llmClient = await getLLMClient(userId);
        // Pobierz konfigurację LLM aby znać model
        const llmConfig = await getAIConfig(userId, "llm");
        this.llmModel = llmConfig.modelName;
        console.log(`[YouTubeDownloader] Initialized for user ${userId.substring(0, 8)}...`);
        console.log(`[YouTubeDownloader] STT: provider=${sttConfig.provider}, model=${this.sttModel}, baseUrl=${sttConfig.baseUrl}`);
        console.log(`[YouTubeDownloader] LLM: model=${this.llmModel}`);
    }
    async downloadAudio(videoUrl, enableChunking = true) {
        try {
            const videoId = this.extractVideoId(videoUrl);
            if (!videoId) {
                return { success: false, error: "Nieprawidłowy URL YouTube" };
            }
            const baseId = randomUUID();
            const rawPath = join(this.tempDir, `audio-${baseId}-raw`); // yt-dlp doda rozszerzenie
            const whisperPath = join(this.tempDir, `audio-${baseId}.wav`);
            console.log(`[YouTubeDownloader] Downloading bestaudio: ${videoUrl}`);
            const result = await this.runYtDlp(videoUrl, rawPath);
            if (!result.success || !result.audioPath) {
                return result;
            }
            // BEST PRACTICE: Konwertuj do formatu optymalnego dla Whisper
            // 16kHz mono 16-bit PCM WAV z normalizacją głośności
            console.log(`[YouTubeDownloader] Converting to Whisper format...`);
            const preprocessor = getAudioPreprocessor();
            await preprocessor.convertToWhisperFormat(result.audioPath, whisperPath);
            // Usuń surowy plik
            try {
                unlinkSync(result.audioPath);
            }
            catch {
                /* ignore */
            }
            // Dziel na segmenty jeśli potrzeba
            if (enableChunking) {
                console.log(`[YouTubeDownloader] Checking if splitting needed...`);
                const splitResult = await preprocessor.splitAudioByTime(whisperPath, 600);
                if (splitResult.success && splitResult.parts.length > 0) {
                    console.log(`[YouTubeDownloader] Split into ${splitResult.parts.length} parts`);
                    return {
                        success: true,
                        audioPath: whisperPath,
                        title: result.title,
                        duration: result.duration,
                        parts: splitResult.parts,
                        splitMetadata: {
                            totalDuration: splitResult.totalDuration,
                            chunkingEnabled: true,
                        },
                    };
                }
                else {
                    console.log(`[YouTubeDownloader] No splitting needed (audio < 10 min)`);
                }
            }
            return {
                success: true,
                audioPath: whisperPath,
                title: result.title,
                duration: result.duration,
            };
        }
        catch (error) {
            console.error("[YouTubeDownloader] Download error:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Błąd pobierania audio",
            };
        }
    }
    extractVideoId(url) {
        const match = url.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
        return match ? match[1] : null;
    }
    runYtDlp(videoUrl, outputPath) {
        return new Promise((resolve) => {
            // Remove extension - yt-dlp will add extension
            const outputBase = outputPath.replace(/\.(mp3|wav|webm|m4a)$/, "");
            // BEST PRACTICE dla Whisper Large v3:
            // 1. Pobierz audio (preferuj m4a/webm, fallback do dowolnego)
            // 2. Konwertuj do 16kHz mono 16-bit PCM WAV w osobnym kroku
            const args = [
                "-x", // Extract audio
                "-f",
                "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best", // Fallback chain
                "--audio-format",
                "m4a", // Konwertuj do m4a jeśli inny format
                "-o",
                `${outputBase}.%(ext)s`,
                "--no-playlist",
                "--print",
                "after_move:filepath",
                "--print",
                "%(title)s|||%(duration_string)s",
                // Użyj tylko web client (unikaj ios który wymaga PO Token)
                "--extractor-args",
                "youtube:player_client=web",
                videoUrl,
            ];
            // Add FFmpeg location if specified in environment
            const ffmpegPath = process.env.FFMPEG_PATH;
            if (ffmpegPath) {
                args.unshift("--ffmpeg-location", ffmpegPath);
            }
            // Use full path to yt-dlp
            const ytdlpPath = process.env.YTDLP_PATH ||
                "C:\\ProgramData\\chocolatey\\lib\\yt-dlp\\tools\\x64\\yt-dlp.exe";
            console.log(`[YouTubeDownloader] Using yt-dlp path: ${ytdlpPath}`);
            console.log(`[YouTubeDownloader] Running command with args: ${args
                .slice(0, 5)
                .join(" ")}...`);
            const childProcess = spawn(ytdlpPath, args);
            let stdout = "";
            let stderr = "";
            childProcess.stdout.on("data", (data) => {
                stdout += data.toString();
            });
            childProcess.stderr.on("data", (data) => {
                stderr += data.toString();
            });
            childProcess.on("close", (code) => {
                if (code === 0) {
                    // Parse output - yt-dlp prints in order: filepath, then title|||duration
                    // But we need to identify which line is which
                    const lines = stdout
                        .trim()
                        .split("\n")
                        .filter((l) => l.trim());
                    let actualFilePath = "";
                    let title = "Nieznany tytuł";
                    let duration = "0:00";
                    for (const line of lines) {
                        if (line.includes("|||")) {
                            // This is the metadata line: title|||duration
                            const parts = line.split("|||");
                            title = parts[0] || title;
                            duration = parts[1] || duration;
                        }
                        else if (line.endsWith(".m4a") ||
                            line.endsWith(".webm") ||
                            line.endsWith(".mp3") ||
                            line.endsWith(".wav") ||
                            line.endsWith(".opus")) {
                            // This is the filepath
                            actualFilePath = line;
                        }
                    }
                    // Fallback to expected output path if no filepath found
                    if (!actualFilePath) {
                        actualFilePath = `${outputBase}.m4a`;
                    }
                    console.log(`[YouTubeDownloader] Output file: ${actualFilePath}`);
                    resolve({
                        success: true,
                        audioPath: actualFilePath,
                        title: title || "Nieznany tytuł",
                        duration: duration || "0:00",
                    });
                }
                else {
                    console.error("[YouTubeDownloader] yt-dlp stderr:", stderr);
                    // Check for common errors
                    if (stderr.includes("not found") ||
                        stderr.includes("nie odnaleziono")) {
                        resolve({
                            success: false,
                            error: "yt-dlp nie jest zainstalowany. Zainstaluj go poleceniem: pip install yt-dlp",
                        });
                    }
                    else if (stderr.includes("File is larger than max-filesize")) {
                        resolve({
                            success: false,
                            error: "Plik audio jest zbyt duży (max 25MB). Wybierz krótsze wideo.",
                        });
                    }
                    else {
                        resolve({
                            success: false,
                            error: `Błąd pobierania: ${stderr.slice(0, 200)}`,
                        });
                    }
                }
            });
            childProcess.on("error", (err) => {
                if (err.code === "ENOENT") {
                    resolve({
                        success: false,
                        error: "yt-dlp nie jest zainstalowany. Zainstaluj go poleceniem: pip install yt-dlp",
                    });
                }
                else {
                    resolve({
                        success: false,
                        error: `Błąd uruchomienia yt-dlp: ${err.message}`,
                    });
                }
            });
        });
    }
    /**
     * Transkrybuj pojedynczy plik audio (dla krótkich nagrań)
     */
    async transcribeSingleFile(audioPath) {
        if (!this.sttClient) {
            throw new Error("STT client not initialized");
        }
        const { createReadStream } = await import("node:fs");
        const audioStream = createReadStream(audioPath);
        console.log(`[YouTubeDownloader] Using STT model: ${this.sttModel}`);
        console.log(`[YouTubeDownloader] Starting STT transcription (timeout: 10 minutes)...`);
        // Prompt kontekstowy dla Whisper - bez konkretnych słów które mogą być powtarzane
        const contextPrompt = "Transkrypcja oficjalnego posiedzenia samorządowego w języku polskim. " +
            "Nagranie zawiera formalne wypowiedzi, głosowania i dyskusje.";
        // Timeout 10 minut
        const sttTimeoutMs = 10 * 60 * 1000;
        const sttStartTime = Date.now();
        const transcriptionPromise = this.sttClient.audio.transcriptions.create({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            file: audioStream,
            model: this.sttModel,
            language: "pl",
            response_format: "text",
            prompt: contextPrompt,
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`STT API timeout po ${sttTimeoutMs / 1000}s`)), sttTimeoutMs));
        try {
            const transcription = await Promise.race([
                transcriptionPromise,
                timeoutPromise,
            ]);
            const sttDuration = ((Date.now() - sttStartTime) / 1000).toFixed(1);
            console.log(`[YouTubeDownloader] STT completed in ${sttDuration}s`);
            return transcription;
        }
        catch (error) {
            const sttDuration = ((Date.now() - sttStartTime) / 1000).toFixed(1);
            console.error(`[YouTubeDownloader] STT failed after ${sttDuration}s:`, error);
            throw new Error(`Błąd transkrypcji STT: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Transkrybuj pojedynczy chunk audio z timeout
     */
    async transcribeChunk(chunkPath, chunkIndex, totalChunks) {
        if (!this.sttClient) {
            throw new Error("STT client not initialized");
        }
        const { createReadStream } = await import("node:fs");
        const audioStream = createReadStream(chunkPath);
        console.log(`[YouTubeDownloader] Transcribing chunk ${chunkIndex}/${totalChunks}: ${chunkPath}`);
        // Prompt kontekstowy dla Whisper - bez konkretnych słów które mogą być powtarzane
        // Informuje model o kontekście bez powodowania halucynacji
        const contextPrompt = "Transkrypcja oficjalnego posiedzenia samorządowego w języku polskim. " +
            "Nagranie zawiera formalne wypowiedzi, głosowania i dyskusje.";
        // Timeout 5 minut per chunk (każdy chunk to max 10 min audio)
        const chunkTimeoutMs = 5 * 60 * 1000;
        const startTime = Date.now();
        const transcriptionPromise = this.sttClient.audio.transcriptions.create({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            file: audioStream,
            model: this.sttModel,
            language: "pl",
            response_format: "text",
            prompt: contextPrompt,
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Chunk ${chunkIndex} timeout po ${chunkTimeoutMs / 1000}s`)), chunkTimeoutMs));
        const result = await Promise.race([transcriptionPromise, timeoutPromise]);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[YouTubeDownloader] Chunk ${chunkIndex}/${totalChunks} completed in ${duration}s`);
        return result;
    }
    async transcribeAndAnalyze(audioPath, videoId, videoTitle, videoUrl, precomputedParts) {
        if (!this.sttClient) {
            throw new Error("STT client not initialized. Call initializeWithUserConfig first.");
        }
        let processedPath = audioPath;
        let audioAnalysis;
        try {
            console.log(`[YouTubeDownloader] Transcribing: ${audioPath}`);
            // UWAGA: Stary preprocessAdaptive() wyłączony - preprocessing jest teraz per-segment
            // w chunked transcription (prepareSegmentForWhisper) dla lepszej jakości
            // i uniknięcia podwójnego dzielenia pliku
            // Read audio file
            const audioBuffer = readFileSync(processedPath);
            const fileSizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
            console.log(`[YouTubeDownloader] Audio file size: ${fileSizeMB}MB`);
            // Sprawdź czy audio jest długie (> 25MB) lub mamy precomputed parts
            const useChunkedTranscription = audioBuffer.length > 25 * 1024 * 1024 ||
                (precomputedParts && precomputedParts.length > 0);
            let rawTranscript;
            if (useChunkedTranscription) {
                console.log(`[YouTubeDownloader] Large audio detected, using chunked transcription...`);
                const preprocessor = getAudioPreprocessor();
                // Użyj precomputed parts jeśli dostępne, w przeciwnym razie podziel
                let parts;
                if (precomputedParts && precomputedParts.length > 0) {
                    console.log(`[YouTubeDownloader] Using ${precomputedParts.length} precomputed parts (no re-split)`);
                    parts = precomputedParts;
                }
                else {
                    // Fallback: podziel audio na 10-minutowe części
                    const splitResult = await preprocessor.splitAudioByTime(processedPath, 600);
                    if (splitResult.success && splitResult.parts.length > 0) {
                        parts = splitResult.parts;
                        console.log(`[YouTubeDownloader] Split into ${parts.length} chunks`);
                    }
                    else {
                        parts = [];
                    }
                }
                if (parts.length > 0) {
                    console.log(`[YouTubeDownloader] Transcribing ${parts.length} chunks...`);
                    const transcripts = [];
                    for (let i = 0; i < parts.length; i++) {
                        const part = parts[i];
                        try {
                            // Audio jest już w formacie Whisper (16kHz mono) - transkrybuj bezpośrednio
                            const chunkTranscript = await this.transcribeChunk(part.filePath, i + 1, parts.length);
                            transcripts.push(chunkTranscript);
                        }
                        catch (chunkError) {
                            console.error(`[YouTubeDownloader] Chunk ${i + 1} failed:`, chunkError);
                            transcripts.push(`[Chunk ${i + 1} failed: ${chunkError instanceof Error
                                ? chunkError.message
                                : "Unknown error"}]`);
                        }
                    }
                    // Połącz transkrypcje wszystkich chunków
                    rawTranscript = transcripts.join("\n\n");
                    console.log(`[YouTubeDownloader] All chunks transcribed, total length: ${rawTranscript.length} chars`);
                }
                else {
                    // Fallback - audio jest już w formacie Whisper
                    console.log(`[YouTubeDownloader] Split failed or not needed, using single transcription`);
                    rawTranscript = await this.transcribeSingleFile(processedPath);
                }
            }
            else {
                // Audio jest już w formacie Whisper (16kHz mono) - transkrybuj bezpośrednio
                console.log(`[YouTubeDownloader] Short audio, direct transcription...`);
                rawTranscript = await this.transcribeSingleFile(processedPath);
            }
            console.log(`[YouTubeDownloader] Transcript length: ${rawTranscript.length} chars`);
            if (!rawTranscript || rawTranscript.trim().length === 0) {
                return {
                    success: false,
                    rawTranscript: "",
                    formattedTranscript: "",
                    segments: [],
                    summary: {
                        averageTension: 0,
                        dominantSentiment: "neutral",
                        overallCredibility: 0,
                        overallCredibilityEmoji: "🔴",
                        speakerCount: 0,
                        duration: "0:00",
                    },
                    metadata: { videoId, videoTitle, videoUrl },
                    error: "Nie udało się rozpoznać mowy w nagraniu",
                };
            }
            // Correct transcription errors
            const correctedTranscript = await this.correctTranscript(rawTranscript);
            console.log("[YouTubeDownloader] Transcript corrected");
            // Analyze with GPT-4
            const analysis = await this.analyzeTranscript(correctedTranscript);
            // Format output as Markdown for export
            const formattedTranscript = this.formatTranscriptMarkdown(correctedTranscript, analysis.segments, analysis.summary, videoTitle, videoUrl);
            // Cleanup temp files
            try {
                unlinkSync(audioPath);
                if (processedPath !== audioPath && existsSync(processedPath)) {
                    unlinkSync(processedPath);
                }
            }
            catch {
                /* ignore cleanup errors */
            }
            return {
                success: true,
                rawTranscript,
                formattedTranscript,
                segments: analysis.segments,
                summary: analysis.summary,
                metadata: { videoId, videoTitle, videoUrl },
                audioAnalysis,
            };
        }
        catch (error) {
            console.error("[YouTubeDownloader] Transcription error:", error);
            // Cleanup temp files
            try {
                unlinkSync(audioPath);
                if (processedPath !== audioPath && existsSync(processedPath)) {
                    unlinkSync(processedPath);
                }
            }
            catch {
                /* ignore cleanup errors */
            }
            return {
                success: false,
                rawTranscript: "",
                formattedTranscript: "",
                segments: [],
                summary: {
                    averageTension: 0,
                    dominantSentiment: "neutral",
                    overallCredibility: 0,
                    overallCredibilityEmoji: "🔴",
                    speakerCount: 0,
                    duration: "0:00",
                },
                metadata: { videoId, videoTitle, videoUrl },
                error: error instanceof Error ? error.message : "Błąd transkrypcji",
            };
        }
    }
    /**
     * Usuwa powtarzające się frazy z transkrypcji (halucynacje Whisper)
     * V3: Algorytm iteracyjny dla fraz wielowyrazowych
     */
    removeRepetitions(text) {
        const originalLength = text.length;
        let cleaned = text;
        console.log(`[YouTubeDownloader] removeRepetitions() input: ${originalLength} chars`);
        // 1. Podziel na elementy (słowa/frazy oddzielone przecinkami)
        const elements = cleaned.split(/,\s*/);
        if (elements.length > 10) {
            // Deduplikacja elementów oddzielonych przecinkami
            const seen = new Map();
            const dedupedElements = [];
            for (const el of elements) {
                const norm = el.trim().toLowerCase();
                if (norm.length < 2)
                    continue;
                const count = seen.get(norm) || 0;
                if (count < 2) {
                    // Pozwól max 2 wystąpienia
                    dedupedElements.push(el.trim());
                    seen.set(norm, count + 1);
                }
            }
            // Jeśli usunęliśmy dużo, użyj nowej wersji
            if (dedupedElements.length < elements.length * 0.5) {
                cleaned = dedupedElements.join(", ");
                console.log(`[YouTubeDownloader] Comma dedup: ${elements.length} -> ${dedupedElements.length} elements`);
            }
        }
        // 2. Podziel na słowa i szukaj powtarzających się sekwencji
        const words = cleaned.split(/\s+/);
        if (words.length > 20) {
            const dedupedWords = [];
            let i = 0;
            while (i < words.length) {
                // Szukaj powtarzających się sekwencji 1-4 słów
                let foundRepeat = false;
                for (let seqLen = 4; seqLen >= 1; seqLen--) {
                    if (i + seqLen * 3 > words.length)
                        continue;
                    const seq = words
                        .slice(i, i + seqLen)
                        .join(" ")
                        .toLowerCase();
                    let repeatCount = 1;
                    let j = i + seqLen;
                    while (j + seqLen <= words.length) {
                        const nextSeq = words
                            .slice(j, j + seqLen)
                            .join(" ")
                            .toLowerCase();
                        // Porównaj z tolerancją na drobne różnice (literówki)
                        if (seq === nextSeq || this.stringSimilarity(seq, nextSeq) > 0.85) {
                            repeatCount++;
                            j += seqLen;
                        }
                        else {
                            break;
                        }
                    }
                    if (repeatCount >= 3) {
                        // Znaleziono 3+ powtórzeń
                        dedupedWords.push(...words.slice(i, i + seqLen));
                        i = j; // Przeskocz wszystkie powtórzenia
                        foundRepeat = true;
                        break;
                    }
                }
                if (!foundRepeat) {
                    dedupedWords.push(words[i]);
                    i++;
                }
            }
            if (dedupedWords.length < words.length * 0.8) {
                cleaned = dedupedWords.join(" ");
                console.log(`[YouTubeDownloader] Word seq dedup: ${words.length} -> ${dedupedWords.length} words`);
            }
        }
        // 3. Podziel na zdania i deduplikuj
        const sentences = cleaned.split(/(?<=[.!?])\s+/);
        const seenSentences = new Set();
        const dedupedSentences = [];
        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (trimmed.length < 3)
                continue;
            const normalized = trimmed
                .toLowerCase()
                .replace(/[^a-ząćęłńóśźż\s]/g, "")
                .trim();
            // Sprawdź czy podobne zdanie już było
            let isDuplicate = false;
            for (const seen of seenSentences) {
                if (normalized === seen ||
                    this.stringSimilarity(normalized, seen) > 0.8) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                dedupedSentences.push(trimmed);
                seenSentences.add(normalized);
            }
        }
        cleaned = dedupedSentences.join(" ");
        // 4. Finalne czyszczenie
        cleaned = cleaned
            .replace(/,\s*,+/g, ",")
            .replace(/\s{2,}/g, " ")
            .replace(/,\s*\./g, ".")
            .trim();
        const removedChars = originalLength - cleaned.length;
        const removedPercent = (removedChars / originalLength) * 100;
        console.log(`[YouTubeDownloader] removeRepetitions() removed ${removedChars} chars (${removedPercent.toFixed(1)}%)`);
        // 5. Wykryj halucynacje Whisper
        // a) Jeśli tekst jest głównie powtórzeniami (>85% usunięte)
        if (removedPercent > 85 && cleaned.length < 200) {
            console.log(`[YouTubeDownloader] Text is mostly repetitions (${removedPercent.toFixed(1)}%), audio has too much noise`);
            return "[Za duże szumy w nagraniu - nie udało się rozpoznać mowy]";
        }
        // b) Jeśli pozostała bardzo krótka unikalna treść w stosunku do oryginału
        // (np. "Dzień dobry" z 10000 znaków oryginału = halucynacja)
        const uniqueWordsCount = new Set(cleaned.toLowerCase().split(/\s+/)).size;
        const originalWordsCount = text.split(/\s+/).length;
        if (uniqueWordsCount < 10 &&
            originalWordsCount > 50 &&
            cleaned.length < originalLength * 0.1) {
            console.log(`[YouTubeDownloader] Detected hallucination: only ${uniqueWordsCount} unique words from ${originalWordsCount} original words`);
            return "[Za duże szumy w nagraniu - nie udało się rozpoznać mowy]";
        }
        // c) Sprawdź czy dominuje jedna fraza (>50% tekstu to ta sama fraza)
        const phraseCount = new Map();
        const phrases = cleaned.split(/[.!?]+/).map((p) => p.trim().toLowerCase());
        for (const phrase of phrases) {
            if (phrase.length > 3) {
                phraseCount.set(phrase, (phraseCount.get(phrase) || 0) + 1);
            }
        }
        const maxPhraseCount = Math.max(...phraseCount.values(), 0);
        if (maxPhraseCount > phrases.length * 0.5 && phrases.length > 5) {
            console.log(`[YouTubeDownloader] Detected repetitive hallucination: one phrase appears ${maxPhraseCount}/${phrases.length} times`);
            return "[Za duże szumy w nagraniu - nie udało się rozpoznać mowy]";
        }
        return cleaned;
    }
    /**
     * Oblicza podobieństwo dwóch stringów (0-1)
     */
    stringSimilarity(str1, str2) {
        if (str1 === str2)
            return 1;
        if (str1.length === 0 || str2.length === 0)
            return 0;
        // Prosty algorytm oparty na wspólnych słowach
        const words1 = new Set(str1.split(/\s+/));
        const words2 = new Set(str2.split(/\s+/));
        let common = 0;
        for (const word of words1) {
            if (words2.has(word))
                common++;
        }
        return (2 * common) / (words1.size + words2.size);
    }
    async correctTranscript(rawTranscript) {
        if (!this.llmClient)
            throw new Error("LLM client not initialized");
        // Najpierw usuń powtórzenia (halucynacje Whisper)
        const deduped = this.removeRepetitions(rawTranscript);
        console.log(`[YouTubeDownloader] After dedup: ${deduped.length} chars (was ${rawTranscript.length})`);
        console.log("[YouTubeDownloader] Correcting transcript errors...");
        const correctionPrompt = `Jesteś korektorem transkrypcji sesji rady miejskiej/gminnej. 

ZADANIE: Popraw błędy w transkrypcji, zachowując oryginalny kontekst i sens wypowiedzi.

ZASADY:
1. Poprawiaj TYLKO oczywiste błędy transkrypcji (przekręcone słowa, literówki)
2. Poprawiaj błędy stylistyczne (interpunkcja, wielkie litery na początku zdań)
3. NIE zmieniaj sensu wypowiedzi
4. NIE dodawaj własnych treści
5. Zachowaj strukturę i podział na akapity
6. Poprawiaj typowe błędy ASR: "rady" zamiast "raty", "sesja" zamiast "sesję" itp.
7. USUŃ powtarzające się frazy (halucynacje ASR) - jeśli to samo zdanie/fraza powtarza się wielokrotnie, zostaw tylko jedno wystąpienie
8. Jeśli tekst jest bardzo krótki lub składa się głównie z powtórzeń, napisz "[Brak rozpoznawalnej mowy w nagraniu]"

Zwróć TYLKO poprawiony tekst, bez komentarzy.`;
        const response = await this.llmClient.chat.completions.create({
            model: this.llmModel,
            messages: [
                { role: "system", content: correctionPrompt },
                { role: "user", content: deduped.slice(0, 30000) },
            ],
            temperature: 0.1,
        });
        return response.choices[0]?.message?.content || rawTranscript;
    }
    async analyzeTranscript(transcript) {
        if (!this.llmClient)
            throw new Error("LLM client not initialized");
        const systemPrompt = `Jesteś ekspertem analizy sesji rad miejskich/gminnych w Polsce. Twoim zadaniem jest podzielić transkrypcję na wypowiedzi poszczególnych mówców.

## ZASADY IDENTYFIKACJI MÓWCÓW:

1. **Przewodniczący Rady** - prowadzi obrady, udziela głosu, zarządza głosowania, mówi "proszę o głos", "przechodzimy do punktu", "otwieram dyskusję", "zarządzam głosowanie"

2. **Burmistrz/Wójt** - przedstawia projekty uchwał, odpowiada na pytania radnych, referuje sprawy gminy, używa zwrotów "szanowni państwo radni", "w imieniu urzędu"

3. **Skarbnik** - omawia sprawy finansowe, budżet, podatki, używa terminologii finansowej

4. **Sekretarz** - odczytuje protokoły, sprawdza kworum, potwierdza wyniki głosowań

5. **Radni** - zadają pytania, składają wnioski, dyskutują, głosują. Numeruj ich: "Radny 1", "Radny 2" itd. Jeśli radny się przedstawia ("Jan Kowalski") lub jest wymieniony z nazwiska, użyj "Radny Kowalski"

6. **Mieszkańcy/Goście** - wypowiadają się w punkcie "wolne wnioski" lub są zaproszeni, oznacz jako "Mieszkaniec" lub "Gość"

## WSKAZÓWKI ROZPOZNAWANIA ZMIANY MÓWCY:

- Zmiana tematu wypowiedzi
- Zwroty typu "dziękuję", "proszę bardzo", "kto następny"
- Pytania i odpowiedzi (dwa różne mówcy)
- Zmiana stylu/tonu wypowiedzi
- Odniesienia do poprzedniego mówcy ("zgadzam się z przedmówcą")

## FORMAT WYPOWIEDZI:

Każda wypowiedź powinna być osobnym segmentem. PODZIEL tekst na MINIMUM 10-20 segmentów dla dłuższych transkrypcji.

Odpowiedz TYLKO w formacie JSON:
{
  "segments": [
    {
      "timestamp": "00:00:00",
      "speaker": "Przewodniczący",
      "text": "Otwieram XXIII sesję Rady Miejskiej. Stwierdzam kworum.",
      "sentiment": "neutral",
      "emotion": "spokój",
      "emotionEmoji": "🙂",
      "tension": 2,
      "credibility": 95,
      "credibilityEmoji": "✅"
    },
    {
      "timestamp": "00:01:30",
      "speaker": "Radny 1",
      "text": "Mam pytanie dotyczące budżetu...",
      "sentiment": "neutral",
      "emotion": "zainteresowanie",
      "emotionEmoji": "🤔",
      "tension": 3,
      "credibility": 90,
      "credibilityEmoji": "✅"
    }
  ],
  "summary": {
    "averageTension": 3.5,
    "dominantSentiment": "neutral",
    "overallCredibility": 85,
    "overallCredibilityEmoji": "🟢",
    "speakerCount": 8,
    "duration": "1:32:00"
  }
}`;
        const response = await this.llmClient.chat.completions.create({
            model: this.llmModel,
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Przeanalizuj transkrypcję sesji rady i podziel na wypowiedzi mówców:\n\n${transcript.slice(0, 25000)}`,
                },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
            max_tokens: 8000,
        });
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error("Brak odpowiedzi od GPT-4");
        }
        try {
            return JSON.parse(content);
        }
        catch {
            return {
                segments: [
                    {
                        timestamp: "00:00:00",
                        speaker: "Mówca",
                        text: transcript,
                        sentiment: "neutral",
                        emotion: "neutralny",
                        emotionEmoji: "😐",
                        tension: 5,
                        credibility: 50,
                        credibilityEmoji: "🟡",
                    },
                ],
                summary: {
                    averageTension: 5,
                    dominantSentiment: "neutral",
                    overallCredibility: 50,
                    overallCredibilityEmoji: "🟡",
                    speakerCount: 1,
                    duration: "0:00",
                },
            };
        }
    }
    formatTranscriptMarkdown(correctedTranscript, segments, summary, videoTitle, videoUrl) {
        const date = new Date().toLocaleDateString("pl-PL", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
        let md = `# Transkrypcja Sesji Rady\n\n`;
        md += `**Tytuł:** ${videoTitle}\n\n`;
        md += `**Źródło:** [YouTube](${videoUrl})\n\n`;
        md += `**Data transkrypcji:** ${date}\n\n`;
        md += `---\n\n`;
        md += `## Podsumowanie\n\n`;
        md += `| Parametr | Wartość |\n`;
        md += `|----------|--------|\n`;
        md += `| Czas trwania | ${summary.duration} |\n`;
        md += `| Liczba mówców | ${summary.speakerCount} |\n`;
        md += `| Średnie napięcie | ${summary.averageTension?.toFixed(1) || "N/A"}/10 |\n`;
        md += `| Dominujący sentyment | ${summary.dominantSentiment} |\n`;
        md += `| Ogólna wiarygodność | ${summary.overallCredibility}% ${summary.overallCredibilityEmoji} |\n\n`;
        md += `---\n\n`;
        md += `## Pełna transkrypcja\n\n`;
        md += `${correctedTranscript}\n\n`;
        md += `---\n\n`;
        md += `## Analiza wypowiedzi\n\n`;
        for (const seg of segments) {
            md += `### ${seg.speaker}\n\n`;
            md += `> ${seg.text}\n\n`;
            md += `- **Sentyment:** ${seg.sentiment} ${seg.emotionEmoji}\n`;
            md += `- **Emocja:** ${seg.emotion}\n`;
            md += `- **Napięcie:** ${seg.tension}/10\n`;
            md += `- **Wiarygodność:** ${seg.credibility}% ${seg.credibilityEmoji}\n\n`;
        }
        md += `---\n\n`;
        md += `*Dokument wygenerowany automatycznie przez Asystent Radnego*\n`;
        return md;
    }
}
//# sourceMappingURL=youtube-downloader.js.map