/**
 * Edge TTS Service - darmowy TTS od Microsoft z obsługą polskiego
 * Używa Microsoft Edge's online TTS service bez klucza API
 * Pakiet: @andresaya/edge-tts
 */
import { Buffer } from "node:buffer";
export declare const POLISH_VOICES: {
    "pl-PL-ZofiaNeural": {
        name: string;
        gender: string;
        description: string;
    };
    "pl-PL-MarekNeural": {
        name: string;
        gender: string;
        description: string;
    };
};
export declare const EDGE_TTS_VOICES: {
    "en-US-AriaNeural": {
        name: string;
        gender: string;
        description: string;
    };
    "en-US-GuyNeural": {
        name: string;
        gender: string;
        description: string;
    };
    "en-GB-SoniaNeural": {
        name: string;
        gender: string;
        description: string;
    };
    "pl-PL-ZofiaNeural": {
        name: string;
        gender: string;
        description: string;
    };
    "pl-PL-MarekNeural": {
        name: string;
        gender: string;
        description: string;
    };
};
export interface EdgeTTSOptions {
    voice?: string;
    rate?: string | number;
    volume?: string | number;
    pitch?: string | number;
}
export declare class EdgeTTSService {
    private defaultVoice;
    private tts;
    constructor();
    /**
     * Generuj audio z tekstu
     */
    synthesize(text: string, options?: EdgeTTSOptions): Promise<Buffer>;
    /**
     * Pobierz listę dostępnych głosów
     */
    getAvailableVoices(): Promise<Array<{
        id: string;
        name: string;
        gender: string;
        locale: string;
    }>>;
    /**
     * Pobierz polskie głosy
     */
    getPolishVoices(): Array<{
        id: string;
        name: string;
        gender: string;
        description: string;
    }>;
}
export declare const edgeTTSService: EdgeTTSService;
//# sourceMappingURL=edge-tts-service.d.ts.map