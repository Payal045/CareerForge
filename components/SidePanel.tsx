// components/SidePanel.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { X, Loader2, Play } from "lucide-react";
import type { RoadmapNode } from "../data/roadmap.sample";
import { generateTheoryOverview } from "../lib/theory";

type VideoItem = { title: string; url: string };
type ProgressShape = Record<string, Record<string, { mastery?: number }>>;

type Props = {
  node?: RoadmapNode | null;
  progress?: ProgressShape | null;
  onPracticeSelect: (nodeId: string, type: string) => void;
  onClose?: () => void;
  onAddNotes?: (nodeId: string) => void;
};

function enrichOverviewHtml(title: string, videoTitles: string[] = []): string {
  // Always use generateTheoryOverview as the source of truth.
  // Provide video titles as context in the heading so the generator can incorporate them.
  const seed = videoTitles.length ? `${title} — ${videoTitles.slice(0, 5).join(", ")}` : title;
  return generateTheoryOverview(seed);
}

export default function SidePanel({ node, progress, onPracticeSelect, onClose, onAddNotes }: Props) {
  const [videos, setVideos] = useState<VideoItem[] | null>(null);
  const [theoryHtml, setTheoryHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchControllerRef = useRef<AbortController | null>(null);
  const cacheKey = node ? `resources::${encodeURIComponent(node.title)}` : null;

  useEffect(() => {
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
      fetchControllerRef.current = null;
    }

    if (!node) {
      setVideos(null);
      setTheoryHtml(null);
      setError(null);
      setLoading(false);
      return;
    }

    // 1) Immediate deterministic theory HTML (never raw titles)
    const immediate = enrichOverviewHtml(node.title, []);
    setTheoryHtml(immediate);

    // 2) Read cache (defensive)
    if (typeof window !== "undefined" && cacheKey) {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            // legacy cached array -> treat it as videos only, NOT as theory
            setVideos(parsed as VideoItem[]);
            // regenerate theory properly (do NOT use parsed.join or similar)
            const regenerated = enrichOverviewHtml(node.title, (parsed as VideoItem[]).map(v => v.title));
            setTheoryHtml(regenerated);
            console.debug("SidePanel: legacy cache (array) - regenerated theory HTML");
          } else if (parsed && typeof parsed === "object") {
            setVideos(Array.isArray(parsed.videos) ? parsed.videos : []);
            if (parsed.overview && typeof parsed.overview === "string" && parsed.overview.trim()) {
              // prefer cached overview (but ensure it's a string)
              setTheoryHtml(String(parsed.overview));
              console.debug("SidePanel: loaded overview from cache");
            } else {
              const regen = enrichOverviewHtml(node.title, (parsed.videos ?? []).map((v: any) => String(v.title ?? "")));
              setTheoryHtml(regen);
              console.debug("SidePanel: cached object had no overview - regenerated");
            }
          }
        }
      } catch (e) {
        console.warn("SidePanel: failed to parse cache:", e);
      }
    }

    // 3) Fetch videos, then enrich & persist properly
    (async () => {
      setLoading(true);
      setError(null);
      const ac = new AbortController();
      fetchControllerRef.current = ac;
      try {
        const res = await fetch(`/api/resources?query=${encodeURIComponent(node.title)}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`resources fetch failed ${res.status}`);
        const json = await res.json();
        const items: VideoItem[] = (json?.resources ?? []).map((r: any) => ({
          title: String(r.title ?? r.snippet ?? ""),
          url: String(r.url ?? r.videoUrl ?? "")
        }));
        setVideos(items);

        // produce enriched HTML **only** via generator
        const enriched = enrichOverviewHtml(node.title, items.map(i => i.title));
        setTheoryHtml(enriched);

        try {
          sessionStorage.setItem(cacheKey!, JSON.stringify({ videos: items, overview: enriched }));
        } catch (e) {
          console.warn("SidePanel: failed to persist cache", e);
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          // ignore
        } else {
          console.error("SidePanel: failed to fetch resources", err);
          setError("Failed to load learning resources.");
          setVideos([]);
        }
      } finally {
        setLoading(false);
        fetchControllerRef.current = null;
      }
    })();

    return () => {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
        fetchControllerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.title]);

  if (!node) return <div className="p-4 text-sm text-gray-500">Select a topic to view resources, theory and practice.</div>;

  const nodeProgress = progress?.[node.id] ?? {};
  const types = ["mcq","multiselect","short","long","coding"];

  return (
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold">{node.title}</h3>
          <div className="text-xs text-gray-500">{node.mastery ?? 0}% mastery</div>
        </div>
        {onClose && <button onClick={onClose} className="text-sm text-gray-600 p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>}
      </div>

      <div className="mt-3 flex gap-2 flex-wrap">
        {types.map(t => {
          const m = nodeProgress?.[t]?.mastery ?? null;
          return (
            <div key={t} className="px-2 py-1 rounded-full text-xs border bg-gray-50 flex items-center gap-2">
              <span className="font-medium">{t.toUpperCase()}</span>
              <span className="text-xs text-gray-600">{m != null ? `${m}%` : "—"}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="text-sm font-medium mb-2">🎬 Videos</div>
        <div className="space-y-2">
          {loading && <div className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="w-4 h-4 animate-spin" />Loading videos...</div>}
          {!loading && error && <div className="text-sm text-red-600">{error}</div>}
          {!loading && Array.isArray(videos) && videos.length === 0 && <div className="text-sm text-gray-500">No videos found.</div>}
          {!loading && Array.isArray(videos) && videos.map((v, idx) => (
            <a key={idx} href={v.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 p-2 border rounded hover:bg-gray-50">
              <Play className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium truncate max-w-[220px]">{v.title}</div>
                <div className="text-xs text-gray-500 truncate max-w-[220px]">{v.url}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">AI Overview</span>
          <div className="text-xs text-gray-500">Concise study plan generated for this topic</div>
        </div>

        <div className="prose prose-sm max-h-48 overflow-auto text-sm text-gray-700 p-3 border rounded" dangerouslySetInnerHTML={{ __html: theoryHtml ?? generateTheoryOverview(node.title) }} />
      </div>

      <div className="mt-4">
        <div className="text-xs text-gray-500 mb-2">Practice</div>
        <div className="flex gap-2 flex-wrap">
          {types.map(t => <button key={t} onClick={() => onPracticeSelect(node.id, t)} className="px-3 py-1 rounded-md border text-sm bg-indigo-50 hover:bg-indigo-100">{t.toUpperCase()}</button>)}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => onAddNotes?.(node.id)} className="px-3 py-2 rounded bg-indigo-600 text-white">＋ Add Notes</button>
        <div className="text-xs text-gray-500">Save private notes for this subtopic.</div>
      </div>
    </div>
  );
}
