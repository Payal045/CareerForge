"use client";

import { useState, useEffect } from "react";

export function useNote(milestoneId: string) {
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    async function fetchNote() {
      const res = await fetch(`/api/notes/${milestoneId}`);
      if (res.ok) {
        const data = await res.json();
        setNote(data?.content || "");
      }
    }
    fetchNote();
  }, [milestoneId]);

  async function saveNote(content: string) {
    setNote(content);
    await fetch(`/api/notes/${milestoneId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }

  return { note, saveNote };
}
