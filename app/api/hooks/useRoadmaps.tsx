// src/hooks/useRoadmapsClient.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useSession } from "next-auth/react";
import { getLocalKey, loadLocalRoadmaps, saveLocalRoadmaps, removeLocalGuest } from "@/lib/storage";
import { apiGetRoadmaps, apiAddRoadmap, apiDeleteRoadmap, apiUpdateRoadmap } from "@/lib/api";
import type { Roadmap } from "@/lib/types";

/**
 * Client-safe useRoadmaps hook.
 * - Avoids importing anything server-only.
 * - Uses fetchable API functions from /lib/api which should be client-safe wrappers.
 */

export default function useRoadmapsClient() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? null;
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);

  const localKey = getLocalKey(email);

  const normalize = (r: any): Roadmap => ({
    id: String(r.id ?? r._id ?? uuidv4()),
    name: String(r.name ?? r.payload?.name ?? "Untitled roadmap"),
    skills: Array.isArray(r.skills)
      ? r.skills
      : Array.isArray(r.payload?.roadmap)
      ? r.payload.roadmap.flatMap((p: any) => p.skills ?? [])
      : [],
    payload: typeof r.payload === "object" && r.payload ? r.payload : r,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
  });

  const writeLocal = useCallback((items: Roadmap[]) => {
    try {
      saveLocalRoadmaps(localKey, items);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("__careerforge_sync", String(Date.now()));
        } catch {}
      }
    } catch (e) {
      console.error("writeLocal failed", e);
    }
  }, [localKey]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      // local mirror first
      const localItems = loadLocalRoadmaps(localKey);
      if (localItems && localItems.length) setRoadmaps(localItems.map(normalize));

      if (email) {
        try {
          const db = await apiGetRoadmaps();
          const normalized = db.map(normalize);
          setRoadmaps(normalized);
          writeLocal(normalized);
        } catch (dbErr) {
          console.warn("Failed to fetch roadmaps from server; using local mirror.", dbErr);
        }

        // Migrate guest -> user if present
        const guestKey = getLocalKey(null);
        const guestList = loadLocalRoadmaps(guestKey);
        if (guestList && guestList.length) {
          for (const g of guestList) {
            const nr = normalize(g);
            try {
              await apiAddRoadmap(nr);
            } catch (e) {
              console.warn("Failed to migrate guest roadmap to server", e);
            }
          }
          removeLocalGuest();
          try {
            const dbAfter = await apiGetRoadmaps();
            const normalized = dbAfter.map(normalize);
            setRoadmaps(normalized);
            writeLocal(normalized);
          } catch {}
        }
      }
    } finally {
      setLoading(false);
    }
  }, [email, localKey, writeLocal]);

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      const watched = [getLocalKey(email), getLocalKey(null), "careerforge_roadmaps", "__careerforge_sync"];
      if (!watched.includes(e.key)) return;
      try {
        if (e.key === "__careerforge_sync") {
          const mirror = loadLocalRoadmaps(localKey);
          if (Array.isArray(mirror)) setRoadmaps(mirror.map(normalize));
          return;
        }
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        if (!Array.isArray(parsed)) return;
        setRoadmaps(prev => {
          const map = new Map(prev.map(p => [p.id, p]));
          for (const it of parsed) {
            const n = normalize(it);
            map.set(n.id, n);
          }
          return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
      } catch {}
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => { if (typeof window !== "undefined") window.removeEventListener("storage", onStorage); };
  }, [email, localKey]);

  const addRoadmap = useCallback(async (r: Omit<Roadmap, "id" | "createdAt">) => {
    const newItem: Roadmap = {
      id: uuidv4(),
      name: r.name ?? "Untitled roadmap",
      skills: r.skills ?? [],
      payload: r.payload ?? { roadmap: [], resources: [], progress: null },
      createdAt: new Date().toISOString(),
    };

    setRoadmaps(prev => {
      const next = [newItem, ...prev];
      writeLocal(next);
      return next;
    });

    if (email) {
      try {
        const saved = await apiAddRoadmap(newItem);
        const normalized = normalize(saved);
        setRoadmaps(prev => {
          const next = prev.map(p => (p.id === newItem.id ? normalized : p));
          writeLocal(next);
          return next;
        });
        return normalized;
      } catch (e) {
        console.warn("Failed to save roadmap to server; kept locally.", e);
        return newItem;
      }
    }
    return newItem;
  }, [email, writeLocal]);

  const deleteRoadmap = useCallback(async (id: string) => {
    setRoadmaps(prev => {
      const next = prev.filter(r => r.id !== id);
      writeLocal(next);
      return next;
    });
    if (email) {
      try {
        await apiDeleteRoadmap(id);
      } catch (e) {
        console.warn("Failed to delete from server; local removed.", e);
      }
    }
  }, [email, writeLocal]);

  const updateProgress = useCallback(async (id: string, progress: any) => {
    let updated: Roadmap | null = null;
    setRoadmaps(prev => {
      const next = prev.map(r => {
        if (r.id !== id) return r;
        const copy = { ...r, payload: { ...r.payload, progress } };
        updated = copy;
        return copy;
      });
      writeLocal(next);
      return next;
    });
    if (!updated) return null;
    if (email) {
      try {
        const saved = await apiUpdateRoadmap(id, updated);
        const normalized = normalize(saved);
        setRoadmaps(prev => {
          const next = prev.map(r => (r.id === id ? normalized : r));
          writeLocal(next);
          return next;
        });
        return normalized;
      } catch (e) {
        console.warn("Failed to update progress on server; kept local optimistic.", e);
        return updated;
      }
    }
    return updated;
  }, [email, writeLocal]);

  const refresh = useCallback(async () => { await loadInitial(); }, [loadInitial]);

  return { roadmaps, loading, addRoadmap, deleteRoadmap, updateProgress, refresh };
}
