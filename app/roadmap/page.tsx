// app/roadmap/page.tsx
import React, { Suspense } from "react";
import RoadmapClient from "../../components/roadmapClient"; // keep exact-case path
export const metadata = {
  title: "Roadmap",
  description: "Generate and save custom career roadmaps",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">Roadmap</h1>

        {/* IMPORTANT: Wrap the client component that uses next/navigation hooks in Suspense */}
        <Suspense fallback={<div className="p-4">Loading roadmap UI…</div>}>
          <RoadmapClient />
        </Suspense>
      </div>
    </main>
  );
}
