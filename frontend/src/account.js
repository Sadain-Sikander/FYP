import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Guest exploration works without a Supabase project.
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          // Keep existing email recovery links usable while new OAuth flows use PKCE.
          flowType: new URLSearchParams(window.location.hash.slice(1)).has(
            "access_token",
          )
            ? "implicit"
            : "pkce",
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

// Capture the callback before the Auth SDK consumes its code from the URL.
export const isAuthCallback = new URLSearchParams(window.location.search).has(
  "auth_callback",
);
export function authRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}?auth_callback=1`;
}

export function clearAuthCallback() {
  const next = new URL(window.location.href);
  for (const key of [
    "auth_callback",
    "code",
    "error",
    "error_code",
    "error_description",
  ])
    next.searchParams.delete(key);
  // OAuth errors can be returned in a fragment instead of a query string.
  if (new URLSearchParams(next.hash.slice(1)).has("error")) next.hash = "";
  window.history.replaceState(null, "", next);
}

export async function saveUserData(table, userId, data, careerId) {
  if (!supabase || !userId) throw new Error("Sign in to save your work.");
  const record = { user_id: userId, data };
  if (careerId) record.career_id = careerId;
  if (table !== "saved_careers") record.updated_at = new Date().toISOString();
  const { error } = await supabase.from(table).upsert(record);
  if (error)
    throw new Error(
      "Your work could not be saved. Please try again or check your account setup.",
    );
}

export async function loadUserData(table, userId) {
  if (!supabase || !userId) throw new Error("Sign in to load saved work.");
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId);
  if (error)
    throw new Error(
      "Your saved work could not be loaded. Please try again or check your account setup.",
    );
  return data;
}
