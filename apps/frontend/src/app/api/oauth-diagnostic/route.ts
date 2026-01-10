import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT_SET",
      supabaseAnonKeyPresent: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseAnonKeyLength:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
      nodeEnv: process.env.NODE_ENV,
    },
    urls: {
      origin: "http://localhost:3000",
      callbackUrl: "http://localhost:3000/auth/callback",
      expectedSupabaseCallback: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`
        : "SUPABASE_URL_NOT_SET",
    },
    checks: {} as Record<string, { status: string; message: string }>,
  };

  // Check 1: Supabase URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    diagnostics.checks.supabaseUrl = {
      status: "FAIL",
      message: "NEXT_PUBLIC_SUPABASE_URL is not set",
    };
  } else if (!supabaseUrl.startsWith("https://")) {
    diagnostics.checks.supabaseUrl = {
      status: "FAIL",
      message: "NEXT_PUBLIC_SUPABASE_URL must start with https://",
    };
  } else if (!supabaseUrl.includes(".supabase.co")) {
    diagnostics.checks.supabaseUrl = {
      status: "WARN",
      message: "NEXT_PUBLIC_SUPABASE_URL does not appear to be a Supabase URL",
    };
  } else {
    diagnostics.checks.supabaseUrl = {
      status: "PASS",
      message: "Supabase URL format is correct",
    };
  }

  // Check 2: Anon key format
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    diagnostics.checks.anonKey = {
      status: "FAIL",
      message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set",
    };
  } else if (anonKey.length < 100) {
    diagnostics.checks.anonKey = {
      status: "WARN",
      message: "NEXT_PUBLIC_SUPABASE_ANON_KEY seems too short (expected JWT)",
    };
  } else {
    diagnostics.checks.anonKey = {
      status: "PASS",
      message: "Anon key format appears correct",
    };
  }

  // Check 3: Supabase client creation
  try {
    if (supabaseUrl && anonKey) {
      const testClient = createClient(supabaseUrl, anonKey);
      diagnostics.checks.clientCreation = {
        status: "PASS",
        message: "Supabase client created successfully",
      };

      // Check 4: Test connection to Supabase
      try {
        const { error } = await testClient.auth.getSession();
        if (error) {
          diagnostics.checks.connection = {
            status: "WARN",
            message: `No active session (expected): ${error.message}`,
          };
        } else {
          diagnostics.checks.connection = {
            status: "PASS",
            message: "Connection to Supabase Auth successful",
          };
        }
      } catch (err) {
        diagnostics.checks.connection = {
          status: "FAIL",
          message: `Failed to connect to Supabase: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        };
      }
    } else {
      diagnostics.checks.clientCreation = {
        status: "FAIL",
        message: "Cannot create client - missing URL or anon key",
      };
    }
  } catch (err) {
    diagnostics.checks.clientCreation = {
      status: "FAIL",
      message: `Failed to create Supabase client: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    };
  }

  // Check 5: OAuth redirect URL configuration
  const redirectTo = `http://localhost:3000/auth/callback`;
  diagnostics.checks.redirectUrl = {
    status: "INFO",
    message: `OAuth will redirect to: ${redirectTo}`,
  };

  // Summary
  const failCount = Object.values(diagnostics.checks).filter(
    (c) => c.status === "FAIL"
  ).length;
  const warnCount = Object.values(diagnostics.checks).filter(
    (c) => c.status === "WARN"
  ).length;
  const passCount = Object.values(diagnostics.checks).filter(
    (c) => c.status === "PASS"
  ).length;

  const summary = {
    total: Object.keys(diagnostics.checks).length,
    passed: passCount,
    warnings: warnCount,
    failed: failCount,
    overallStatus: failCount > 0 ? "FAIL" : warnCount > 0 ? "WARN" : "PASS",
  };

  return NextResponse.json(
    {
      ...diagnostics,
      summary,
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
