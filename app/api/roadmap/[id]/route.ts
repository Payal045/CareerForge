// app/api/user/roadmaps/route.ts
import { NextResponse } from "next/server";
import clientPromise from "@/lib/clientPromise";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { ObjectId } from "mongodb";

type ReqBody = {
  id?: string;
  name?: string;
  skills?: any;
  payload?: any;
  createdAt?: string;
};

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return session;
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const client = await clientPromise;
    const db = client.db();
    const col = db.collection("user_roadmaps");

    // list all roadmaps for this user (most recent first)
    const docs = await col.find({ userEmail: session.user.email }).sort({ createdAt: -1 }).toArray();

    // normalize: include id as string for client convenience
    const normalized = docs.map((d: any) => ({ ...d, id: String(d._id) }));

    return NextResponse.json(normalized, { status: 200 });
  } catch (err) {
    console.error("GET /api/user/roadmaps error:", err);
    return NextResponse.json({ error: "server_error", details: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body: ReqBody = await request.json().catch(() => ({} as ReqBody));
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    // Build document to insert. Allow client to include an `id` (guest migration) but store it as clientId.
    const doc: any = {
      userEmail: session.user.email,
      name: body.name ?? (body.payload?.metadata?.name ?? "Untitled roadmap"),
      skills: Array.isArray(body.skills)
        ? body.skills
        : body.skills
        ? [body.skills]
        : Array.isArray(body.payload?.skills)
        ? body.payload.skills
        : [],
      payload: body.payload ?? body,
      createdAt: body.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (body.id) {
      // keep client's id as clientId for traceability (we won't set _id to a non-ObjectId)
      doc.clientId = String(body.id);
    }

    const client = await clientPromise;
    const db = client.db();
    const col = db.collection("user_roadmaps");

    // If the client provided an id (guest migration), avoid creating duplicates:
    if (doc.clientId) {
      // Use findOneAndUpdate to atomically update and return the document (avoids separate update+fetch)
      const resp = await col.findOneAndUpdate(
        { clientId: doc.clientId, userEmail: session.user.email },
        {
          $set: {
            payload: doc.payload,
            name: doc.name,
            skills: doc.skills,
            updatedAt: doc.updatedAt,
          },
          $setOnInsert: {
            createdAt: doc.createdAt,
            userEmail: session.user.email,
            clientId: doc.clientId,
          },
        },
        { returnDocument: "after", upsert: false }
      );

      // resp.value may be null if no document matched (we use upsert:false intentionally)
      if (resp && resp.value) {
        const updated = resp.value;
        const normalized = { ...updated, id: String(updated._id) };
        return NextResponse.json(normalized, { status: 200 });
      }
      // If no existing document found, fall through to insert below
    }

    const result = await col.insertOne(doc);
    if (!result.insertedId) {
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }

    // Fetch the inserted document back and guard against null
    const inserted = await col.findOne({ _id: result.insertedId });
    if (!inserted) {
      return NextResponse.json(
        { error: "fetch_after_insert_failed", id: String(result.insertedId) },
        { status: 500 }
      );
    }

    const normalized = { ...inserted, id: String(inserted._id) };
    // Return 201 Created with the inserted roadmap (normalized)
    return NextResponse.json(normalized, { status: 201 });
  } catch (err) {
    console.error("POST /api/user/roadmaps error:", err);
    return NextResponse.json({ error: "server_error", details: String(err) }, { status: 500 });
  }
}
