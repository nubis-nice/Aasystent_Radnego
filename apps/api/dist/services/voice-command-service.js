import { VoiceIntentDetector } from "./voice-intent-detector.js";
export class VoiceCommandService {
    userId;
    intentDetector;
    constructor(userId) {
        this.userId = userId;
        this.intentDetector = new VoiceIntentDetector(userId);
    }
    async processCommand(transcription) {
        console.log(`[VoiceCommand] Processing: "${transcription.substring(0, 100)}..."`);
        const detectedIntent = await this.intentDetector.detectIntent(transcription);
        console.log(`[VoiceCommand] Intent: ${detectedIntent.intent} (confidence: ${detectedIntent.confidence})`);
        const action = this.buildAction(detectedIntent, transcription);
        const userFriendlyMessage = this.buildUserFriendlyMessage(detectedIntent, action);
        const result = {
            intent: detectedIntent.intent,
            confidence: detectedIntent.confidence,
            action,
            entities: detectedIntent.entities,
            userFriendlyMessage,
        };
        console.log(`[VoiceCommand] Result:`, result);
        return result;
    }
    buildAction(detectedIntent, transcription) {
        switch (detectedIntent.intent) {
            case "navigation": {
                const path = detectedIntent.entities.path ||
                    this.intentDetector.mapIntentToPath(detectedIntent) ||
                    "/dashboard";
                return {
                    type: "navigate",
                    path,
                };
            }
            case "search": {
                const query = detectedIntent.entities.query || transcription;
                const tool = detectedIntent.entities.tool;
                return {
                    type: "search",
                    query,
                    tool,
                };
            }
            case "chat": {
                const message = detectedIntent.entities.message || transcription;
                return {
                    type: "chat",
                    message,
                };
            }
            case "control": {
                const command = detectedIntent.entities.command || "stop";
                return {
                    type: "control",
                    command,
                };
            }
            default: {
                return {
                    type: "chat",
                    message: transcription,
                };
            }
        }
    }
    buildUserFriendlyMessage(detectedIntent, action) {
        switch (action.type) {
            case "navigate":
                return `Przechodzę do: ${this.getPageName(action.path)}`;
            case "search":
                return `Wyszukuję: ${action.query}`;
            case "chat":
                return `Przetwarzam pytanie: ${action.message.substring(0, 50)}...`;
            case "control":
                return this.getControlMessage(action.command);
            default:
                return "Rozpoznano komendę";
        }
    }
    getPageName(path) {
        const pathNames = {
            "/dashboard": "Panel główny",
            "/documents": "Dokumenty",
            "/chat": "Czat",
            "/settings": "Ustawienia",
            "/analysis": "Analizy",
            "/research": "Badania",
            "/settings/data-sources": "Źródła danych",
            "/settings/profile": "Profil",
            "/settings/api": "Konfiguracja API",
            "/calendar": "Kalendarz",
        };
        return pathNames[path] || path;
    }
    getControlMessage(command) {
        const messages = {
            stop: "Zatrzymuję",
            pause: "Wstrzymuję",
            volume_up: "Zwiększam głośność",
            volume_down: "Zmniejszam głośność",
            repeat: "Powtarzam",
            cancel: "Anuluję",
        };
        return messages[command] || "Wykonuję komendę";
    }
}
//# sourceMappingURL=voice-command-service.js.map