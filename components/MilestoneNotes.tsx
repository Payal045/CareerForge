"use client";

import { useEffect, useMemo, useState } from "react";
import NotesEditor from "@/components/NotesEditor";

type Note = { _id: string; content: string; milestone?: string; };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

export default function MilestoneNotes({ milestoneLabel }: { milestoneLabel: string }) {
  const milestone = useMemo(() => slugify(milestoneLabel), [milestoneLabel]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");

  async function load() {
    const res = await fetch(`/api/notes?milestone=${encodeURIComponent(milestone)}`);
    const data = await res.json();
    setNotes(data.notes || []);
  }

  useEffect(() => { load(); }, [milestone]);

  async function addNote() {
    const res = await fetch(`/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestone, content: draft }),
    });
    if (res.ok) {
      setDraft("");
      load();
    }
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n._id !== id));
  }

  return (
    <div className="mt-3 border rounded p-3 bg-white">
      <h4 className="font-semibold mb-2">Notes for: <span className="text-gray-600">{milestoneLabel}</span></h4>

      <NotesEditor initialContent={draft} onChange={setDraft} />
      <div className="mt-2">
        <button
          onClick={addNote}
          disabled={!draft}
          className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          Add Note
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {notes.map((n) => (
          <div key={n._id} className="p-3 border rounded bg-gray-50">
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: n.content }} />
            <div className="mt-2">
              <button onClick={() => deleteNote(n._id)} className="px-2 py-1 text-sm bg-red-600 text-white rounded">
                Delete
              </button>
            </div>
          </div>
        ))}
        {notes.length === 0 && <p className="text-sm text-gray-500">No notes yet.</p>}
      </div>
    </div>
  );
}
