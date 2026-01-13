import { z } from "zod";
export declare const MessageRoleSchema: z.ZodEnum<["user", "assistant", "system"]>;
export type MessageRole = z.infer<typeof MessageRoleSchema>;
export declare const CitationSchema: z.ZodObject<{
    documentId: z.ZodOptional<z.ZodString>;
    documentTitle: z.ZodString;
    page: z.ZodOptional<z.ZodNumber>;
    chunkIndex: z.ZodOptional<z.ZodNumber>;
    text: z.ZodString;
    relevanceScore: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    documentTitle: string;
    text: string;
    page?: number | undefined;
    documentId?: string | undefined;
    chunkIndex?: number | undefined;
    relevanceScore?: number | undefined;
}, {
    documentTitle: string;
    text: string;
    page?: number | undefined;
    documentId?: string | undefined;
    chunkIndex?: number | undefined;
    relevanceScore?: number | undefined;
}>;
export type Citation = z.infer<typeof CitationSchema>;
export declare const MessageSchema: z.ZodObject<{
    id: z.ZodString;
    conversationId: z.ZodString;
    role: z.ZodEnum<["user", "assistant", "system"]>;
    content: z.ZodString;
    citations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        documentId: z.ZodOptional<z.ZodString>;
        documentTitle: z.ZodString;
        page: z.ZodOptional<z.ZodNumber>;
        chunkIndex: z.ZodOptional<z.ZodNumber>;
        text: z.ZodString;
        relevanceScore: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        documentTitle: string;
        text: string;
        page?: number | undefined;
        documentId?: string | undefined;
        chunkIndex?: number | undefined;
        relevanceScore?: number | undefined;
    }, {
        documentTitle: string;
        text: string;
        page?: number | undefined;
        documentId?: string | undefined;
        chunkIndex?: number | undefined;
        relevanceScore?: number | undefined;
    }>, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    content: string;
    conversationId: string;
    role: "user" | "assistant" | "system";
    citations: {
        documentTitle: string;
        text: string;
        page?: number | undefined;
        documentId?: string | undefined;
        chunkIndex?: number | undefined;
        relevanceScore?: number | undefined;
    }[];
    createdAt: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    id: string;
    content: string;
    conversationId: string;
    role: "user" | "assistant" | "system";
    createdAt: string;
    metadata?: Record<string, unknown> | undefined;
    citations?: {
        documentTitle: string;
        text: string;
        page?: number | undefined;
        documentId?: string | undefined;
        chunkIndex?: number | undefined;
        relevanceScore?: number | undefined;
    }[] | undefined;
}>;
export type Message = z.infer<typeof MessageSchema>;
export declare const ConversationSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    title: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string | null;
    createdAt: string;
    userId: string;
    updatedAt: string;
}, {
    id: string;
    title: string | null;
    createdAt: string;
    userId: string;
    updatedAt: string;
}>;
export type Conversation = z.infer<typeof ConversationSchema>;
export declare const ConversationWithMessagesSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    title: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        conversationId: z.ZodString;
        role: z.ZodEnum<["user", "assistant", "system"]>;
        content: z.ZodString;
        citations: z.ZodDefault<z.ZodArray<z.ZodObject<{
            documentId: z.ZodOptional<z.ZodString>;
            documentTitle: z.ZodString;
            page: z.ZodOptional<z.ZodNumber>;
            chunkIndex: z.ZodOptional<z.ZodNumber>;
            text: z.ZodString;
            relevanceScore: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }, {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }>, "many">>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        content: string;
        conversationId: string;
        role: "user" | "assistant" | "system";
        citations: {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }[];
        createdAt: string;
        metadata?: Record<string, unknown> | undefined;
    }, {
        id: string;
        content: string;
        conversationId: string;
        role: "user" | "assistant" | "system";
        createdAt: string;
        metadata?: Record<string, unknown> | undefined;
        citations?: {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string | null;
    createdAt: string;
    userId: string;
    updatedAt: string;
    messages: {
        id: string;
        content: string;
        conversationId: string;
        role: "user" | "assistant" | "system";
        citations: {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }[];
        createdAt: string;
        metadata?: Record<string, unknown> | undefined;
    }[];
}, {
    id: string;
    title: string | null;
    createdAt: string;
    userId: string;
    updatedAt: string;
    messages: {
        id: string;
        content: string;
        conversationId: string;
        role: "user" | "assistant" | "system";
        createdAt: string;
        metadata?: Record<string, unknown> | undefined;
        citations?: {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }[] | undefined;
    }[];
}>;
export type ConversationWithMessages = z.infer<typeof ConversationWithMessagesSchema>;
export declare const ChatRequestSchema: z.ZodObject<{
    message: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    includeDocuments: z.ZodDefault<z.ZodBoolean>;
    includeMunicipalData: z.ZodDefault<z.ZodBoolean>;
    temperature: z.ZodDefault<z.ZodNumber>;
    systemPrompt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    includeDocuments: boolean;
    includeMunicipalData: boolean;
    temperature: number;
    conversationId?: string | undefined;
    systemPrompt?: string | undefined;
}, {
    message: string;
    conversationId?: string | undefined;
    includeDocuments?: boolean | undefined;
    includeMunicipalData?: boolean | undefined;
    temperature?: number | undefined;
    systemPrompt?: string | undefined;
}>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export declare const ChatResponseSchema: z.ZodObject<{
    conversationId: z.ZodString;
    message: z.ZodObject<{
        id: z.ZodString;
        conversationId: z.ZodString;
        role: z.ZodEnum<["user", "assistant", "system"]>;
        content: z.ZodString;
        citations: z.ZodDefault<z.ZodArray<z.ZodObject<{
            documentId: z.ZodOptional<z.ZodString>;
            documentTitle: z.ZodString;
            page: z.ZodOptional<z.ZodNumber>;
            chunkIndex: z.ZodOptional<z.ZodNumber>;
            text: z.ZodString;
            relevanceScore: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }, {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }>, "many">>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        content: string;
        conversationId: string;
        role: "user" | "assistant" | "system";
        citations: {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }[];
        createdAt: string;
        metadata?: Record<string, unknown> | undefined;
    }, {
        id: string;
        content: string;
        conversationId: string;
        role: "user" | "assistant" | "system";
        createdAt: string;
        metadata?: Record<string, unknown> | undefined;
        citations?: {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }[] | undefined;
    }>;
    relatedDocuments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        relevanceScore: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        relevanceScore: number;
    }, {
        id: string;
        title: string;
        relevanceScore: number;
    }>, "many">>;
    suggestedActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        label: z.ZodString;
        data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        label: string;
        data?: Record<string, unknown> | undefined;
    }, {
        type: string;
        label: string;
        data?: Record<string, unknown> | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    message: {
        id: string;
        content: string;
        conversationId: string;
        role: "user" | "assistant" | "system";
        citations: {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }[];
        createdAt: string;
        metadata?: Record<string, unknown> | undefined;
    };
    conversationId: string;
    relatedDocuments?: {
        id: string;
        title: string;
        relevanceScore: number;
    }[] | undefined;
    suggestedActions?: {
        type: string;
        label: string;
        data?: Record<string, unknown> | undefined;
    }[] | undefined;
}, {
    message: {
        id: string;
        content: string;
        conversationId: string;
        role: "user" | "assistant" | "system";
        createdAt: string;
        metadata?: Record<string, unknown> | undefined;
        citations?: {
            documentTitle: string;
            text: string;
            page?: number | undefined;
            documentId?: string | undefined;
            chunkIndex?: number | undefined;
            relevanceScore?: number | undefined;
        }[] | undefined;
    };
    conversationId: string;
    relatedDocuments?: {
        id: string;
        title: string;
        relevanceScore: number;
    }[] | undefined;
    suggestedActions?: {
        type: string;
        label: string;
        data?: Record<string, unknown> | undefined;
    }[] | undefined;
}>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export declare const MunicipalDataTypeSchema: z.ZodEnum<["meeting", "resolution", "announcement", "news"]>;
export type MunicipalDataType = z.infer<typeof MunicipalDataTypeSchema>;
export declare const MunicipalDataSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    dataType: z.ZodEnum<["meeting", "resolution", "announcement", "news"]>;
    title: z.ZodString;
    content: z.ZodNullable<z.ZodString>;
    sourceUrl: z.ZodNullable<z.ZodString>;
    meetingDate: z.ZodNullable<z.ZodString>;
    scrapedAt: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    content: string | null;
    userId: string;
    dataType: "resolution" | "announcement" | "meeting" | "news";
    sourceUrl: string | null;
    meetingDate: string | null;
    scrapedAt: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    id: string;
    title: string;
    content: string | null;
    userId: string;
    dataType: "resolution" | "announcement" | "meeting" | "news";
    sourceUrl: string | null;
    meetingDate: string | null;
    scrapedAt: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export type MunicipalData = z.infer<typeof MunicipalDataSchema>;
export declare const MunicipalityTypeSchema: z.ZodEnum<["gmina", "miasto", "powiat"]>;
export type MunicipalityType = z.infer<typeof MunicipalityTypeSchema>;
export declare const ScrapingFrequencySchema: z.ZodEnum<["daily", "weekly"]>;
export type ScrapingFrequency = z.infer<typeof ScrapingFrequencySchema>;
export declare const MunicipalSettingsSchema: z.ZodObject<{
    municipalityName: z.ZodString;
    municipalityType: z.ZodEnum<["gmina", "miasto", "powiat"]>;
    bipUrl: z.ZodString;
    councilPageUrl: z.ZodOptional<z.ZodString>;
    scrapingEnabled: z.ZodDefault<z.ZodBoolean>;
    scrapingFrequency: z.ZodDefault<z.ZodEnum<["daily", "weekly"]>>;
}, "strip", z.ZodTypeAny, {
    municipalityName: string;
    municipalityType: "gmina" | "miasto" | "powiat";
    bipUrl: string;
    scrapingEnabled: boolean;
    scrapingFrequency: "daily" | "weekly";
    councilPageUrl?: string | undefined;
}, {
    municipalityName: string;
    municipalityType: "gmina" | "miasto" | "powiat";
    bipUrl: string;
    councilPageUrl?: string | undefined;
    scrapingEnabled?: boolean | undefined;
    scrapingFrequency?: "daily" | "weekly" | undefined;
}>;
export type MunicipalSettings = z.infer<typeof MunicipalSettingsSchema>;
export declare const CalendarEventSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    googleEventId: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    startTime: z.ZodString;
    endTime: z.ZodString;
    location: z.ZodNullable<z.ZodString>;
    attendees: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    syncedAt: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    description: string | null;
    createdAt: string;
    userId: string;
    googleEventId: string | null;
    startTime: string;
    endTime: string;
    location: string | null;
    attendees: string[];
    syncedAt: string;
}, {
    id: string;
    title: string;
    description: string | null;
    createdAt: string;
    userId: string;
    googleEventId: string | null;
    startTime: string;
    endTime: string;
    location: string | null;
    syncedAt: string;
    attendees?: string[] | undefined;
}>;
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export declare const CreateCalendarEventSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    startTime: z.ZodString;
    endTime: z.ZodString;
    location: z.ZodOptional<z.ZodString>;
    attendees: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    startTime: string;
    endTime: string;
    description?: string | undefined;
    location?: string | undefined;
    attendees?: string[] | undefined;
}, {
    title: string;
    startTime: string;
    endTime: string;
    description?: string | undefined;
    location?: string | undefined;
    attendees?: string[] | undefined;
}>;
export type CreateCalendarEvent = z.infer<typeof CreateCalendarEventSchema>;
export interface SystemPromptContext {
    municipalityName?: string;
    municipalityType?: MunicipalityType;
    userName?: string;
    userPosition?: string;
    voivodeship?: string;
    bipUrl?: string;
    councilName?: string;
    recentDocuments?: Array<{
        title: string;
        type: string;
        date: string;
    }>;
    upcomingMeetings?: Array<{
        title: string;
        date: string;
    }>;
}
export declare function buildSystemPrompt(context: SystemPromptContext): string;
export interface RAGContext {
    documents: Array<{
        id: string;
        title: string;
        content: string;
        relevanceScore: number;
        metadata?: Record<string, unknown>;
    }>;
    municipalData: Array<{
        id: string;
        title: string;
        content: string;
        dataType: MunicipalDataType;
        relevanceScore: number;
    }>;
}
export interface ChatContext {
    systemPrompt: string;
    conversationHistory: Array<{
        role: MessageRole;
        content: string;
    }>;
    ragContext?: RAGContext;
}
//# sourceMappingURL=chat.d.ts.map