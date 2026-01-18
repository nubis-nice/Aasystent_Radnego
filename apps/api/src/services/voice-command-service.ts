import { VoiceIntentDetector } from "./voice-intent-detector.js";

export type VoiceIntent =
  | "navigation"
  | "search"
  | "chat"
  | "control"
  | "unknown";

export type VoiceAction =
  | { type: "navigate"; path: string }
  | { type: "search"; query: string; tool?: string }
  | { type: "chat"; message: string }
  | { type: "control"; command: string };

export interface VoiceCommandResult {
  intent: VoiceIntent;
  confidence: number;
  action: VoiceAction;
  entities?: Record<string, unknown>;
  userFriendlyMessage: string;
}

export class VoiceCommandService {
  private userId: string;
  private intentDetector: VoiceIntentDetector;

  constructor(userId: string) {
    this.userId = userId;
    this.intentDetector = new VoiceIntentDetector(userId);
  }

  async processCommand(transcription: string): Promise<VoiceCommandResult> {
    console.log(
      `[VoiceCommand] Processing: "${transcription.substring(0, 100)}..."`
    );

    const detectedIntent = await this.intentDetector.detectIntent(
      transcription
    );

    console.log(
      `[VoiceCommand] Intent: ${detectedIntent.intent} (confidence: ${detectedIntent.confidence})`
    );

    const action = this.buildAction(detectedIntent, transcription);
    const userFriendlyMessage = this.buildUserFriendlyMessage(
      detectedIntent,
      action
    );

    const result: VoiceCommandResult = {
      intent: detectedIntent.intent,
      confidence: detectedIntent.confidence,
      action,
      entities: detectedIntent.entities,
      userFriendlyMessage,
    };

    console.log(`[VoiceCommand] Result:`, result);

    return result;
  }

  private buildAction(
    detectedIntent: {
      intent: VoiceIntent;
      confidence: number;
      entities: Record<string, unknown>;
    },
    transcription: string
  ): VoiceAction {
    switch (detectedIntent.intent) {
      case "navigation": {
        const path =
          (detectedIntent.entities.path as string) ||
          this.intentDetector.mapIntentToPath(detectedIntent) ||
          "/dashboard";

        return {
          type: "navigate",
          path,
        };
      }

      case "search": {
        const query =
          (detectedIntent.entities.query as string) || transcription;
        const tool = detectedIntent.entities.tool as string | undefined;

        return {
          type: "search",
          query,
          tool,
        };
      }

      case "chat": {
        const message =
          (detectedIntent.entities.message as string) || transcription;

        return {
          type: "chat",
          message,
        };
      }

      case "control": {
        const command = (detectedIntent.entities.command as string) || "stop";

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

  private buildUserFriendlyMessage(
    detectedIntent: {
      intent: VoiceIntent;
      confidence: number;
      entities: Record<string, unknown>;
    },
    action: VoiceAction
  ): string {
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

  private getPageName(path: string): string {
    const pathNames: Record<string, string> = {
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

  private getControlMessage(command: string): string {
    const messages: Record<string, string> = {
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
