// app/api/user/streak/route.ts
import { NextResponse } from "next/server";
import clientPromise from "@/lib/clientPromise";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";

type Body = { action?: "touch" | "reset"; date?: string };

function todayIsoDate() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return session;
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const client = await clientPromise;
    const db = client.db();
    const col = db.collection("user_stats");

    const doc = await col.findOne({ userEmail: session.user.email });

    // If no document exists, treat as first-time and return streak = 1 (baseline)
    if (!doc) {
      return NextResponse.json({ streak: 1, lastActive: null });
    }

    // If doc exists, return stored streak (but never return 0 as the UI baseline)
    const storedStreak = typeof doc.streak === "number" ? doc.streak : 1;
    const streak = storedStreak > 0 ? storedStreak : 1;
    return NextResponse.json({ streak, lastActive: doc.lastActive ?? null });
  } catch (err) {
    console.error("GET /api/user/streak error:", err);
    return NextResponse.json({ error: "server_error", details: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body: Body = await req.json().catch(() => ({} as Body));
    const action = body.action ?? "touch";

    const client = await clientPromise;
    const db = client.db();
    const col = db.collection("user_stats");

    // prefer client-provided date if valid, else server date
    const today =
      body.date && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(body.date) ? body.date : todayIsoDate();

    if (action === "reset") {
      // Reset: set to 0 and clear lastActive (frontend will show 1 baseline until touched)
      await col.updateOne(
        { userEmail: session.user.email },
        { $set: { streak: 0, lastActive: null } },
        { upsert: true }
      );
      return NextResponse.json({ streak: 0, lastActive: null });
    }

    // action === "touch"
    const existing = await col.findOne({ userEmail: session.user.email });

    if (!existing || !existing.lastActive) {
      // first touch -> set streak to 1
      await col.updateOne(
        { userEmail: session.user.email },
        { $set: { streak: 1, lastActive: today } },
        { upsert: true }
      );
      return NextResponse.json({ streak: 1, lastActive: today });
    }

    const last = String(existing.lastActive); // YYYY-MM-DD
    if (last === today) {
      // already touched today — return existing streak (ensure baseline >=1)
      const current = typeof existing.streak === "number" ? existing.streak : 1;
      return NextResponse.json({ streak: current > 0 ? current : 1, lastActive: last });
    }

    // compute day difference (use UTC midnight to avoid timezone drift)
    const lastDate = new Date(last + "T00:00:00Z");
    const todayDate = new Date(today + "T00:00:00Z");
    const diffMs = todayDate.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let newStreak = 1;
    if (diffDays === 1) {
      newStreak = (typeof existing.streak === "number" ? existing.streak : 0) + 1;
    } else {
      newStreak = 1; // break in streak
    }

    await col.updateOne(
      { userEmail: session.user.email },
      { $set: { streak: newStreak, lastActive: today } },
      { upsert: true }
    );

    return NextResponse.json({ streak: newStreak, lastActive: today });
  } catch (err) {
    console.error("POST /api/user/streak error:", err);
    return NextResponse.json({ error: "server_error", details: String(err) }, { status: 500 });
  }
}
