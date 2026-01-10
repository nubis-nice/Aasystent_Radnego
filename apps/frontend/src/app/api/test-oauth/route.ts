import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "info";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        error: "Supabase configuration missing",
        details: {
          urlPresent: !!supabaseUrl,
          keyPresent: !!supabaseAnonKey,
        },
      },
      { status: 500 }
    );
  }

  if (action === "generate-url") {
    // Generate OAuth URL (server-side simulation)
    const redirectTo = `${
      request.headers.get("origin") || "http://localhost:3000"
    }/auth/callback`;

    const oauthUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
      redirectTo
    )}&access_type=offline&prompt=consent`;

    return NextResponse.json({
      action: "generate-url",
      redirectTo,
      oauthUrl,
      expectedFlow: [
        `1. Browser redirects to: ${oauthUrl}`,
        `2. Supabase redirects to: https://accounts.google.com/o/oauth2/v2/auth?...`,
        `3. User logs in to Google`,
        `4. Google redirects to: ${supabaseUrl}/auth/v1/callback?code=...`,
        `5. Supabase processes OAuth code`,
        `6. Supabase redirects to: ${redirectTo}?code=...`,
        `7. App exchanges code for session`,
        `8. App redirects to: /dashboard`,
      ],
      googleCloudConsoleRequired: {
        authorizedRedirectUris: [`${supabaseUrl}/auth/v1/callback`],
        authorizedJavaScriptOrigins: [
          request.headers.get("origin") || "http://localhost:3000",
          supabaseUrl,
        ],
      },
    });
  }

  if (action === "test-provider") {
    // Test if Google provider is configured
    try {
      // We can't directly check provider config via client SDK
      // But we can verify the URL structure
      const testUrl = `${supabaseUrl}/auth/v1/authorize?provider=google`;

      return NextResponse.json({
        action: "test-provider",
        providerUrl: testUrl,
        note: "To verify Google provider is enabled, check Supabase Dashboard → Authentication → Providers → Google",
        requiredConfig: {
          enableSignInWithGoogle: "ON",
          clientId: "Must be filled from Google Cloud Console",
          clientSecret: "Must be filled from Google Cloud Console",
        },
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: "Failed to test provider",
          details: err instanceof Error ? err.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  }

  // Default: return info
  return NextResponse.json({
    message: "OAuth Test Endpoint",
    availableActions: [
      "info - Show this message",
      "generate-url - Generate OAuth URL and show expected flow",
      "test-provider - Test Google provider configuration",
    ],
    usage: "/api/test-oauth?action=generate-url",
    supabaseUrl,
    currentOrigin: request.headers.get("origin") || "http://localhost:3000",
  });
}
