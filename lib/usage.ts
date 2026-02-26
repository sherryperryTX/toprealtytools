import { supabase } from "./supabase";

const FREE_MONTHLY_LIMIT = 50;

export interface UsageStatus {
  count: number;
  limit: number;
  remaining: number;
  isOver: boolean;
  hasOwnKeys: boolean;
}

/**
 * Get the current user's monthly usage count
 */
export async function getUsageCount(userId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("usage_tracking")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart.toISOString());

  if (error) {
    console.error("Usage count error:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Record a usage event
 */
export async function trackUsage(
  userId: string,
  userEmail: string,
  tool: "snitch-mitch" | "appraiser",
  messageType: "chat" | "photo" | "voice" = "chat"
) {
  const { error } = await supabase.from("usage_tracking").insert({
    user_id: userId,
    user_email: userEmail,
    tool,
    message_type: messageType,
  });

  if (error) {
    console.error("Track usage error:", error);
  }
}

/**
 * Check if user is over the free limit
 */
export async function checkUsageStatus(userId: string): Promise<UsageStatus> {
  const count = await getUsageCount(userId);
  const hasOwnKeys = hasUserApiKeys();

  return {
    count,
    limit: FREE_MONTHLY_LIMIT,
    remaining: Math.max(0, FREE_MONTHLY_LIMIT - count),
    isOver: count >= FREE_MONTHLY_LIMIT && !hasOwnKeys,
    hasOwnKeys,
  };
}

/**
 * Store user's own API keys in localStorage (never sent to our server)
 */
export function saveUserApiKeys(keys: { anthropicKey?: string; openaiKey?: string }) {
  if (typeof window === "undefined") return;
  if (keys.anthropicKey) {
    localStorage.setItem("trt_anthropic_key", keys.anthropicKey);
  }
  if (keys.openaiKey) {
    localStorage.setItem("trt_openai_key", keys.openaiKey);
  }
}

/**
 * Get user's own API keys from localStorage
 */
export function getUserApiKeys(): { anthropicKey: string | null; openaiKey: string | null } {
  if (typeof window === "undefined") return { anthropicKey: null, openaiKey: null };
  return {
    anthropicKey: localStorage.getItem("trt_anthropic_key"),
    openaiKey: localStorage.getItem("trt_openai_key"),
  };
}

/**
 * Check if user has their own API keys saved
 */
export function hasUserApiKeys(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("trt_anthropic_key");
}

/**
 * Clear user's stored API keys
 */
export function clearUserApiKeys() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("trt_anthropic_key");
  localStorage.removeItem("trt_openai_key");
}

export const FREE_LIMIT = FREE_MONTHLY_LIMIT;
