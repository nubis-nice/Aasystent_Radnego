"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  useVoiceConversation,
  VoiceConversationState,
  ConversationMessage,
} from "@/hooks/useVoiceConversation";
import { supabase } from "@/lib/supabase/client";

/**
 * Globalny kontekst głosowy - dostępny na wszystkich stronach
 * Umożliwia rozmowę z asystentem z dowolnego miejsca w aplikacji
 */

interface PendingVoiceMessage {
  transcription: string;
  timestamp: Date;
}

// Tryby pracy Stefana
export type VoiceMode = "off" | "standby" | "active" | "processing";

// Oczekująca akcja (czeka na "wykonaj")
export interface PendingAction {
  id: string;
  type: string;
  description: string;
  expiresAt: Date;
}

interface VoiceContextType {
  // Stan głosowy
  state: VoiceConversationState;
  isRecording: boolean;
  recordingDuration: number;

  // Tryb pracy Stefana
  voiceMode: VoiceMode;
  setVoiceMode: (mode: VoiceMode) => void;
  enterStandbyMode: () => Promise<void>;
  exitStandbyMode: () => void;

  // Kontrola mikrofonu
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  cancelListening: () => void;
  stopSpeaking: () => void;

  // Wiadomości
  speakResponse: (text: string) => Promise<void>;
  clearMessages: () => void;

  // Konfiguracja
  setAssistantName: (name: string) => void;

  // Globalny stan
  isVoiceActive: boolean;
  pendingMessage: PendingVoiceMessage | null;
  clearPendingMessage: () => void;

  // Oczekująca akcja (czeka na "wykonaj")
  pendingAction: PendingAction | null;
  setPendingAction: (action: PendingAction | null) => void;

  // Akcje głosowe
  executeVoiceAction: (command: string) => Promise<VoiceActionResult | null>;

  // Nawigacja do chatu
  navigateToChat: () => void;

  // Załączniki dokumentów
  attachedDocuments: AttachedDocument[];
  attachDocument: (doc: AttachedDocument) => void;
  removeDocument: (docId: string) => void;
  clearDocuments: () => void;
}

// Wynik akcji głosowej
export interface VoiceActionResult {
  success: boolean;
  actionType: string;
  message: string;
  data?: unknown;
  navigationTarget?: string;
  uiAction?: {
    type: "open_modal" | "show_toast" | "navigate" | "refresh";
    target?: string;
    data?: unknown;
  };
}

export interface AttachedDocument {
  id: string;
  title: string;
  content: string;
  source?: string;
  contentType?: string;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

interface VoiceProviderProps {
  children: ReactNode;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function VoiceProvider({ children }: VoiceProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("off");
  const [pendingMessage, setPendingMessage] =
    useState<PendingVoiceMessage | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );
  const [attachedDocuments, setAttachedDocuments] = useState<
    AttachedDocument[]
  >([]);
  const [assistantName, setAssistantNameState] = useState("Stefan");

  // Pobierz imię asystenta z konfiguracji
  useEffect(() => {
    async function loadAssistantName() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("ai_configurations")
            .select("assistant_name")
            .eq("user_id", user.id)
            .single();
          if (data?.assistant_name) {
            setAssistantNameState(data.assistant_name);
          }
        }
      } catch (error) {
        console.error("[VoiceContext] Error loading assistant name:", error);
      }
    }
    loadAssistantName();
  }, []);

  // Hook głosowy z callbackiem do obsługi wiadomości
  const voiceConversation = useVoiceConversation({
    assistantName,
    autoTTS: true,
    useVAD: true,
    vadSilenceDuration: 1500,
    onMessage: useCallback(
      (message: ConversationMessage) => {
        // Jeśli nie jesteśmy na /chat, ustaw pending message
        if (pathname !== "/chat" && message.role === "user") {
          setPendingMessage({
            transcription: message.content,
            timestamp: message.timestamp,
          });
        }
      },
      [pathname]
    ),
  });

  // Wrapper startListening - aktywuje tryb głosowy
  const startListening = useCallback(async () => {
    setIsVoiceActive(true);
    await voiceConversation.startListening();
  }, [voiceConversation]);

  // Wrapper stopListening
  const stopListening = useCallback(async () => {
    await voiceConversation.stopListening();
    // Nie wyłączaj isVoiceActive - ciągły dialog
  }, [voiceConversation]);

  // Nawigacja do chatu
  const navigateToChat = useCallback(() => {
    if (pathname !== "/chat") {
      router.push("/chat");
    }
  }, [pathname, router]);

  // Czyszczenie pending message
  const clearPendingMessage = useCallback(() => {
    setPendingMessage(null);
  }, []);

  // Zarządzanie załącznikami
  const attachDocument = useCallback((doc: AttachedDocument) => {
    setAttachedDocuments((prev) => {
      // Nie dodawaj duplikatów
      if (prev.some((d) => d.id === doc.id)) {
        return prev;
      }
      return [...prev, doc];
    });
  }, []);

  const removeDocument = useCallback((docId: string) => {
    setAttachedDocuments((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  const clearDocuments = useCallback(() => {
    setAttachedDocuments([]);
  }, []);

  // Ustaw imię asystenta
  const setAssistantName = useCallback(
    (name: string) => {
      setAssistantNameState(name);
      voiceConversation.setAssistantName(name);
    },
    [voiceConversation]
  );

  // Wykonaj akcję głosową przez API
  const executeVoiceAction = useCallback(
    async (command: string): Promise<VoiceActionResult | null> => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return null;

        const response = await fetch(`${API_URL}/api/voice/action`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            command,
            pendingActionId: pendingAction?.id,
          }),
        });

        if (!response.ok) return null;

        const result: VoiceActionResult = await response.json();

        // Obsłuż akcje UI
        if (result.uiAction) {
          switch (result.uiAction.type) {
            case "navigate":
              if (result.uiAction.target) {
                router.push(result.uiAction.target);
              }
              break;
            case "refresh":
              router.refresh();
              break;
          }
        }

        // Czyść pending action jeśli wykonana
        if (result.success && pendingAction) {
          setPendingAction(null);
        }

        return result;
      } catch (error) {
        console.error("[VoiceContext] Voice action error:", error);
        return null;
      }
    },
    [pendingAction, router]
  );

  // Wejdź w tryb czuwania (standby) - ciągłe nasłuchiwanie na wake word
  const enterStandbyMode = useCallback(async () => {
    setVoiceMode("standby");
    setIsVoiceActive(true);
    // W trybie standby Stefan ciągle nasłuchuje ale nie przetwarza
    // aż usłyszy "Hej Stefan"
    await voiceConversation.startListening();
  }, [voiceConversation]);

  // Wyjdź z trybu czuwania
  const exitStandbyMode = useCallback(() => {
    setVoiceMode("off");
    setIsVoiceActive(false);
    voiceConversation.stopSpeaking();
  }, [voiceConversation]);

  const value: VoiceContextType = {
    state: voiceConversation.state,
    isRecording: voiceConversation.isRecording,
    recordingDuration: voiceConversation.recordingDuration,

    voiceMode,
    setVoiceMode,
    enterStandbyMode,
    exitStandbyMode,

    startListening,
    stopListening,
    cancelListening: voiceConversation.cancelListening,
    stopSpeaking: voiceConversation.stopSpeaking,

    speakResponse: voiceConversation.speakResponse,
    clearMessages: voiceConversation.clearMessages,

    setAssistantName,

    isVoiceActive,
    pendingMessage,
    clearPendingMessage,

    pendingAction,
    setPendingAction,
    executeVoiceAction,

    navigateToChat,

    attachedDocuments,
    attachDocument,
    removeDocument,
    clearDocuments,
  };

  return (
    <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
  );
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error("useVoice must be used within a VoiceProvider");
  }
  return context;
}
