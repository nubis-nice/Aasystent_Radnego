import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Jawne wykluczenie auth callback - NIE przetwarzaj tego przez middleware!
  if (path.startsWith("/auth/callback") || path.startsWith("/api/auth")) {
    console.log("[MIDDLEWARE] Skipping auth path:", path);
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Używamy getUser() zamiast getSession() bo getUser() waliduje token z serwerem
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log(
    "[MIDDLEWARE]",
    path,
    "- User:",
    user?.id || "none",
    "Error:",
    userError?.message || "none"
  );

  // Chronione routes
  const protectedPaths = [
    "/dashboard",
    "/documents",
    "/chat",
    "/settings",
    "/admin",
  ];
  const adminPaths = ["/admin"];
  const authPaths = ["/login", "/change-password", "/reset-password", "/auth"];

  // path już zadeklarowany na początku funkcji

  // Jeśli nie zalogowany i próbuje dostać się do chronionych routes
  if (!user && protectedPaths.some((p) => path.startsWith(p))) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(redirectUrl);
  }

  // NIE przekierowujemy automatycznie z /login do /dashboard
  // Callback OAuth sam przekieruje po udanym logowaniu

  // Sprawdź czy wymaga zmiany hasła
  if (user && !authPaths.some((p) => path.startsWith(p))) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("force_password_change")
      .eq("id", user.id)
      .single();

    if (profile?.force_password_change && path !== "/change-password") {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }
  }

  // Sprawdź czy admin próbuje dostać się do panelu admina
  if (user && adminPaths.some((p) => path.startsWith(p))) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Wykluczamy: static files, api/auth, /auth/callback
    "/((?!_next/static|_next/image|favicon.ico|api/auth|auth/callback|api/).*)",
  ],
};
