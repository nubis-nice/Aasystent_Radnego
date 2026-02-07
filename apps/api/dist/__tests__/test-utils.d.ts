/**
 * Test Setup - Mocks for Supabase and external dependencies
 */
export declare const mockSupabaseClient: {
    from: import("vitest").Mock<import("@vitest/spy").Procedure>;
    select: import("vitest").Mock<import("@vitest/spy").Procedure>;
    insert: import("vitest").Mock<import("@vitest/spy").Procedure>;
    update: import("vitest").Mock<import("@vitest/spy").Procedure>;
    delete: import("vitest").Mock<import("@vitest/spy").Procedure>;
    eq: import("vitest").Mock<import("@vitest/spy").Procedure>;
    neq: import("vitest").Mock<import("@vitest/spy").Procedure>;
    in: import("vitest").Mock<import("@vitest/spy").Procedure>;
    is: import("vitest").Mock<import("@vitest/spy").Procedure>;
    order: import("vitest").Mock<import("@vitest/spy").Procedure>;
    limit: import("vitest").Mock<import("@vitest/spy").Procedure>;
    single: import("vitest").Mock<import("@vitest/spy").Procedure>;
    maybeSingle: import("vitest").Mock<import("@vitest/spy").Procedure>;
    auth: {
        getUser: import("vitest").Mock<import("@vitest/spy").Procedure>;
        getSession: import("vitest").Mock<import("@vitest/spy").Procedure>;
    };
    rpc: import("vitest").Mock<import("@vitest/spy").Procedure>;
};
export declare function setupTestEnv(): void;
export declare function resetMocks(): void;
export declare const mockUser: {
    id: string;
    email: string;
    role: string;
};
export declare const mockDocument: {
    id: string;
    user_id: string;
    title: string;
    content: string;
    document_type: string;
    publish_date: string;
    source_url: string;
    created_at: string;
};
export declare const mockAIConfig: {
    provider: string;
    apiKey: string;
    baseUrl: string;
    modelName: string;
    timeoutSeconds: number;
    maxRetries: number;
};
//# sourceMappingURL=test-utils.d.ts.map