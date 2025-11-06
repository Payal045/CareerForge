// app/dashboard/page.tsx  (SERVER - recommended)
import React, { Suspense } from "react";
import DashboardClient from "@/components/DashboardClient"; // must be "use client" file

export const metadata = { title: "Dashboard", description: "Your saved roadmaps" };

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen bg-gray-100 pt-18">
      <div className="w-full max-w-[1400px] mx-auto">
        <Suspense fallback={<div className="p-8">Loading dashboard…</div>}>
          <DashboardClient />
        </Suspense>
      </div>
    </main>
  );
}
