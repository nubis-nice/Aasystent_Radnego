import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export async function authMiddleware(request, reply) {
    try {
        // Pobierz token z headera Authorization
        const authHeader = request.headers.authorization;
        request.log.info({ authHeader: authHeader ? "present" : "missing" }, "[AUTH] Authorization header");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            request.log.warn({ message: "Missing or invalid authorization header" }, "[AUTH] Missing or invalid authorization header");
            return reply
                .status(401)
                .send({ error: "Missing or invalid authorization header" });
        }
        const token = authHeader.substring(7); // Usuń "Bearer "
        request.log.info({ tokenLength: token.length, tokenStart: token.substring(0, 20) }, "[AUTH] Token received");
        // Weryfikuj token w Supabase
        request.log.info({ supabaseUrl, hasServiceKey: !!supabaseServiceKey }, "[AUTH] Supabase config");
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user }, error, } = await supabase.auth.getUser(token);
        if (error || !user) {
            request.log.error({ error: error?.message, errorCode: error?.code }, "[AUTH] Token verification failed");
            return reply.status(401).send({ error: "Invalid or expired token" });
        }
        request.log.info({ userId: user.id }, "[AUTH] User authenticated");
        // Dodaj user_id do headers dla kolejnych handlerów
        request.headers["x-user-id"] = user.id;
    }
    catch (error) {
        request.log.error({ error: error.message }, "Auth middleware error:");
        return reply.status(500).send({ error: "Authentication failed" });
    }
}
//# sourceMappingURL=auth.js.map