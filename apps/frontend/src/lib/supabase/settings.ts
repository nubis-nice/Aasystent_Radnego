import { supabase } from "./client";

// ============================================
// Typy TypeScript
// ============================================

export interface UserProfile {
  id: string;
  full_name: string;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  role_in_council?: string | null;
  committees?: string[] | null;
  council_term?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  email_new_document: boolean;
  email_analysis_complete: boolean;
  email_weekly_report: boolean;
  push_new_document: boolean;
  push_analysis_complete: boolean;
  push_chat_mention: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppearanceSettings {
  id: string;
  user_id: string;
  theme: "light" | "dark" | "system";
  font_size: "small" | "medium" | "large";
  compact_mode: boolean;
  sidebar_collapsed: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocaleSettings {
  id: string;
  user_id: string;
  language: string;
  timezone: string;
  date_format: string;
  time_format: "12h" | "24h";
  // Dane lokalne gminy/miasta
  municipality?: string | null;
  voivodeship?: string | null;
  postal_code?: string | null;
  county?: string | null;
  bip_url?: string | null;
  council_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacySettings {
  id: string;
  user_id: string;
  profile_visibility: "public" | "team" | "private";
  activity_tracking: boolean;
  analytics_consent: boolean;
  auto_delete_chats_after_days?: number;
  created_at: string;
  updated_at: string;
}

export interface CompleteUserSettings {
  user_id: string;
  email: string;
  profile: UserProfile;
  notifications: NotificationSettings;
  appearance: AppearanceSettings;
  locale: LocaleSettings;
  privacy: PrivacySettings;
}

// ============================================
// Funkcje dla Profilu Użytkownika
// ============================================

export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }

  return data;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, "id" | "created_at" | "updated_at">>,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating user profile:", error);
    return null;
  }

  return data;
}

// ============================================
// Funkcje dla Ustawień Powiadomień
// ============================================

export async function getNotificationSettings(
  userId: string,
): Promise<NotificationSettings | null> {
  const { data, error } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching notification settings:", error);
    return null;
  }

  return data;
}

export async function updateNotificationSettings(
  userId: string,
  updates: Partial<
    Omit<NotificationSettings, "id" | "user_id" | "created_at" | "updated_at">
  >,
): Promise<NotificationSettings | null> {
  const { data, error } = await supabase
    .from("user_notification_settings")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating notification settings:", error);
    return null;
  }

  return data;
}

// ============================================
// Funkcje dla Ustawień Wyglądu
// ============================================

export async function getAppearanceSettings(
  userId: string,
): Promise<AppearanceSettings | null> {
  const { data, error } = await supabase
    .from("user_appearance_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching appearance settings:", error);
    return null;
  }

  return data;
}

export async function updateAppearanceSettings(
  userId: string,
  updates: Partial<
    Omit<AppearanceSettings, "id" | "user_id" | "created_at" | "updated_at">
  >,
): Promise<AppearanceSettings | null> {
  const { data, error } = await supabase
    .from("user_appearance_settings")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating appearance settings:", error);
    return null;
  }

  return data;
}

// ============================================
// Funkcje dla Ustawień Locale
// ============================================

export async function getLocaleSettings(
  userId: string,
): Promise<LocaleSettings | null> {
  const { data, error } = await supabase
    .from("user_locale_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching locale settings:", error);
    return null;
  }

  return data;
}

export async function updateLocaleSettings(
  userId: string,
  updates: Partial<
    Omit<LocaleSettings, "id" | "user_id" | "created_at" | "updated_at">
  >,
): Promise<LocaleSettings | null> {
  console.log("[updateLocaleSettings] Updating for user:", userId);
  console.log("[updateLocaleSettings] Updates:", updates);

  // Użyj upsert zamiast update - jeśli rekord nie istnieje, utworzy go
  const { data, error } = await supabase
    .from("user_locale_settings")
    .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("[updateLocaleSettings] Error:", error);
    console.error("[updateLocaleSettings] Error code:", error.code);
    console.error("[updateLocaleSettings] Error details:", error.details);
    return null;
  }

  console.log("[updateLocaleSettings] Success, data:", data);
  return data;
}

// ============================================
// Funkcje dla Ustawień Prywatności
// ============================================

export async function getPrivacySettings(
  userId: string,
): Promise<PrivacySettings | null> {
  const { data, error } = await supabase
    .from("user_privacy_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching privacy settings:", error);
    return null;
  }

  return data;
}

export async function updatePrivacySettings(
  userId: string,
  updates: Partial<
    Omit<PrivacySettings, "id" | "user_id" | "created_at" | "updated_at">
  >,
): Promise<PrivacySettings | null> {
  const { data, error } = await supabase
    .from("user_privacy_settings")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating privacy settings:", error);
    return null;
  }

  return data;
}

// ============================================
// Funkcja pobierająca wszystkie ustawienia
// ============================================

export async function getAllUserSettings(
  userId: string,
): Promise<CompleteUserSettings | null> {
  // Pobierz dane z widoku zbiorczego
  const { data, error } = await supabase
    .from("user_settings_complete")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching complete user settings:", error);
    return null;
  }

  // Przekształć dane z widoku na strukturę CompleteUserSettings
  return {
    user_id: data.user_id,
    email: data.email,
    profile: {
      id: data.user_id,
      full_name: data.full_name,
      phone: data.phone,
      position: data.position,
      department: data.department,
      avatar_url: data.avatar_url,
      bio: data.bio,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
    notifications: {
      id: data.notification_id,
      user_id: data.user_id,
      email_new_document: data.email_new_document,
      email_analysis_complete: data.email_analysis_complete,
      email_weekly_report: data.email_weekly_report,
      push_new_document: data.push_new_document,
      push_analysis_complete: data.push_analysis_complete,
      push_chat_mention: data.push_chat_mention,
      created_at: data.notification_created_at,
      updated_at: data.notification_updated_at,
    },
    appearance: {
      id: data.appearance_id,
      user_id: data.user_id,
      theme: data.theme,
      font_size: data.font_size,
      compact_mode: data.compact_mode,
      sidebar_collapsed: data.sidebar_collapsed,
      created_at: data.appearance_created_at,
      updated_at: data.appearance_updated_at,
    },
    locale: {
      id: data.locale_id,
      user_id: data.user_id,
      language: data.language,
      timezone: data.timezone,
      date_format: data.date_format,
      time_format: data.time_format,
      created_at: data.locale_created_at,
      updated_at: data.locale_updated_at,
    },
    privacy: {
      id: data.privacy_id,
      user_id: data.user_id,
      profile_visibility: data.profile_visibility,
      activity_tracking: data.activity_tracking,
      analytics_consent: data.analytics_consent,
      auto_delete_chats_after_days: data.auto_delete_chats_after_days,
      created_at: data.privacy_created_at,
      updated_at: data.privacy_updated_at,
    },
  };
}

// ============================================
// Hook React dla ustawień (opcjonalnie)
// ============================================

export function useUserSettings(userId: string | undefined) {
  // TODO: Implementacja z React Query lub SWR dla cache i auto-refresh
  // Na razie zwracamy funkcje do manualnego użycia

  return {
    getProfile: () => (userId ? getUserProfile(userId) : null),
    updateProfile: (updates: Partial<UserProfile>) =>
      userId ? updateUserProfile(userId, updates) : null,

    getNotifications: () => (userId ? getNotificationSettings(userId) : null),
    updateNotifications: (updates: Partial<NotificationSettings>) =>
      userId ? updateNotificationSettings(userId, updates) : null,

    getAppearance: () => (userId ? getAppearanceSettings(userId) : null),
    updateAppearance: (updates: Partial<AppearanceSettings>) =>
      userId ? updateAppearanceSettings(userId, updates) : null,

    getLocale: () => (userId ? getLocaleSettings(userId) : null),
    updateLocale: (updates: Partial<LocaleSettings>) =>
      userId ? updateLocaleSettings(userId, updates) : null,

    getPrivacy: () => (userId ? getPrivacySettings(userId) : null),
    updatePrivacy: (updates: Partial<PrivacySettings>) =>
      userId ? updatePrivacySettings(userId, updates) : null,

    getAll: () => (userId ? getAllUserSettings(userId) : null),
  };
}
