// app/api/user/streak/route.ts
import { NextResponse } from "next/server";
import clientPromise from "@/lib/clientPromise";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import type { Db } from "mongodb";

type Body = { action?: "touch" | "reset"; date?: string };

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return session;
}

/**
 * Helper to safely get DB client and return descriptive error tags.
 */
async function getDbOrError(): Promise<{ db: Db | null; error: string | null }> {
  try {
    const client = await clientPromise;
    const db = client.db();
    return { db, error: null };
  } catch (err: unknown) {
    console.error("DB connection failed in /api/user/streak:", err);
    const msg = (err as Error)?.message?.toLowerCase?.() ?? String(err).toLowerCase();
    const errorTag = msg.includes("tls") || msg.includes("ssl")
      ? "database_tls_error"
      : "database_connection_error";
    return { db: null, error: errorTag };
  }
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { db, error } = await getDbOrError();
    if (error || !db) {
      return NextResponse.json({ error, details: "Failed to connect to database" }, { status: 502 });
    }

    const col = db.collection("user_stats");
    const doc = await col.findOne({ userEmail: session.user.email });

    if (!doc) {
      return NextResponse.json({ streak: 1, lastActive: null });
    }

    const storedStreak = typeof doc.streak === "number" ? doc.streak : 1;
    const streak = storedStreak > 0 ? storedStreak : 1;
    return NextResponse.json({ streak, lastActive: doc.lastActive ?? null });
  } catch (err: unknown) {
    console.error("GET /api/user/streak error:", err);
    return NextResponse.json({ error: "server_error", details: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action ?? "touch";

    const { db, error } = await getDbOrError();
    if (error || !db) {
      return NextResponse.json({ error, details: "Failed to connect to database" }, { status: 502 });
    }

    const col = db.collection("user_stats");
    const today =
      body.date && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(body.date) ? body.date : todayIsoDate();

    if (action === "reset") {
      await col.updateOne(
        { userEmail: session.user.email },
        { $set: { streak: 1, lastActive: null } },
        { upsert: true }
      );
      return NextResponse.json({ streak: 1, lastActive: null });
    }

    const existing = await col.findOne({ userEmail: session.user.email });

    if (!existing || !existing.lastActive) {
      await col.updateOne(
        { userEmail: session.user.email },
        { $set: { streak: 1, lastActive: today } },
        { upsert: true }
      );
      return NextResponse.json({ streak: 1, lastActive: today });
    }

    const last = String(existing.lastActive);
    if (last === today) {
      const current = typeof existing.streak === "number" ? existing.streak : 1;
      return NextResponse.json({ streak: current > 0 ? current : 1, lastActive: last });
    }

    const lastDate = new Date(last + "T00:00:00Z");
    const todayDate = new Date(today + "T00:00:00Z");
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    let newStreak = 1;
    if (diffDays === 1) {
      newStreak = (typeof existing.streak === "number" ? existing.streak : 0) + 1;
      if (newStreak < 1) newStreak = 1;
    } else {
      newStreak = 1;
    }

    await col.updateOne(
      { userEmail: session.user.email },
      { $set: { streak: newStreak, lastActive: today } },
      { upsert: true }
    );

    return NextResponse.json({ streak: newStreak, lastActive: today });
  } catch (err: unknown) {
    console.error("POST /api/user/streak error:", err);
    const msg = (err as Error)?.message?.toLowerCase?.() ?? String(err).toLowerCase();
    if (msg.includes("tls") || msg.includes("ssl") || msg.includes("certificate")) {
      return NextResponse.json(
        {
          error: "database_tls_error",
          details: "TLS/SSL handshake with DB failed. Check MONGODB_URI, CA, and IP allowlist.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "server_error", details: String(err) }, { status: 500 });
  }
}
