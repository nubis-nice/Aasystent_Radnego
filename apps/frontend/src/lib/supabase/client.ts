import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const realtimeUrl = process.env.NEXT_PUBLIC_SUPABASE_REALTIME_URL;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  realtime: realtimeUrl
    ? {
        url: realtimeUrl,
      }
    : undefined,
});
