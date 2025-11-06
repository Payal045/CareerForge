// components/PracticeSection.tsx
"use client";
import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useRoadmaps from "@/app/api/hooks/useRoadmaps";
import NodeItem from "./NodeItem";
import NotesModal from "./NotesModal";
import type { Roadmap } from "@/lib/types";
import { generateTheoryOverview } from "@/lib/theory"; // <-- ADDED

type Props = { roadmapId?: string | null };

type RoadmapNodeLocal = {
  id: string;
  title: string;
  short: string;
  theory: string;
  mastery?: number;
  unlocked: boolean;
  phaseIndex: number;
  phaseName: string;
};

type ResourceEntry = {
  loading: boolean;
  videos: { title: string; url: string }[];
  snippet?: string;
  error?: string | null;
};

export default function PracticeSection({ roadmapId: propRoadmapId = null }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedParam = searchParams?.get?.("selected") ?? null;
  const roadmapNameParam = searchParams?.get?.("roadmapName") ?? null;

  const { roadmaps, loading } = useRoadmaps();
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [resourcesCache, setResourcesCache] = useState<Record<string, ResourceEntry>>({});
  const [generatingNode, setGeneratingNode] = useState<string | null>(null);
  const [notesModalNode, setNotesModalNode] = useState<string | null>(null);
  const [completedNodes, setCompletedNodes] = useState<Record<string, boolean>>({});

  const effectiveSelected = propRoadmapId ?? selectedParam;

  const roadmap: Roadmap | null = useMemo(() => {
    if (!roadmaps || roadmaps.length === 0) return null;
    if (effectiveSelected) {
      return roadmaps.find((r) => String(r.id) === String(effectiveSelected)) ?? null;
    }
    if (roadmapNameParam) {
      return roadmaps.find((r) => String(r.name) === String(roadmapNameParam)) ?? null;
    }
    return null;
  }, [roadmaps, effectiveSelected, roadmapNameParam]);

  useEffect(() => {
    if (!roadmap) return;
    try {
      const key = `careerforge_completed_${roadmap.id}`;
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (raw) {
        const arr = JSON.parse(raw);
        const map: Record<string, boolean> = {};
        if (Array.isArray(arr)) arr.forEach((id) => (map[id] = true));
        setCompletedNodes(map);
        return;
      }
    } catch (e) {
      // ignore
    }
    setCompletedNodes({});
  }, [roadmap?.id]);

  useEffect(() => {
    if (!roadmap) return;
    try {
      const key = `careerforge_completed_${roadmap.id}`;
      const arr = Object.keys(completedNodes).filter((k) => completedNodes[k]);
      window.localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
      // ignore
    }
  }, [completedNodes, roadmap?.id]);

  const phasesArray: any[] = useMemo(() => {
    if (!roadmap) return [];

    const rawRoadmap = roadmap.payload?.roadmap;

    if (Array.isArray(rawRoadmap)) {
      const looksLikePhaseObj =
        rawRoadmap.length > 0 &&
        typeof rawRoadmap[0] === "object" &&
        (rawRoadmap[0].phase || rawRoadmap[0].name || rawRoadmap[0].skills);
      return looksLikePhaseObj ? rawRoadmap : [{ phase: "Phase 1", skills: rawRoadmap }];
    }

    if (rawRoadmap && typeof rawRoadmap === "object" && Array.isArray((rawRoadmap as any).phases)) {
      return (rawRoadmap as any).phases;
    }

    const fallback = roadmap.payload ?? {};
    if (fallback && typeof fallback === "object" && Array.isArray((fallback as any).phases)) {
      return (fallback as any).phases;
    }

    return [];
  }, [roadmap]);

  const nodesMap: RoadmapNodeLocal[][] = useMemo(() => {
    if (!roadmap) return [];
    const rawResources = roadmap.payload?.resources ?? {};
    const resourcesMap: Record<string, any[]> = {};
    if (rawResources && typeof rawResources === "object" && !Array.isArray(rawResources)) {
      for (const k of Object.keys(rawResources)) {
        const v = rawResources[k];
        if (Array.isArray(v)) resourcesMap[k] = v;
        else if (v) resourcesMap[k] = [v];
      }
    }

    const progressObj = roadmap.payload?.progress ?? {};

    // helper: very small heuristic to decide if a string looks like a real overview
    const looksLikeOverview = (s: any) =>
      typeof s === "string" && (s.length > 80 || /[.?!]/.test(s));

    return phasesArray.map((phaseObj: any, pIdx: number) => {
      const phaseName = phaseObj?.phase ?? phaseObj?.name ?? `Phase ${pIdx + 1}`;
      const skillsList = Array.isArray(phaseObj?.skills)
        ? phaseObj.skills
        : Array.isArray(phaseObj?.milestones)
        ? phaseObj.milestones
        : phaseObj?.items ?? [];
      const finalSkills = Array.isArray(skillsList) ? skillsList : [];
      return finalSkills.map((skill: any, sIdx: number) => {
        const skillStr = typeof skill === "string" ? skill : String(skill?.title ?? skill?.name ?? JSON.stringify(skill));
        const id = `${roadmap.id}::${pIdx}::${sIdx}`;
        const resForSkill = resourcesMap[skillStr] ?? [];

        // NEW: only use a resource-provided snippet/overview if it LOOKS like an overview.
        const candidate = resForSkill.length > 0 ? (resForSkill[0].snippet ?? resForSkill[0].overview ?? "") : "";
        const theory = looksLikeOverview(candidate) ? candidate : generateTheoryOverview(skillStr);

        let mastery: number | undefined = undefined;
        const nodeProgress = (progressObj && progressObj[id]) || {};
        if (nodeProgress && typeof nodeProgress === "object") {
          const vals = Object.values(nodeProgress)
            .map((v: any) => (v && typeof v.mastery === "number" ? v.mastery : null))
            .filter((v: any) => typeof v === "number") as number[];
          if (vals.length > 0) mastery = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        }

        return {
          id,
          title: skillStr,
          short: skillStr.length > 80 ? skillStr.slice(0, 77) + "..." : skillStr,
          theory,
          mastery: mastery ?? 0,
          unlocked: true,
          phaseIndex: pIdx,
          phaseName,
        } as RoadmapNodeLocal;
      });
    });
  }, [phasesArray, roadmap]);

  const togglePhase = (idx: number) => setExpandedPhases((s) => ({ ...s, [idx]: !s[idx] }));
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((s) => ({ ...s, [nodeId]: !s[nodeId] }));
    const entry = resourcesCache[nodeId];
    const hasVideos = !!(entry && entry.videos && entry.videos.length > 0);
    const isLoading = entry?.loading === true;
    if (!entry || (!isLoading && !hasVideos && !entry?.snippet)) fetchResourcesForNode(nodeId);
  };

  const fetchResourcesForNode = async (nodeId: string) => {
    if (!roadmap) return;
    const node = nodesMap.flat().find((n) => n.id === nodeId);
    if (!node) return;
    setResourcesCache((prev) => ({ ...prev, [nodeId]: { loading: true, videos: [], snippet: undefined } }));
    try {
      const q = encodeURIComponent(node.title);
      const res = await fetch(`/api/resources?query=${q}`);
      if (!res.ok) {
        setResourcesCache((prev) => ({ ...prev, [nodeId]: { loading: false, videos: [], snippet: undefined, error: `fetch ${res.status}` } }));
        return;
      }
      const json = await res.json();
      const apiResources = (json?.resources ?? []).slice(0, 3);

      // videos array: only title + url
      const vids = apiResources.map((v: any) => ({ title: v.title || "", url: v.url || "" }));

      // Only use snippet if it appears to be a real summary (longer than ~40 chars)
      const rawSnippet = apiResources[0]?.snippet ?? apiResources[0]?.overview ?? "";
      const snippet = typeof rawSnippet === "string" && rawSnippet.length > 40 ? rawSnippet : undefined;

      setResourcesCache((prev) => ({ ...prev, [nodeId]: { loading: false, videos: vids, snippet: snippet ?? undefined, error: null } }));
    } catch (err: any) {
      setResourcesCache((prev) => ({ ...prev, [nodeId]: { loading: false, videos: [], snippet: undefined, error: String(err?.message ?? err) } }));
    }
  };

  const onPracticeSelect = async (nodeId: string, type: string) => {
    if (!roadmap) {
      alert("No roadmap selected.");
      return;
    }
    setGeneratingNode(nodeId);
    try {
      const cached = resourcesCache[nodeId];
      const node = nodesMap.flat().find((n) => n.id === nodeId);
      const textToSend = (cached?.snippet && String(cached.snippet).replace(/<[^>]+>/g, " ")) || String(node?.theory ?? node?.title ?? nodeId);
      const resp = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, text: textToSend, types: [type], count: 6, difficulty: "medium" }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`Generator failed: ${resp.status} ${txt}`);
      }
      const json = await resp.json();
      const key = `careerforge_practice_${Date.now()}`;
      try {
        sessionStorage.setItem(key, JSON.stringify(json));
      } catch (e) {
        console.warn(e);
      }
      const q = new URLSearchParams();
      q.set("practiceKey", key);
      q.set("nodeId", nodeId);
      q.set("type", type);
      if (roadmap) q.set("roadmapId", String(roadmap.id));
      if (roadmap?.name) q.set("roadmapName", roadmap.name);
      router.push(`/practice?${q.toString()}`);
    } catch (err) {
      console.error("Practice generation failed:", err);
      alert("Could not generate practice questions. Try again.");
    } finally {
      setGeneratingNode(null);
    }
  };

  const openNotes = (nodeId: string) => setNotesModalNode(nodeId);
  const closeNotes = () => setNotesModalNode(null);

  const toggleCompleteNode = (nodeId: string) => {
    setCompletedNodes((prev) => {
      const next = { ...prev, [nodeId]: !prev[nodeId] };
      if (!next[nodeId]) delete next[nodeId];
      return next;
    });
  };

  const displayPercentForNode = (node: RoadmapNodeLocal) => {
    if (completedNodes[node.id]) return 100;
    return typeof node.mastery === "number" ? node.mastery : 0;
  };

  const phasePercent = (nodes: RoadmapNodeLocal[]) => {
    if (!nodes || nodes.length === 0) return 0;
    const vals = nodes.map((n) => displayPercentForNode(n));
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  if (loading) return <div className="p-6">Loading roadmap...</div>;
  if (!roadmap) return <div className="p-6">No roadmap selected. Open a roadmap from Dashboard first.</div>;

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-bold">Practice — {roadmap.name}</h2>

      {nodesMap.map((phaseNodes, pIdx) => {
        const rawPhaseName = phaseNodes[0]?.phaseName ?? `Phase ${pIdx + 1}`;
        const phaseStartsWithPhase = /^\s*Phase\s*\d+/i.test(String(rawPhaseName));

        return (
          <div key={`phase-${pIdx}`} className="bg-white rounded shadow-sm overflow-hidden">
            <button onClick={() => togglePhase(pIdx)} className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50">
              <div>
                {phaseStartsWithPhase ? (
                  <div className="font-semibold">{rawPhaseName}</div>
                ) : (
                  <>
                    <div className="text-sm text-gray-500">Phase {pIdx + 1}</div>
                    <div className="font-semibold">{rawPhaseName}</div>
                  </>
                )}
              </div>
              <div className="text-sm text-gray-500 flex items-center gap-3">
                <div className="text-xs text-gray-400">{phaseNodes.length} topics</div>
                <div className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">{phasePercent(phaseNodes)}%</div>
              </div>
            </button>

            {expandedPhases[pIdx] && (
              <div className="divide-y">
                {phaseNodes.map((node) => {
                  const expanded = !!expandedNodes[node.id];
                  const cached = resourcesCache[node.id];
                  const percent = displayPercentForNode(node);
                  return (
                    <div key={node.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* checkbox + node item */}
                          <div className="flex items-start gap-3">
                            <input
                              id={`chk_${node.id}`}
                              type="checkbox"
                              checked={!!completedNodes[node.id]}
                              onChange={() => toggleCompleteNode(node.id)}
                              className="w-5 h-5 mt-1 rounded border-gray-300"
                              aria-label={`Mark ${node.title} complete`}
                            />
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-medium truncate">{node.title}</div>
                              {/* NOTE: percentage removed from subtopic row as requested */}
                            </div>
                            <div className="text-xs text-gray-500 truncate">{node.short}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {((roadmap.payload?.progress ?? {})[node.id]?.mcq?.mastery ?? null) != null && (
                            <div className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">{`MCQ ${((roadmap.payload?.progress ?? {})[node.id]?.mcq?.mastery ?? 0)}%`}</div>
                          )}
                          <button onClick={() => toggleNode(node.id)} className="px-2 py-1 rounded border text-sm bg-white hover:bg-gray-50" title={expanded ? "Collapse" : "Expand"}>{expanded ? "▲" : "▼"}</button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="mt-3 border-t pt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 text-sm text-gray-700 leading-relaxed">
                            {cached?.loading ? <div className="text-xs text-gray-500">Loading resources...</div> : cached?.error ? <div className="text-xs text-rose-600">Error: {cached.error}</div> : <div dangerouslySetInnerHTML={{ __html: cached?.snippet ?? node.theory }} />}
                            <div className="mt-3 flex items-center gap-3">
                              <button onClick={() => openNotes(node.id)} className="px-3 py-2 rounded bg-indigo-600 text-white flex items-center gap-2">
                                <span className="text-lg">＋</span> Add Notes
                              </button>
                              <div className="text-xs text-gray-500">You can save private notes for this subtopic.</div>
                            </div>
                          </div>

                          <aside className="md:col-span-1 space-y-3">
                            <div>
                              <div className="text-sm font-medium mb-2">Videos</div>
                              <div className="flex flex-col gap-2">
                                {(cached?.videos ?? []).length > 0 ? (cached!.videos.map((v, i) => <a key={i} href={v.url} target="_blank" rel="noreferrer" className="text-sm px-3 py-2 border rounded hover:bg-gray-50">▶ {v.title.length > 48 ? v.title.slice(0, 45) + "..." : v.title}</a>)) : <div className="text-xs text-gray-400">No video results</div>}
                              </div>
                            </div>

                            <div>
                              <div className="text-sm font-medium mb-2">Practice</div>
                              <div className="flex gap-2 flex-wrap">
                                {["mcq","multiselect","short","long"].map((t) => (
                                  <button key={t} onClick={() => onPracticeSelect(node.id, t)} disabled={generatingNode === node.id} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
                                    {generatingNode === node.id ? "Generating..." : t.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </aside>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-4">
        <button onClick={() => { if (roadmap?.id) router.push(`/dashboard?selected=${encodeURIComponent(String(roadmap.id))}`); else router.back(); }} className="px-3 py-2 rounded border bg-gray-100">← Back to Roadmap</button>
      </div>

      {notesModalNode && <NotesModal nodeId={notesModalNode} onClose={closeNotes} />}
    </div>
  );
}
