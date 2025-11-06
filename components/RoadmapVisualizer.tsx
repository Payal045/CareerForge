// components/RoadmapVisualizer.tsx
"use client";

import React, { useState } from "react";
import NodeItem from "./NodeItem";
import SidePanel from "./SidePanel";
import type { RoadmapNode } from "../data/roadmap.sample";
import { useRouter } from "next/navigation";
import { fetchQuestions } from "@/lib/apii";

type Props = {
  roadmap: RoadmapNode[]; // static JSON or fetched data
  onPracticeNavigate?: (nodeId: string, type: string) => void; // optional callback (preferred)
  columns?: number; // grid columns for layout
};

type Question = {
  id: string;
  nodeId: string;
  type: "mcq" | "multiselect" | "short" | "long" | "coding" | string;
  stem: string;
  options?: string[] | null;
  answer?: string | string[] | null;
  explanation?: string;
  difficulty?: string;
  metadata?: any;
};

export default function RoadmapVisualizer({
  roadmap,
  onPracticeNavigate,
  columns = 2,
}: Props) {
  const [activeNode, setActiveNode] = useState<RoadmapNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePractice, setActivePractice] = useState<{
    nodeId: string;
    type: string;
    questions: Question[];
    progress: number;
  } | null>(null);

  const router = useRouter();

  function handleNodeClick(node: RoadmapNode) {
    if (!node.unlocked) {
      // quick feedback if locked
      setActiveNode(null);
      return;
    }
    setActiveNode(node);
  }

  // Called by SidePanel when user clicks a practice button
  async function handlePractice(nodeId: string, type: string) {
    if (onPracticeNavigate) return onPracticeNavigate(nodeId, type);

    // fallback: load questions into the side panel
    try {
      setLoading(true);
      // find theory text from roadmap data
      const node = roadmap.find((r) => r.id === nodeId);
      const text = node?.theory ?? "No theory provided";

      // fetch generated questions from server
      const questions = await fetchQuestions(nodeId, type, text);

      // normalize answer formats if needed (openrouter might give arrays or text)
      const normalized: Question[] = (questions || []).map((q: any, i: number) => ({
        id: q.id ?? `${nodeId}_${Date.now()}_${i}`,
        nodeId,
        type: q.type ?? (q.options ? "mcq" : "short"),
        stem: q.stem ?? q.question ?? q.title ?? "",
        options: q.options ?? null,
        answer: q.answer ?? null,
        explanation: q.explanation ?? "",
        difficulty: q.difficulty ?? "medium",
        metadata: q.metadata ?? {},
      }));

      setActivePractice({
        nodeId,
        type,
        questions: normalized,
        progress: 0,
      });

      // set active node panel for UX
      const nodeObj = roadmap.find((r) => r.id === nodeId) ?? null;
      setActiveNode(nodeObj);
    } catch (err: any) {
      console.error("Failed to load questions:", err);
      alert("Failed to generate questions: " + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  // dynamic grid using inline style to avoid Tailwind dynamic-class issues
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))`,
    gap: "1rem",
    flex: 1,
  };

  return (
    <div className="flex gap-6">
      <div style={gridStyle}>
        {roadmap.map((n) => (
          <div key={n.id} className="relative">
            {/* connector line (minimal visual) */}
            <div
              style={{
                position: "absolute",
                left: 12,
                top: -6,
                bottom: 0,
                width: 1,
                backgroundColor: "rgba(229,231,235,0.8)", // gray-200
              }}
              aria-hidden
            />
            <NodeItem node={n} onClick={handleNodeClick} />
          </div>
        ))}
      </div>

      <div className="w-96 bg-white border rounded-md shadow-sm">
        {/* If a practice session is active, render the PracticeRunner; otherwise show SidePanel */}
        {activePractice ? (
          <PracticeRunner
            key={activePractice.nodeId + "-" + activePractice.type}
            session={activePractice}
            onClose={() => {
              setActivePractice(null);
              setActiveNode(null);
            }}
            onUpdateProgress={(p) =>
              setActivePractice((s) => (s ? { ...s, progress: p } : s))
            }
          />
        ) : (
          <SidePanel
            node={activeNode}
            onPracticeSelect={(nid, t) => handlePractice(nid, t)}
            onClose={() => setActiveNode(null)}
          />
        )}

        {loading && (
          <div className="p-2 text-sm text-gray-500">Generating questions...</div>
        )}
      </div>
    </div>
  );
}

/* ----------------- PracticeRunner Component (inline) -----------------
   Minimal, self-contained runner that supports MCQ, multiselect, short, long, coding (placeholder).
   Replace or extract into its own file if you prefer.
------------------------------------------------------------------------*/
function PracticeRunner({
  session,
  onClose,
  onUpdateProgress,
}: {
  session: { nodeId: string; type: string; questions: Question[]; progress: number };
  onClose: () => void;
  onUpdateProgress: (progress: number) => void;
}) {
  const { nodeId, type, questions } = session;
  const [index, setIndex] = useState<number>(0);
  const [attempt, setAttempt] = useState<number>(1);
  const [selected, setSelected] = useState<string | string[]>(""); // string or array for multiselect
  const [localProgress, setLocalProgress] = useState<number>(0);
  const [finished, setFinished] = useState<boolean>(false);

  const q = questions[index];

  function computeProgress(correctCount: number) {
    // Weighted by difficulty could be added later. For MVP: simple percent
    return Math.round((correctCount / questions.length) * 100);
  }

  // Quick grader (naive): MCQ exact match, multiselect compare sets, short/long string match (case-insensitive).
  function gradeAnswer(q: Question, answer: any) {
    if (!q) return false;
    if (q.type === "mcq") {
      return String(answer).trim() === String(q.answer).trim();
    }
    if (q.type === "multiselect") {
      // answer and q.answer could be arrays of texts or indices. Normalize to texts if options present.
      const a = Array.isArray(answer) ? answer.map(String) : [];
      const correct = Array.isArray(q.answer) ? q.answer.map(String) : [];
      // compare as sets (orderless)
      const sa = new Set(a.map((s) => s.trim()));
      const sc = new Set(correct.map((s) => s.trim()));
      if (sa.size !== sc.size) return false;
      for (const v of sc) if (!sa.has(v)) return false;
      return true;
    }
    if (q.type === "short" || q.type === "long") {
      if (!q.answer) return false;
      return String(answer).trim().toLowerCase() === String(q.answer).trim().toLowerCase();
    }
    if (q.type === "coding") {
      // For now, we can't execute code here; treat as manual submit.
      // If you integrate Judge0, swap this with a remote run.
      return false;
    }
    // fallback
    return false;
  }

  async function handleSubmit() {
    if (!q) return;
    let isCorrect = false;
    if (q.type === "multiselect") {
      isCorrect = gradeAnswer(q, selected);
    } else {
      isCorrect = gradeAnswer(q, selected);
    }

    if (isCorrect) {
      // mark correct: update progress
      const correctCountBefore = Math.round((localProgress / 100) * questions.length);
      const newCorrectCount = correctCountBefore + 1;
      const newProgress = computeProgress(newCorrectCount);
      setLocalProgress(newProgress);
      onUpdateProgress(newProgress);

      // show explanation briefly, then next
      alert("Correct!\n\n" + (q.explanation ?? ""));
      setAttempt(1);
      setSelected(Array.isArray(selected) ? [] : "");
      if (index + 1 < questions.length) {
        setIndex(index + 1);
      } else {
        setFinished(true);
      }
      return;
    } else {
      if (attempt < 3) {
        setAttempt(attempt + 1);
        alert(`Incorrect. Attempt ${attempt + 1} of 3. Try again.`);
        return;
      } else {
        // show correct answer and explanation after 3 attempts
        alert(
          `Incorrect after 3 attempts.\nCorrect: ${formatAnswer(q.answer)}\n\n${q.explanation ?? ""}`
        );
        setAttempt(1);
        setSelected(Array.isArray(selected) ? [] : "");
        if (index + 1 < questions.length) {
          setIndex(index + 1);
        } else {
          setFinished(true);
        }
        return;
      }
    }
  }

  function formatAnswer(ans: any) {
    if (Array.isArray(ans)) return ans.join(", ");
    return String(ans ?? "");
  }

  if (!q) {
    return (
      <div style={{ padding: 12 }}>
        <div>No questions generated.</div>
        <div className="mt-2">
          <button onClick={onClose} className="px-3 py-1 rounded border bg-gray-100">Close</button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div style={{ padding: 12 }}>
        <h3 className="text-lg font-semibold">Session complete</h3>
        <div className="text-sm text-gray-600 mt-2">Progress: {localProgress}%</div>
        {localProgress >= 75 ? (
          <div className="text-sm text-green-600 mt-2">Node mastered! ✅</div>
        ) : (
          <div className="text-sm text-yellow-700 mt-2">Keep practicing to reach 75% mastery.</div>
        )}
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border bg-gray-100">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{nodeId} — Practice</h3>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{index + 1} / {questions.length}</div>
        </div>
        <div>
          <button onClick={onClose} className="text-sm text-gray-600">Close</button>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 600 }}>{q.stem}</div>
        {q.options && q.type === "mcq" && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {q.options.map((opt, i) => (
              <label key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="radio"
                  name={`opt-${q.id}`}
                  value={opt}
                  checked={selected === opt}
                  onChange={() => setSelected(opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        )}

        {q.options && q.type === "multiselect" && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {q.options.map((opt, i) => {
              const selectedArr = Array.isArray(selected) ? selected : [];
              const checked = selectedArr.includes(opt);
              return (
                <label key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const arr = Array.isArray(selected) ? [...selected] : [];
                      if (arr.includes(opt)) {
                        setSelected(arr.filter((a) => a !== opt));
                      } else {
                        arr.push(opt);
                        setSelected(arr);
                      }
                    }}
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        )}

        {(q.type === "short" || q.type === "long") && (
          <textarea
            value={typeof selected === "string" ? selected : ""}
            onChange={(e) => setSelected(e.target.value)}
            rows={q.type === "long" ? 5 : 2}
            className="w-full border p-2 rounded mt-2"
            placeholder="Write your answer..."
          />
        )}

        {q.type === "coding" && (
          <div style={{ marginTop: 8 }}>
            <div className="text-sm text-gray-600">Coding questions require code execution. Integrate Judge0 to run tests.</div>
            <textarea
              value={typeof selected === "string" ? selected : ""}
              onChange={(e) => setSelected(e.target.value)}
              rows={6}
              className="w-full border p-2 rounded mt-2 font-mono"
            />
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button onClick={handleSubmit} className="px-3 py-1 rounded bg-blue-600 text-white">Submit</button>
          <button onClick={() => { setAttempt(1); setSelected(Array.isArray(selected) ? [] : ""); }} className="px-3 py-1 rounded border bg-gray-100">Reset</button>
        </div>

        <div style={{ marginTop: 8 }}>
          <div className="text-xs text-gray-500">Attempt: {attempt} / 3</div>
          <div className="text-xs text-gray-500">Progress: {localProgress}%</div>
        </div>
      </div>
    </div>
  );
}
