import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth"; // adjust if needed
import { dbConnect } from "@/lib/dbConnect";
import Note from "@/models/Note";

export async function GET(req: Request) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || "guest"; // fallback guest

  const { searchParams } = new URL(req.url);
  const milestone = searchParams.get("milestone");

  const q: any = { userId };
  if (milestone) q.milestone = milestone;

  const notes = await Note.find(q).sort({ updatedAt: -1 }).lean();
  return NextResponse.json({ notes });
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || "guest"; // fallback guest

    const body = await req.json();
    if (!body?.content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    const note = await Note.create({ ...body, userId });
    return NextResponse.json({ note }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || "guest"; // fallback guest

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json(
        { error: "Missing id" },
        { status: 400 }
      );
    }

    // only delete notes belonging to this user
    const deleted = await Note.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
      return NextResponse.json(
        { error: "Note not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting note:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
