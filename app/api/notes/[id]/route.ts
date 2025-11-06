// app/api/notes/[id]/route.ts
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Note from "@/models/Note";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // ensure this path is correct

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? "guest";
}

function badRequest(msg = "Bad request") {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET(_req: Request, context: any) {
  try {
    const params = context?.params ?? {};
    const id = params?.id;
    if (!id || typeof id !== "string") return badRequest("Missing or invalid note id");

    await dbConnect();
    const userId = await getUserId();

    const note = await Note.findOne({ _id: id, userId }).lean();
    return NextResponse.json({ note: note ?? null }, { status: 200 });
  } catch (err: unknown) {
    console.error("GET /api/notes/[id] error:", err);
    return NextResponse.json(
      { error: "server_error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, context: any) {
  try {
    const params = context?.params ?? {};
    const id = params?.id;
    if (!id || typeof id !== "string") return badRequest("Missing or invalid note id");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    await dbConnect();
    const userId = await getUserId();

    const note = await Note.findOneAndUpdate(
      { _id: id, userId },
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

export async function DELETE(_req: Request, context: any) {
  try {
    const params = context?.params ?? {};
    const id = params?.id;
    if (!id || typeof id !== "string") return badRequest("Missing or invalid note id");

    await dbConnect();
    const userId = await getUserId();

    const deleted = await Note.findOneAndDelete({ _id: id, userId });

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
