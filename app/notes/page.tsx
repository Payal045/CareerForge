"use client";

import { useParams } from "next/navigation";
import NotesManager from "@/components/NotesManager";

export default function NotesPage() {
  const params = useParams();
  const milestone = decodeURIComponent(params.milestone as string);

  return (
    <div className="max-w-2xl mx-auto mt-6">
      <NotesManager milestone={milestone} />
    </div>
  );
}
