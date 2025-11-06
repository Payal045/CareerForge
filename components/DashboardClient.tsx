// components/DashboardClient.tsx  (CLIENT)
"use client";
import React, { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { ArrowRight, Target, Trophy, LogOut, Search, FileText, Home, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import RoadmapClient from "@/components/roadmapClient";
import PracticeSection from "@/components/PracticeSection";

// IMPORTANT: import client-safe hooks (created earlier) from src/hooks
import useRoadmaps from "@/app/api/hooks/useRoadmaps";
import useStreak from "@/app/api/hooks/useStreak";

type RoadmapCard = {
  id: string;
  name: string;
  skills?: string[];
  payload?: any;
};

export default function DashboardClient() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedParam = searchParams?.get?.("selected") ?? null;
  const openPracticeParam = searchParams?.get?.("openPractice") ?? null;

  const { loading: streakLoading, streak, touch, reset } = useStreak();

  const [activeSection, setActiveSection] = useState("home");
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | null>(null);
  const { roadmaps, loading, deleteRoadmap } = useRoadmaps();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedParam && openPracticeParam === "1") {
      setSelectedRoadmap(selectedParam);
      setActiveSection("practice");
      return;
    }
    if (selectedParam) {
      setSelectedRoadmap(selectedParam);
    }
  }, [selectedParam, openPracticeParam]);

  useEffect(() => {
    if (!session?.user) return;
    try {
      const localDate = new Date().toLocaleDateString("en-CA");
      touch?.(localDate).catch((e) => console.warn("streak touch failed:", e));
    } catch (e) {
      const iso = new Date().toISOString().slice(0, 10);
      touch?.(iso).catch(() => {});
    }
  }, [session, touch]);

  const handleContinue = (card: RoadmapCard) => {
    setSelectedRoadmap(card.id);
    setActiveSection("practice");
    const q = new URLSearchParams(window.location.search);
    q.set("selected", String(card.id));
    router.replace(`/dashboard?${q.toString()}`);
  };

  const handleDelete = async (card: RoadmapCard) => {
    const confirm = window.confirm(`Delete roadmap "${card.name}"? This action cannot be undone.`);
    if (!confirm) return;
    setDeletingId(card.id);
    try {
      await deleteRoadmap(card.id);
      if (selectedRoadmap === card.id) {
        setSelectedRoadmap(null);
        setActiveSection("home");
        const q = new URLSearchParams(window.location.search);
        q.delete("selected");
        q.delete("openPractice");
        router.replace(`/dashboard?${q.toString()}`);
      }
    } catch (e) {
      console.error("Failed to delete roadmap:", e);
      alert("Could not delete roadmap. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100 pt-18">
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-8">Welcome, {session?.user?.name ?? "User"}..</h1>

        {activeSection === "home" && (
          <>
            {loading && <p className="mb-4">Loading saved roadmaps...</p>}
            {!loading && roadmaps.length === 0 && <p>No saved roadmaps yet. Generate one to get started.</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roadmaps.map((rm) => {
                const skills = Array.isArray(rm.skills) ? rm.skills : [];
                const isSelected = selectedParam && String(selectedParam) === String(rm.id);
                return (
                  <div key={String(rm.id)} className={`relative bg-white rounded-xl shadow-md p-6 flex flex-col justify-between hover:shadow-xl transition ${isSelected ? "ring-2 ring-indigo-400" : ""}`}>
                    <button onClick={() => handleDelete(rm)} className="absolute top-3 right-3 p-1 rounded-md hover:bg-red-50" title="Delete roadmap" aria-label={`Delete ${rm.name}`}>
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>
                    <h2 className="text-xl font-semibold mb-3">{rm.name}</h2>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {skills.length > 0 ? (
                        skills.slice(0, 8).map((skill, idx) => (
                          <span key={`${rm.id}_${idx}`} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">{skill}</span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No quick-skills listed</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleContinue(rm)} className="mt-auto flex items-center justify-between w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeSection === "roadmap" && (
          // RoadmapClient uses client hooks; it's safe inside the client component
          <RoadmapClient />
        )}

        {activeSection === "notes" && (
          <div>
            <p>Notes are at <a href="/notes" className="text-blue-600 hover:underline">/notes</a>. Click to open.</p>
          </div>
        )}

        {activeSection === "practice" && <PracticeSection roadmapId={selectedRoadmap} />}
      </main>
    </div>
  );
}
