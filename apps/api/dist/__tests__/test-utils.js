/**
 * Test Setup - Mocks for Supabase and external dependencies
 */
import { vi } from "vitest";
// Mock Supabase client
export const mockSupabaseClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
        getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "test-user-id", email: "test@example.com" } },
            error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: "test-user-id" } } },
            error: null,
        }),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
};
// Mock environment variables for tests
export function setupTestEnv() {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.SUPABASE_ANON_KEY = "test-anon-key";
    process.env.REDIS_HOST = "localhost";
    process.env.REDIS_PORT = "6379";
    process.env.API_PORT = "3001";
}
// Reset all mocks
export function resetMocks() {
    vi.clearAllMocks();
}
// Mock user for authenticated requests
export const mockUser = {
    id: "test-user-123",
    email: "radny@test.pl",
    role: "authenticated",
};
// Mock document data
export const mockDocument = {
    id: "doc-123",
    user_id: "test-user-123",
    title: "Uchwała nr 1/2026",
    content: "Treść uchwały...",
    document_type: "resolution",
    publish_date: "2026-01-25",
    source_url: "https://example.com/doc.pdf",
    created_at: new Date().toISOString(),
};
// Mock AI config
export const mockAIConfig = {
    provider: "openai",
    apiKey: "test-api-key",
    baseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4",
    timeoutSeconds: 60,
    maxRetries: 3,
};
//# sourceMappingURL=test-utils.js.map