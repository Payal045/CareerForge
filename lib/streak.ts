// lib/streak.ts
export type StreakInfo = { streak: number; lastActive: string | null };

const GUEST_KEY = "careerforge_streak";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function readGuestStreak(): StreakInfo {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(GUEST_KEY) : null;
    if (!raw) return { streak: 0, lastActive: null };
    return JSON.parse(raw) as StreakInfo;
  } catch {
    return { streak: 0, lastActive: null };
  }
}

export function writeGuestStreak(info: StreakInfo) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(GUEST_KEY, JSON.stringify(info));
  } catch {}
}

// Touch guest streak (increment/reset logic same as server)
export function touchGuestStreak(): StreakInfo {
  const cur = readGuestStreak();
  const today = todayIso();
  if (!cur.lastActive) {
    const next = { streak: 1, lastActive: today };
    writeGuestStreak(next);
    return next;
  }
  if (cur.lastActive === today) return cur;
  const lastDate = new Date(cur.lastActive + "T00:00:00Z");
  const todayDate = new Date(today + "T00:00:00Z");
  const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  const next = { streak: diffDays === 1 ? cur.streak + 1 : 1, lastActive: today };
  writeGuestStreak(next);
  return next;
}

export function resetGuestStreak() {
  writeGuestStreak({ streak: 0, lastActive: null });
}
