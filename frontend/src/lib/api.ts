// Backend API helper for Vinle
import { storage } from "@/src/utils/storage";
import { getModes as modesForPreset, type DesignPreset } from "@/src/lib/theme-presets";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
const TOKEN_KEY = "tb_session_token";

export async function getToken(): Promise<string | null> {
  return await storage.secureGet<string>(TOKEN_KEY, "");
}

export async function setToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

async function request(path: string, options: any = {}) {
  if (!BASE) {
    throw new Error(
      "Backend URL missing. Set EXPO_PUBLIC_BACKEND_URL in frontend/.env and restart Expo (npx expo start -c)."
    );
  }
  const token = await getToken();
  const headers: any = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let resp: Response;
  try {
    resp = await fetch(`${BASE}/api${path}`, { ...options, headers });
  } catch {
    throw new Error(
      `Cannot reach backend at ${BASE}. Phone and Mac must be on the same Wi‑Fi (not mobile data). Open ${BASE}/docs in your phone browser to test.`
    );
  }
  const text = await resp.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!resp.ok) {
    const snippet = text && !data ? `: ${text.slice(0, 120)}` : "";
    const err: any = new Error(data?.detail || `Request failed: ${resp.status}${snippet}`);
    err.status = resp.status;
    throw err;
  }
  return data;
}

export const api = {
  exchangeSession: (session_token: string) =>
    request("/auth/session", {
      method: "POST",
      body: JSON.stringify({ session_token }),
    }),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
  saveProfile: (profile: any) =>
    request("/profile", { method: "POST", body: JSON.stringify(profile) }),
  myProfile: () => request("/profile/me"),
  updateProfileSettings: (settings: { hide_from_discover: boolean }) =>
    request("/profile/settings", { method: "PATCH", body: JSON.stringify(settings) }),
  discover: (
    mode: string,
    filters?: {
      destination?: string;
      location?: string;
      minAge?: number;
      maxAge?: number;
      genders?: string[];
    }
  ) => {
    const params = new URLSearchParams({ mode });
    if (filters?.destination?.trim()) params.set("destination", filters.destination.trim());
    if (filters?.location?.trim()) params.set("location", filters.location.trim());
    if (filters?.minAge != null && !Number.isNaN(filters.minAge)) {
      params.set("min_age", String(filters.minAge));
    }
    if (filters?.maxAge != null && !Number.isNaN(filters.maxAge)) {
      params.set("max_age", String(filters.maxAge));
    }
    if (filters?.genders?.length) params.set("genders", filters.genders.join(","));
    return request(`/discover?${params.toString()}`);
  },
  discoverGroups: (
    mode: string,
    filters?: {
      destination?: string;
      location?: string;
    }
  ) => {
    const params = new URLSearchParams({ mode });
    if (filters?.destination?.trim()) params.set("destination", filters.destination.trim());
    if (filters?.location?.trim()) params.set("location", filters.location.trim());
    return request(`/discover/groups?${params.toString()}`);
  },
  swipe: (target_user_id: string, direction: "like" | "pass", mode: string) =>
    request("/swipes", {
      method: "POST",
      body: JSON.stringify({ target_user_id, direction, mode }),
    }),
  groupSwipe: (target_group_id: string, direction: "like" | "pass", mode: string) =>
    request("/group-swipes", {
      method: "POST",
      body: JSON.stringify({ target_group_id, direction, mode }),
    }),
  matches: () => request("/matches"),
  myGroups: () => request("/groups/me"),
  groupDetail: (group_id: string) => request(`/groups/${group_id}`),
  groupInviteCandidates: (group_id: string) => request(`/groups/${group_id}/invite-candidates`),
  inviteGroupMember: (group_id: string, user_id: string) =>
    request(`/groups/${group_id}/invite/${user_id}`, { method: "POST" }),
  removeGroupMember: (group_id: string, user_id: string) =>
    request(`/groups/${group_id}/members/${user_id}/remove`, { method: "POST" }),
  acceptGroupInvitation: (group_id: string, request_id: string) =>
    request(`/groups/${group_id}/invitations/${request_id}/accept`, { method: "POST" }),
  rejectGroupInvitation: (group_id: string, request_id: string) =>
    request(`/groups/${group_id}/invitations/${request_id}/reject`, { method: "POST" }),
  createGroup: (group: any) =>
    request("/groups", {
      method: "POST",
      body: JSON.stringify(group),
    }),
  groupRequests: (group_id: string) => request(`/groups/${group_id}/requests`),
  acceptGroupRequest: (group_id: string, request_id: string) =>
    request(`/groups/${group_id}/requests/${request_id}/accept`, { method: "POST" }),
  rejectGroupRequest: (group_id: string, request_id: string) =>
    request(`/groups/${group_id}/requests/${request_id}/reject`, { method: "POST" }),
  messages: (match_id: string) => request(`/chats/${match_id}/messages`),
  sendMessage: (match_id: string, text: string) =>
    request(`/chats/${match_id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  groupMessages: (group_id: string) => request(`/groups/${group_id}/messages`),
  sendGroupMessage: (group_id: string, text: string) =>
    request(`/groups/${group_id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  suggestions: (q: string, limit = 8) =>
    request(`/suggestions?q=${encodeURIComponent(q)}&limit=${limit}`),
  interestSuggestions: (q: string, limit = 8) =>
    request(`/suggestions/interests?q=${encodeURIComponent(q)}&limit=${limit}`),
};

import { LEGACY_LIGHT } from "@/src/lib/theme-presets";

export const COLORS = {
  bg: LEGACY_LIGHT.bg,
  surface: LEGACY_LIGHT.surface,
  primary: LEGACY_LIGHT.primary,
  primaryHover: LEGACY_LIGHT.primaryHover,
  primarySoft: LEGACY_LIGHT.primarySoft,
  onPrimary: LEGACY_LIGHT.onPrimary,
  secondary: LEGACY_LIGHT.secondary,
  accent: LEGACY_LIGHT.accent,
  textPrimary: LEGACY_LIGHT.textPrimary,
  textSecondary: LEGACY_LIGHT.textSecondary,
  border: LEGACY_LIGHT.border,
  success: LEGACY_LIGHT.success,
  warning: LEGACY_LIGHT.warning,
  error: LEGACY_LIGHT.error,
  chipBg: LEGACY_LIGHT.chipBg,
  inputBg: LEGACY_LIGHT.inputBg,
};

export const MODES = modesForPreset("legacy");

export function getModes(preset: DesignPreset = "legacy") {
  return modesForPreset(preset);
}

export type ModeKey = "events" | "trips" | "situationship";

/** Profile gender options (onboarding) + discover filter-only option */
export const PROFILE_GENDERS = ["female", "male", "non-binary", "other"] as const;

export const DISCOVER_GENDER_FILTERS = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "non-binary", label: "Non-binary" },
  { key: "lgbtq", label: "LGBTQ+" },
  { key: "other", label: "Other" },
] as const;
