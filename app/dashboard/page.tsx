// app/dashboard/page.tsx  (SERVER)
import React, { Suspense } from "react";
import DashboardClient from "@/components/DashboardClient"; // client component (must start with "use client")

export const metadata = { title: "Dashboard", description: "Your saved roadmaps" };

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen bg-gray-100 pt-18">
      <div className="w-full">
        {/* Server-safe wrapper: Suspense ensures client hooks run only on the client */}
        <Suspense fallback={<div className="p-8">Loading dashboard…</div>}>
          <DashboardClient />
        </Suspense>
      </div>
    </main>
  );
}
