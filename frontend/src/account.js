import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Guest exploration works without a Supabase project.
export const supabase = url && key ? createClient(url, key) : null;

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
