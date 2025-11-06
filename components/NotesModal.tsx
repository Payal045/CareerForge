// components/NotesModal.tsx
"use client";
import React from "react";
import NotesManager from "./NotesManager";

type Props = {
  nodeId: string;
  onClose: () => void;
};

export default function NotesModal({ nodeId, onClose }: Props) {
  // Use nodeId as the "milestone" key in NotesManager (it already filters by milestone)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-11/12 md:w-3/4 lg:w-2/3 bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Notes for this subtopic</h3>
          <button onClick={onClose} className="px-3 py-1 rounded border bg-gray-100">Close</button>
        </div>

        <div className="p-4">
          <NotesManager milestone={nodeId} />
        </div>
      </div>
    </div>
  );
}
