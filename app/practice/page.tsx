// app/practice/page.tsx
import React, { Suspense } from "react";
import PracticeClient from "@/components/PracticeClient";

export const metadata = { title: "Practice", description: "Practice questions" };

export default function PracticePage() {
  return (
    <main className="p-6">
      <h1 className="sr-only">Practice</h1>
      <Suspense fallback={<div>Loading practice UI…</div>}>
        <PracticeClient />
      </Suspense>
    </main>
  );
}
