"use client";

import { useState, useEffect, useRef } from "react";
import NotesEditor, { NotesEditorRef } from "./NotesEditor";

type NotesManagerProps = {
  milestone: string;
};

type NoteShape = {
  _id: string;
  milestone: string;
  content: string;
  createdAt?: string;
  userId?: string;
};

export default function NotesManager({ milestone }: NotesManagerProps) {
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState<NoteShape[]>([]);
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<NotesEditorRef>(null);

  async function fetchNotes() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set("milestone", milestone);
      const res = await fetch(`/api/notes?${q.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch notes");
      const data = await res.json();
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } catch (err) {
      console.error("fetchNotes error", err);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!milestone) return;
    fetchNotes();
  }, [milestone]);

  async function saveNote() {
    if (!content.trim()) return;
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestone, content }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      setContent("");
      editorRef.current?.clear();
      await fetchNotes();
    } catch (err) {
      console.error("Failed to save note", err);
      alert("Failed to save note. See console.");
    }
  }

  async function deleteNote(id: string) {
    if (!id) return;
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete note");
      await fetchNotes();
    } catch (err) {
      console.error("Failed to delete note", err);
      alert("Failed to delete note. See console.");
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow">
      <h3 className="font-semibold mb-2 flex justify-between items-center">
        Your notes:
        <button
          onClick={saveNote}
          disabled={!content.trim()}
          className="ml-4 px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
        >
          ➕ Add Note
        </button>
      </h3>

      {/* ✅ Clear visible hint above the editor, not overlapping toolbar */}
      {!content.trim() && (
        <p className="text-gray-400 text-sm mb-2 italic">
          ✏️ Write your notes below...
        </p>
      )}

      <NotesEditor
        ref={editorRef}
        initialContent={content}
        onChange={setContent}
      />

      <div className="mt-4 space-y-2">
        {loading && <p>Loading...</p>}
        {!loading && notes.length === 0 && (
          <div className="text-sm text-gray-500">No notes yet.</div>
        )}
        {notes.map((note) => (
          <div
            key={note._id}
            className="p-2 border rounded bg-gray-50 flex justify-between items-start"
          >
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: note.content }}
            />
            <button
              onClick={() => deleteNote(note._id)}
              className="ml-2 text-red-500 hover:text-red-700 text-sm"
            >
              ✖
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
