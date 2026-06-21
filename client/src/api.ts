import type {
  LoginResponse,
  Player,
  PresetDefinition,
  TournamentState,
  UpsertTournamentInput,
} from "@poker-club/shared";

/**
 * Base URL for REST calls.
 *
 * In dev, Vite proxies /api to the backend (see vite.config.ts), so an empty
 * string works. In production VITE_API_URL points at the deployed server.
 */
const BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("adminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* -------------------------------------------------------------------------- */

export const api = {
  async login(password: string): Promise<LoginResponse> {
    const data = await request<LoginResponse>("/api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    localStorage.setItem("adminToken", data.token);
    localStorage.setItem("adminTokenExpiresAt", data.expiresAt);
    return data;
  },

  logout(): void {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminTokenExpiresAt");
  },

  isLoggedIn(): boolean {
    const token = localStorage.getItem("adminToken");
    const expiresAt = localStorage.getItem("adminTokenExpiresAt");
    if (!token || !expiresAt) return false;
    return new Date(expiresAt).getTime() > Date.now();
  },

  getTournament(): Promise<TournamentState | null> {
    return request<TournamentState | null>("/api/tournament");
  },

  getPresets(): Promise<PresetDefinition[]> {
    return request<PresetDefinition[]>("/api/presets");
  },

  saveTournament(input: UpsertTournamentInput): Promise<TournamentState> {
    return request<TournamentState>("/api/tournament", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(input),
    });
  },

  addPlayer(name: string): Promise<TournamentState> {
    return request<TournamentState>("/api/tournament/players", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name }),
    });
  },

  updatePlayer(id: string, patch: Partial<Player>): Promise<TournamentState> {
    return request<TournamentState>(`/api/players/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
  },

  /** Applies a single rebuy: increments rebuyCount by 1, adds rebuyAmount chips. */
  rebuy(id: string): Promise<TournamentState> {
    return request<TournamentState>(`/api/players/${id}/rebuy`, {
      method: "POST",
      headers: authHeaders(),
    });
  },

  /** Applies a double rebuy: increments rebuyCount by 2, adds doubleRebuyAmount chips. */
  doubleRebuy(id: string): Promise<TournamentState> {
    return request<TournamentState>(`/api/players/${id}/double-rebuy`, {
      method: "POST",
      headers: authHeaders(),
    });
  },

  /** Applies an addon: increments addonCount by 1, adds addonAmount chips. */
  addon(id: string): Promise<TournamentState> {
    return request<TournamentState>(`/api/players/${id}/addon`, {
      method: "POST",
      headers: authHeaders(),
    });
  },

  removePlayer(id: string): Promise<TournamentState> {
    return request<TournamentState>(`/api/players/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  },

  /** Uploads a background image. Uses FormData, so no JSON content-type. */
  async uploadBackground(file: File): Promise<{ backgroundImage: string }> {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(`${BASE}/api/tournament/background`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error ?? `Upload failed: ${res.status}`);
    }
    return res.json();
  },

  /** Clears the background image. */
  clearBackground(): Promise<{ backgroundImage: null }> {
    return request<{ backgroundImage: null }>("/api/tournament/background", {
      method: "DELETE",
      headers: authHeaders(),
    });
  },
};
