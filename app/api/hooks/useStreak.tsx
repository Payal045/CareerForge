// app/api/hooks/useStreak.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { readGuestStreak, touchGuestStreak, resetGuestStreak } from "@/lib/streak";

export default function useStreak() {
  const { data: session } = useSession();
  const isAuthed = !!session?.user?.email;
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<number>(0);
  const [lastActive, setLastActive] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        if (!isAuthed) {
          const g = readGuestStreak();
          if (mounted) {
            setStreak(g.streak);
            setLastActive(g.lastActive);
          }
        } else {
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
      } catch (err) {
        if (mounted) { setStreak(0); setLastActive(null); }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [isAuthed]);

  const GUEST_TOUCH_KEY = "careerforge_guest_touch_date"; // local dedupe

const touch = useCallback(async (date?: string) => {
  // date: optional 'YYYY-MM-DD' from client (preferred)
  const today = date ?? new Date().toISOString().slice(0, 10);

  // Deduplicate on client: if we've touched already today, skip network call
  if (!isAuthed) {
    // guest flow: touchGuestStreak already dedupes, call it and update state
    const g = touchGuestStreak();
    setStreak(g.streak);
    setLastActive(g.lastActive);
    return g;
  }

  // For authed users dedupe by local storage to avoid multiple requests during same day across tabs
  try {
    const lastTouch = typeof window !== "undefined" ? localStorage.getItem(GUEST_TOUCH_KEY) : null;
    if (lastTouch === today) {
      // already touched from this browser today — fetch server state once to sync
      const res = await fetch("/api/user/streak");
      if (res.ok) {
        const j = await res.json();
  const current = j.streak ?? 0;
  setStreak(current > 0 ? current : 1);
  setLastActive(j.lastActive ?? null);
        return j;
      }
    }
  } catch (e) {
    // ignore, proceed with call
  }

  // Call server with client date to ensure correct day used
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
      resetGuestStreak();
      setStreak(0);
      setLastActive(null);
      return { streak: 0, lastActive: null };
    } else {
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
    }
  }, [isAuthed]);

  return { loading, streak, lastActive, touch, reset };
}
