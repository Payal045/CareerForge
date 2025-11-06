// lib/api.ts
import type { Roadmap } from "./types";

async function fetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: "same-origin", ...opts });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function apiGetRoadmaps(): Promise<Roadmap[]> {
  return fetchJson("/api/user/roadmaps", { method: "GET" });
}

export async function apiAddRoadmap(r: Roadmap): Promise<Roadmap> {
  return fetchJson("/api/user/roadmaps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(r),
  });
}

export async function apiDeleteRoadmap(id: string): Promise<void> {
  // support route /api/user/roadmaps/:id
  const path = `/api/user/roadmaps/${encodeURIComponent(id)}`;
  await fetchJson(path, { method: "DELETE" });
}

export async function apiUpdateRoadmap(id: string, r: Roadmap): Promise<Roadmap> {
  const path = `/api/user/roadmaps/${encodeURIComponent(id)}`;
  return fetchJson(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(r),
  });
}
