export async function authRoutes(fastify) {
    // Verify JWT token from frontend
    fastify.post("/auth/verify", async (request, reply) => {
        const { token } = request.body;
        if (!token) {
            return reply.status(400).send({ error: "Token required" });
        }
        try {
            // TODO: Verify Supabase JWT
            // const user = await verifySupabaseToken(token);
            return {
                valid: true,
                user: {
                    id: "placeholder-user-id",
                    email: "user@example.com",
                    role: "user",
                },
            };
        }
        catch {
            return reply.status(401).send({ valid: false, error: "Invalid token" });
        }
    });
    // Get user profile
    fastify.get("/auth/profile", async (request, reply) => {
        const token = request.headers.authorization?.replace("Bearer ", "");
        if (!token) {
            return reply.status(401).send({ error: "Authorization required" });
        }
        try {
            // TODO: Verify token and get profile from Supabase
            return {
                profile: {
                    id: "placeholder-user-id",
                    email: "user@example.com",
                    full_name: "Jan Kowalski",
                    role: "radny",
                    created_at: new Date().toISOString(),
                },
            };
        }
        catch {
            return reply.status(401).send({ error: "Invalid token" });
        }
    });
    // Update user profile
    fastify.put("/auth/profile", async (request, reply) => {
        const token = request.headers.authorization?.replace("Bearer ", "");
        const { full_name, avatar_url } = request.body;
        if (!token) {
            return reply.status(401).send({ error: "Authorization required" });
        }
        try {
            // TODO: Verify token and update profile in Supabase
            return {
                success: true,
                profile: {
                    id: "placeholder-user-id",
                    email: "user@example.com",
                    full_name: full_name || "Jan Kowalski",
                    avatar_url,
                    role: "radny",
                    updated_at: new Date().toISOString(),
                },
            };
        }
        catch {
            return reply.status(401).send({ error: "Invalid token" });
        }
    });
}
// TODO: Implement Supabase JWT verification
async function verifySupabaseToken(token) {
    // This will be implemented after Supabase setup
    // 1. Decode JWT without verification to get user ID
    // 2. Fetch user from Supabase
    // 3. Return user object or throw error
    throw new Error("Not implemented yet");
}
//# sourceMappingURL=auth.js.map