// lib/storage.ts
import type { Roadmap } from "./types";

export const GUEST_KEY = "careerforge_roadmaps_guest";
export const LEGACY_KEY = "careerforge_roadmaps"; // your older key
export const PREFIX = "careerforge_roadmaps_";

/**
 * Return the localStorage key for an email (or guest).
 */
export function getLocalKey(email: string | null): string {
  return email ? `${PREFIX}${email}` : GUEST_KEY;
}

/**
 * Safe localStorage read that works in SSR (returns [] when window is undefined).
 */
export function loadLocalRoadmaps(key: string): Roadmap[] {
  try {
    if (typeof window === "undefined") return [];
    // If key is guest and legacy exists, prefer legacy (back-compat)
    const raw =
      key === GUEST_KEY
        ? window.localStorage.getItem(GUEST_KEY) ?? window.localStorage.getItem(LEGACY_KEY)
        : window.localStorage.getItem(key);

    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Coerce minimal shape to Roadmap-ish objects (defensive)
    return parsed.map((p: any) => {
      return {
        id: String(p.id ?? p._id ?? ""),
        name: p.name ?? p.payload?.name ?? "Untitled roadmap",
        skills: Array.isArray(p.skills)
          ? p.skills
          : Array.isArray(p.payload?.roadmap)
          ? p.payload.roadmap.flatMap((n: any) => n.skills ?? [])
          : [],
        payload: p.payload ?? p,
        createdAt: p.createdAt ? String(p.createdAt) : new Date().toISOString(),
      } as Roadmap;
    });
  } catch (err) {
    // JSON.parse or localStorage access may fail; degrade gracefully
    // eslint-disable-next-line no-console
    console.error("loadLocalRoadmaps error", err);
    return [];
  }
}

/**
 * Safe localStorage write that works in SSR (no-op on server).
 * Also updates LEGACY_KEY for backward compatibility so older code still works.
 */
export function saveLocalRoadmaps(key: string, items: Roadmap[]): void {
  try {
    if (typeof window === "undefined") return;
    const serialized = JSON.stringify(items);
    window.localStorage.setItem(key, serialized);

    // keep legacy key usable for older code expecting careerforge_roadmaps
    try {
      if (key !== LEGACY_KEY) {
        window.localStorage.setItem(LEGACY_KEY, serialized);
      }
    } catch {
      // ignore legacy write failures
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("saveLocalRoadmaps error", err);
  }
}

/**
 * Remove guest key (and legacy key if it points to guest data).
 */
export function removeLocalGuest(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(GUEST_KEY);
    // Also remove legacy if it exists (we assume legacy was guest in many installs)
    try {
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      // noop
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("removeLocalGuest error", err);
  }
}
