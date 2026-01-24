/**
 * Edge TTS Service - darmowy TTS od Microsoft z obsługą polskiego
 * Używa Microsoft Edge's online TTS service bez klucza API
 * Pakiet: @andresaya/edge-tts
 */
import { Buffer } from "node:buffer";
import { EdgeTTS } from "@andresaya/edge-tts";
// Polskie głosy Edge TTS
export const POLISH_VOICES = {
    "pl-PL-ZofiaNeural": {
        name: "Zofia",
        gender: "female",
        description: "Naturalny kobiecy głos polski",
    },
    "pl-PL-MarekNeural": {
        name: "Marek",
        gender: "male",
        description: "Naturalny męski głos polski",
    },
};
// Wszystkie dostępne głosy Edge TTS
export const EDGE_TTS_VOICES = {
    // Polski
    ...POLISH_VOICES,
    // Angielski (popularne)
    "en-US-AriaNeural": {
        name: "Aria",
        gender: "female",
        description: "US English female",
    },
    "en-US-GuyNeural": {
        name: "Guy",
        gender: "male",
        description: "US English male",
    },
    "en-GB-SoniaNeural": {
        name: "Sonia",
        gender: "female",
        description: "British English female",
    },
};
export class EdgeTTSService {
    defaultVoice = "pl-PL-ZofiaNeural";
    tts;
    constructor() {
        this.tts = new EdgeTTS();
    }
    /**
     * Generuj audio z tekstu
     */
    async synthesize(text, options = {}) {
        const voice = options.voice || this.defaultVoice;
        // Użyj streaming API i zbierz wszystkie chunki
        const chunks = [];
        const stream = this.tts.synthesizeStream(text, voice, {
            rate: options.rate,
            volume: options.volume,
            pitch: options.pitch,
        });
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        // Połącz wszystkie chunki w jeden Buffer
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const audioBuffer = Buffer.alloc(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            audioBuffer.set(chunk, offset);
            offset += chunk.length;
        }
        return audioBuffer;
    }
    /**
     * Pobierz listę dostępnych głosów
     */
    async getAvailableVoices() {
        try {
            const voices = await this.tts.getVoices();
            return voices.map((v) => ({
                id: v.ShortName,
                name: v.FriendlyName,
                gender: v.Gender,
                locale: v.Locale,
            }));
        }
        catch {
            // Fallback do statycznej listy
            return Object.entries(EDGE_TTS_VOICES).map(([id, info]) => ({
                id,
                name: info.name,
                gender: info.gender,
                locale: id.split("-").slice(0, 2).join("-"),
            }));
        }
    }
    /**
     * Pobierz polskie głosy
     */
    getPolishVoices() {
        return Object.entries(POLISH_VOICES).map(([id, info]) => ({
            id,
            ...info,
        }));
    }
}
// Singleton instance
export const edgeTTSService = new EdgeTTSService();
//# sourceMappingURL=edge-tts-service.js.map