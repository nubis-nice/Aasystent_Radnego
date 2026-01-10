import { supabase } from "./client";
import type {
  User,
  AuthChangeEvent,
  Session,
  AuthError,
} from "@supabase/supabase-js";

export interface SignInResult {
  user: User | null;
  requiresPasswordChange: boolean;
  error: AuthError | null;
}

// Logowanie email/hasło
export async function signInWithPassword(
  email: string,
  password: string
): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, requiresPasswordChange: false, error };
  }

  if (data.user) {
    // Sprawdź czy wymaga zmiany hasła
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("force_password_change")
      .eq("id", data.user.id)
      .single();

    if (profile?.force_password_change) {
      return { user: data.user, requiresPasswordChange: true, error: null };
    }

    // Zaktualizuj last_login
    await supabase
      .from("user_profiles")
      .update({ last_login: new Date().toISOString() })
      .eq("id", data.user.id);
  }

  return { user: data.user, requiresPasswordChange: false, error: null };
}

// OAuth Google
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // WAŻNE: Używamy client-side callback bo Supabase PKCE przechowuje
      // code_verifier w localStorage przeglądarki, nie w cookies serwera
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  return { data, error };
}

// Zmiana hasła
export async function changePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (!error && data.user) {
    // Usuń flagę wymuszenia zmiany hasła
    await supabase
      .from("user_profiles")
      .update({ force_password_change: false })
      .eq("id", data.user.id);
  }

  return { data, error };
}

// Żądanie resetu hasła
export async function requestPasswordReset(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/change-password`,
  });

  return { data, error };
}

// Wylogowanie
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// Pobranie aktualnego użytkownika z profilem
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return { ...user, profile };
  }

  return null;
}

// Sprawdź czy użytkownik jest adminem
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.profile?.role === "admin";
}

// Callback po zmianie stanu auth
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange(
    (_event: AuthChangeEvent, session: Session | null) => {
      callback(session?.user ?? null);
    }
  );
}
