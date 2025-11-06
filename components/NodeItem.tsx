// components/NodeItem.tsx
"use client";
import React from "react";
import type { RoadmapNode } from "../data/roadmap.sample";

type Props = {
  node: RoadmapNode & { mastery?: number };
  onClick: (node: RoadmapNode) => void;
};

export default function NodeItem({ node, onClick }: Props) {
  return (
    <div
      role="button"
      onClick={() => onClick(node)}
      className={`p-2 rounded-md border cursor-pointer transition-shadow flex flex-col gap-1 min-w-0
        ${node.unlocked ? "bg-white hover:shadow-md" : "bg-gray-50 opacity-60 cursor-not-allowed"}
      `}
      aria-disabled={!node.unlocked}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm truncate">{node.title}</h4>
        {/* mastery/XP removed as requested */}
      </div>
      <div className="text-xs text-gray-500 truncate">{node.short}</div>
    </div>
  );
}
