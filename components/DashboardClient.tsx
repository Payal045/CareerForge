"use client";
import React, { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  ArrowRight,
  Target,
  Trophy,
  LogOut,
  Search,
  FileText,
  Home,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import RoadmapClient from "@/components/roadmapClient";
import PracticeSection from "@/components/PracticeSection";
import NotesManager from "@/components/NotesManager";

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

  // ✅ Detect guest vs authenticated user
  function looksLikeGuestEmail(email?: string | null) {
    if (!email) return false;
    const lowered = email.toLowerCase().trim();
    return (
      lowered.startsWith("guest@") ||
      lowered.endsWith("@careerforge.local") ||
      lowered.includes("guestuser")
    );
  }

  const isGuest =
    !!session?.user?.isGuest || looksLikeGuestEmail(session?.user?.email ?? null);
  const isAuthed = !!session?.user?.email && !isGuest;

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
    if (!isAuthed) return;
    try {
      const localDate = new Date().toLocaleDateString("en-CA");
      touch?.(localDate).catch((e) => console.warn("streak touch failed:", e));
    } catch (e) {
      const iso = new Date().toISOString().slice(0, 10);
      touch?.(iso).catch(() => {});
    }
  }, [isAuthed, touch]);

  const handleContinue = (card: RoadmapCard) => {
    setSelectedRoadmap(card.id);
    setActiveSection("practice");

    const q = new URLSearchParams(window.location.search);
    q.set("selected", String(card.id));
    router.replace(`/dashboard?${q.toString()}`);
  };

  const handleDelete = async (card: RoadmapCard) => {
    const confirm = window.confirm(
      `Delete roadmap "${card.name}"? This action cannot be undone.`
    );
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
    <div className="flex min-h-screen bg-gray-100">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">CareerForge</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {session?.user ? (
              <div className="flex items-center gap-4">
                <span
                  className="text-sm text-gray-600 truncate max-w-[150px]"
                  title={session.user.email ?? undefined}
                >
                  {session.user.email}
                </span>

                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all hover:shadow-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/auth/signin")}
                  className="px-6 py-2 text-gray-700 hover:text-gray-900 transition-colors font-medium"
                >
                  Sign In
                </button>
                <button
                  onClick={() => router.push("/auth/signup")}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:shadow-lg"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <aside className="w-64 bg-white shadow-lg p-6 flex flex-col gap-6">
        {/* ✅ Streak visible only for authenticated non-guest users */}
        {isAuthed && (
          <div className="flex items-center gap-2 p-2 hover:bg-gray-200 rounded-lg cursor-pointer transition">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <div>
              <div className="text-sm">Streak</div>
              <div className="text-lg font-semibold">
                {streakLoading ? (
                  <div className="text-sm text-gray-500 mt-1">Loading...</div>
                ) : (
                  <div className="flex items-center gap-2 mt-1 bg-yellow-50 px-2 py-1 rounded-lg">
                    <span className="text-lg font-bold text-yellow-700">
                      {streak}
                    </span>
                    <span className="text-xl">🔥</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div
          onClick={() => setActiveSection("home")}
          className="flex items-center gap-2 p-2 hover:bg-gray-200 rounded-lg cursor-pointer transition"
        >
          <Home className="w-5 h-5 text-red-500" />
          <span>Home</span>
        </div>

        <div
          onClick={() => setActiveSection("roadmap")}
          className="flex items-center gap-2 p-2 hover:bg-gray-200 rounded-lg cursor-pointer transition"
        >
          <Search className="w-5 h-5 text-green-500" />
          <span>Search Roadmap</span>
        </div>

        <div
          onClick={() => setActiveSection("notes")}
          className="flex items-center gap-2 p-2 hover:bg-gray-200 rounded-lg cursor-pointer transition"
        >
          <FileText className="w-5 h-5 text-purple-500" />
          <span>Your Notes</span>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-8">
          Welcome, {session?.user?.name ?? "User"}..
        </h1>

        {activeSection === "home" && (
          <>
            {loading && <p className="mb-4">Loading saved roadmaps...</p>}
            {!loading && roadmaps.length === 0 && (
              <p>No saved roadmaps yet. Generate one to get started.</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roadmaps.map((rm) => {
                const skills = Array.isArray(rm.skills) ? rm.skills : [];
                const progressObj = rm.payload?.progress ?? {};
                const typeList = ["mcq", "multiselect", "short", "long", "coding"];
                const typeSummary: Record<string, number | null> = {};
                typeList.forEach((t) => {
                  const vals: number[] = [];
                  for (const nodeId of Object.keys(progressObj || {})) {
                    const v = progressObj?.[nodeId]?.[t]?.mastery;
                    if (typeof v === "number") vals.push(v);
                  }
                  typeSummary[t] = vals.length
                    ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
                    : null;
                });

                const isSelected =
                  selectedParam && String(selectedParam) === String(rm.id);

                return (
                  <div
                    key={String(rm.id)}
                    className={`relative bg-white rounded-xl shadow-md p-6 flex flex-col justify-between hover:shadow-xl transition ${
                      isSelected ? "ring-2 ring-indigo-400" : ""
                    }`}
                  >
                    <button
                      onClick={() => handleDelete(rm)}
                      className="absolute top-3 right-3 p-1 rounded-md hover:bg-red-50"
                      title="Delete roadmap"
                      aria-label={`Delete ${rm.name}`}
                    >
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>

                    <h2 className="text-xl font-semibold mb-3">{rm.name}</h2>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {skills.length > 0 ? (
                        skills.slice(0, 8).map((skill, idx) => (
                          <span
                            key={`${rm.id}_${idx}`}
                            className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">
                          No quick-skills listed
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleContinue(rm)}
                        className="mt-auto flex items-center justify-between w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                      >
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

        {activeSection === "roadmap" && <RoadmapClient />}

        {activeSection === "notes" && (
          <div className="space-y-4">
            <NotesManager milestone={selectedRoadmap ?? ""} />
          </div>
        )}

        {activeSection === "practice" && (
          <PracticeSection roadmapId={selectedRoadmap} />
        )}
      </main>
    </div>
  );
}
