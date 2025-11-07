// src/hooks/useStreakClient.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { readGuestStreak, touchGuestStreak, resetGuestStreak } from "@/lib/streak";

/**
 * Guests: canonical displayed streak = 1.
 * Authenticated users: use server values.
 */

export default function useStreakClient() {
  const { data: session } = useSession();
  const isAuthed = !!session?.user?.email;

  const [loading, setLoading] = useState(true);
  // default to 1 so guest UI shows 1 instantly
  const [streak, setStreak] = useState<number>(1);
  const [lastActive, setLastActive] = useState<string | null>(null);

  const GUEST_TOUCH_KEY = "careerforge_guest_touch_date";
  const GUEST_STREAK_KEY = "careerforge_guest_streak";

  const persistGuestLocal = (streakVal: number, lastActiveVal?: string | null) => {
    try {
      localStorage.setItem(GUEST_STREAK_KEY, String(streakVal));
      if (lastActiveVal) localStorage.setItem(GUEST_TOUCH_KEY, lastActiveVal);
      else localStorage.removeItem(GUEST_TOUCH_KEY);
    } catch (e) {
      // ignore storage errors
    }
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        if (!isAuthed) {
          // Guests: canonical display = 1. Persist to local storage to fix stale zeros.
          const g = readGuestStreak();
          const last = g?.lastActive ?? null;
          persistGuestLocal(1, last ?? null);
          if (mounted) {
            setStreak(1);
            setLastActive(last);
          }
        } else {
          // Authenticated: fetch authoritative value from server
          const res = await fetch("/api/user/streak");
          if (res.ok) {
            const j = await res.json();
            if (mounted) {
              setStreak(j.streak ?? 0);
              setLastActive(j.lastActive ?? null);
            }
          } else {
            if (mounted) { setStreak(0); setLastActive(null); }
          }
        }
      } catch {
        if (mounted) { setStreak(isAuthed ? 0 : 1); setLastActive(null); }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [isAuthed]);

  const touch = useCallback(async (date?: string) => {
    const today = date ?? new Date().toISOString().slice(0, 10);

    if (!isAuthed) {
      // Keep guest at 1, update lastActive locally
      persistGuestLocal(1, today);
      setStreak(1);
      setLastActive(today);
      return { streak: 1, lastActive: today };
    }

    // Authenticated user path (unchanged)
    try {
      const lastTouch = typeof window !== "undefined" ? localStorage.getItem(GUEST_TOUCH_KEY) : null;
      if (lastTouch === today) {
        const res = await fetch("/api/user/streak");
        if (res.ok) {
          const j = await res.json();
          const current = j.streak ?? 0;
          setStreak(current > 0 ? current : 1);
          setLastActive(j.lastActive ?? null);
          return j;
        }
      }
    } catch {}

    const res = await fetch("/api/user/streak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "touch", date: today }),
    });
    if (res.ok) {
      const j = await res.json();
      setStreak(j.streak ?? 0);
      setLastActive(j.lastActive ?? null);
      try { localStorage.setItem(GUEST_TOUCH_KEY, today); } catch {}
      return j;
    } else {
      throw new Error("touch failed");
    }
  }, [isAuthed]);

  const reset = useCallback(async () => {
    if (!isAuthed) {
      // Keep guest canonical value at 1
      persistGuestLocal(1, null);
      setStreak(1);
      setLastActive(null);
      try { resetGuestStreak(); } catch {}
      return { streak: 1, lastActive: null };
    }

    const res = await fetch("/api/user/streak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    if (res.ok) {
      const j = await res.json();
      setStreak(j.streak ?? 0);
      setLastActive(j.lastActive ?? null);
      return j;
    } else {
      throw new Error("reset failed");
    }
  }, [isAuthed]);

  return { loading, streak, lastActive, touch, reset };
}
