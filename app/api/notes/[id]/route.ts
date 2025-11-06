// app/api/notes/[id]/route.ts
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Note from "@/models/Note";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth"; // adjust path if your auth route is at a different location

type Params = { params: { id?: string } };

async function getUserId() {
  const session = await getServerSession(authOptions);
  // fallback to "guest" so anonymous users work too
  return session?.user?.id ?? "guest";
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!params?.id) {
      return NextResponse.json({ error: "Missing note id" }, { status: 400 });
    }

    await dbConnect();
    const userId = await getUserId();

    const note = await Note.findOne({ _id: params.id, userId }).lean();
    return NextResponse.json({ note: note ?? null }, { status: 200 });
  } catch (err: unknown) {
    console.error("GET /api/notes/[id] error:", err);
    return NextResponse.json(
      { error: "server_error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    if (!params?.id) {
      return NextResponse.json({ error: "Missing note id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    await dbConnect();
    const userId = await getUserId();

    const note = await Note.findOneAndUpdate(
      { _id: params.id, userId },
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!note) {
      return NextResponse.json({ error: "Note not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ note }, { status: 200 });
  } catch (err: unknown) {
    console.error("PUT /api/notes/[id] error:", err);
    return NextResponse.json(
      { error: "server_error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    if (!params?.id) {
      return NextResponse.json({ error: "Missing note id" }, { status: 400 });
    }

    await dbConnect();
    const userId = await getUserId();

    const deleted = await Note.findOneAndDelete({ _id: params.id, userId });

    if (!deleted) {
      return NextResponse.json({ error: "Note not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    console.error("DELETE /api/notes/[id] error:", err);
    return NextResponse.json(
      { error: "server_error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
