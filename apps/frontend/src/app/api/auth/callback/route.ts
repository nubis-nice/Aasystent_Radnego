import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  console.log("\n\n========== AUTH CALLBACK STARTED ==========");

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const error_description = requestUrl.searchParams.get("error_description");

  console.log("[AUTH CALLBACK] URL:", requestUrl.toString());
  console.log("[AUTH CALLBACK] Received request:", {
    code: code ? `present (${code.substring(0, 10)}...)` : "missing",
    error,
    error_description,
  });

  // Sprawdź cookies
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  console.log(
    "[AUTH CALLBACK] Available cookies:",
    allCookies.map((c) => c.name)
  );

  if (error) {
    console.error("[AUTH CALLBACK] OAuth error:", error, error_description);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error_description || error)}`,
        request.url
      )
    );
  }

  if (code) {
    // Zbieramy cookies do ustawienia w response
    const cookiesToSet: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookies) {
            cookies.forEach(({ name, value, options }) => {
              cookiesToSet.push({ name, value, options: options || {} });
            });
          },
        },
      }
    );

    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("[AUTH CALLBACK] Exchange code error:", exchangeError);
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(exchangeError.message)}`,
          request.url
        )
      );
    }

    if (data.session) {
      console.log(
        "[AUTH CALLBACK] Session created for user:",
        data.session.user.id
      );
      console.log("[AUTH CALLBACK] Cookies to set:", cookiesToSet.length);

      const next = requestUrl.searchParams.get("next") || "/dashboard";
      const response = NextResponse.redirect(new URL(next, request.url));

      // KLUCZOWE: Ustawiamy cookies w RESPONSE!
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, {
          ...options,
          // Zapewniamy że cookies są dostępne w przeglądarce
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
      });

      console.log("[AUTH CALLBACK] Redirecting to:", next);
      return response;
    }
  }

  console.log("[AUTH CALLBACK] No code provided");
  return NextResponse.redirect(
    new URL("/login?error=No code provided", request.url)
  );
}
