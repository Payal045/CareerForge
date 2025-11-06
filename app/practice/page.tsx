// app/practice/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useRoadmaps from "../api/hooks/useRoadmaps";

/* --- loader (preserved) --- */
function usePracticeLoader() {
  const searchParams = useSearchParams();
  const practiceKey = searchParams?.get?.("practiceKey") ?? null;
  const nodeId = searchParams?.get?.("nodeId") ?? null;
  const type = searchParams?.get?.("type") ?? null;
  const roadmapId = searchParams?.get?.("roadmapId") ?? null;

  const [loading, setLoading] = useState(true);
  const [practicePayload, setPracticePayload] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        if (practiceKey) {
          const raw = sessionStorage.getItem(practiceKey);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (mounted) {
                setPracticePayload(parsed);
                setLoading(false);
                return;
              }
            } catch (e) {
              console.warn("Failed to parse stored practice payload", e);
            }
          }
        }

        if (nodeId && type) {
          const res = await fetch("/api/practice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId, text: "", types: [type], count: 6 }),
          });
          if (res.ok) {
            const json = await res.json();
            if (mounted) setPracticePayload(json);
            setLoading(false);
            return;
          } else {
            console.error("Generator returned", res.status);
          }
        }

        if (mounted) setPracticePayload(null);
      } catch (err) {
        console.error("Failed to load practice:", err);
        if (mounted) setPracticePayload(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [practiceKey, nodeId, type, roadmapId]);

  return { loading, practicePayload, nodeId, type, roadmapId };
}

/* --- helpers/types --- */
type Q = {
  id: string;
  type: string;
  stem: string;
  options?: string[] | null;
  answer?: any;
  explanation?: string;
  metadata?: any;
};

type StatePerQ = {
  selected: string[]; // for mcq single -> single entry; for multi -> multiple
  correct: boolean | null;
  responseText?: string; // for short/long/coding user answer
};

function isMulti(t?: string) {
  return t === "multiselect";
}
function isMCQ(t?: string) {
  return t === "mcq";
}
function isOpenAnswer(t?: string) {
  return ["short", "long", "coding"].includes(String(t));
}

/* ------------------ Component ------------------ */
export default function PracticePage() {
  const { loading, practicePayload, nodeId, type, roadmapId } = usePracticeLoader();
  const { updateProgress } = useRoadmaps();
  const router = useRouter();

  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [perQ, setPerQ] = useState<Record<string, StatePerQ>>({});
  const [showReview, setShowReview] = useState(false);

  // Judge-related state
  const [judgeRunning, setJudgeRunning] = useState(false);
  const [judgeResults, setJudgeResults] = useState<Record<string, any> | null>(null);
  const [userCode, setUserCode] = useState<Record<string, string>>({}); // q.id -> code

  const DEFAULT_LANGUAGE_ID = 71; // Python3 (change if needed)

  const questions: Q[] = practicePayload?.questions ?? [];

  useEffect(() => {
    // reset when questions change
    setStarted(false);
    setShowReview(false);
    setCurrentIndex(0);
    const initial: Record<string, StatePerQ> = {};
    (questions || []).forEach((q) => {
      initial[q.id] = { selected: [], correct: null, responseText: "" };
    });
    setPerQ(initial);
    setUserCode({});
    setJudgeResults(null);
  }, [questions.length]);

  if (loading) return <div className="p-8">Preparing practice...</div>;
  if (!practicePayload) return <div className="p-8">Failed to load practice. Try generating again.</div>;
  if (!questions || questions.length === 0) return <div className="p-8">No questions available.</div>;

  const total = questions.length;
  const answeredCount = Object.values(perQ).filter((s) => (s.selected && s.selected.length) || (s.responseText && s.responseText.trim().length > 0)).length;
  const progressPercent = Math.round((answeredCount / Math.max(1, total)) * 100);

  const curQ = questions[currentIndex];
  const curState = perQ[curQ.id];

  /* ---- Judge / coding helpers ---- */
  async function runJudgeForQuestion(q: Q, code: string, languageId = DEFAULT_LANGUAGE_ID) {
    // tests: prefer q.metadata.tests else fallback to single test comparing to q.answer
    const testsFromQ = q.metadata?.tests;
    const tests = Array.isArray(testsFromQ) && testsFromQ.length > 0
      ? testsFromQ.map((t: any) => ({ stdin: String(t.stdin ?? ""), expected: String(t.expected ?? "") }))
      : [{ stdin: "", expected: String(q.answer ?? "").trim() }];

    setJudgeRunning(true);
    setJudgeResults(null);
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language_id: languageId, source_code: code, tests }),
      });
      const json = await res.json();
      setJudgeResults(json);
      return json;
    } catch (err: any) {
      console.error("Judge error:", err);
      setJudgeResults({ error: String(err?.message ?? err) });
      return { error: String(err?.message ?? err) };
    } finally {
      setJudgeRunning(false);
    }
  }

  /* ---- user actions ---- */
  const start = () => {
    setStarted(true);
    setCurrentIndex(0);
  };

  const toggleOption = (opt: string) => {
    setPerQ((prev) => {
      const copy = { ...prev };
      const s = copy[curQ.id] ?? { selected: [], correct: null, responseText: "" };
      if (isMulti(String(type) ?? undefined)) {
        const set = new Set(s.selected);
        if (set.has(opt)) set.delete(opt);
        else set.add(opt);
        s.selected = Array.from(set);
      } else {
        s.selected = [opt];
      }
      copy[curQ.id] = s;
      return copy;
    });
  };

  const handleTextChange = (val: string) => {
    setPerQ((prev) => ({
      ...prev,
      [curQ.id]: {
        ...(prev[curQ.id] ?? { selected: [], correct: null }),
        responseText: val,
      },
    }));
  };

  const clearAnswer = () => {
    setPerQ((prev) => ({
      ...prev,
      [curQ.id]: {
        ...(prev[curQ.id] ?? { selected: [], correct: null }),
        selected: [],
        responseText: "",
      },
    }));
    // also clear any code for coding questions
    setUserCode(prev => ({ ...prev, [curQ.id]: "" }));
  };

  function evaluateQuestion(q: Q, state: StatePerQ) {
    // returns true if considered correct
    if (isMCQ(q.type)) {
      if (!state.selected || state.selected.length === 0) return false;
      return String(state.selected[0]) === String(q.answer);
    }
    if (isMulti(q.type)) {
      const ansArr = Array.isArray(q.answer) ? q.answer.map(String) : [String(q.answer)];
      const aSet = new Set(ansArr);
      const uSet = new Set((state.selected || []).map(String));
      if (aSet.size !== uSet.size) return false;
      for (const a of aSet) if (!uSet.has(a)) return false;
      return true;
    }
    // open answer: if authoritative answer exists, compare trimmed lowercase (best-effort)
    if (isOpenAnswer(q.type)) {
      if (!q.answer) return !!(state.responseText && state.responseText.trim().length > 0);
      const expected = String(q.answer).trim().toLowerCase();
      const given = String(state.responseText || "").trim().toLowerCase();
      return given === expected || given.includes(expected) || expected.includes(given);
    }
    return false;
  }

  const submitCurrentEvaluation = () => {
    setPerQ((prev) => {
      const copy = { ...prev };
      const s = copy[curQ.id] ?? { selected: [], correct: null, responseText: "" };
      const wasCorrect = evaluateQuestion(curQ, s);
      s.correct = typeof wasCorrect === "boolean" ? wasCorrect : null;
      copy[curQ.id] = s;
      return copy;
    });
  };

  const goNext = async () => {
    // evaluate first
    submitCurrentEvaluation();

    // if coding question, run judge optionally but DO NOT award XP here (XP removed)
    if (String(curQ.type).toLowerCase() === "coding") {
      const code = userCode[curQ.id] ?? "";
      if (code.trim()) {
        try {
          await runJudgeForQuestion(curQ, code, DEFAULT_LANGUAGE_ID);
        } catch (e) {
          // ignore: judge errors handled inside runJudgeForQuestion
        }
      }
      // also store code as responseText so it's visible in review
      setPerQ(prev => ({ ...prev, [curQ.id]: { ...(prev[curQ.id] ?? { selected: [], correct: null }), responseText: userCode[curQ.id] ?? "" } }));
    }

    setTimeout(() => {
      if (currentIndex < total - 1) {
        setCurrentIndex((ci) => Math.min(total - 1, ci + 1));
      } else {
        finishPractice();
      }
    }, 120);
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex((ci) => ci - 1);
  };

  const finishPractice = async () => {
    // evaluate last
    submitCurrentEvaluation();
    // prepare review
    setShowReview(true);

    // compute mastery (simple correct count => mastery %)
    const totalQ = questions.length;
    let correctCount = 0;
    for (const q of questions) {
      const s = perQ[q.id];
      if (s && s.correct) correctCount++;
    }
    const mastery = Math.round((correctCount / Math.max(1, totalQ)) * 100);

    // prepare payload shape: { nodeId: { [type]: { mastery, lastUpdated } } }
    const payload: any = { [nodeId ?? "unknown_node"]: { [type ?? "unknown_type"]: { mastery, lastUpdated: new Date().toISOString() } } };

    try {
      if (roadmapId && updateProgress) {
        await updateProgress(roadmapId, payload);
      }
    } catch (err) {
      console.error("Failed to save progress:", err);
    }
  };

  /* ---- Review UI ---- */
  if (showReview) {
    let correctCount = 0;
    const reviewed = questions.map((q, idx) => {
      const s = perQ[q.id];
      const user = s ? (isOpenAnswer(q.type) ? s.responseText ?? "" : s.selected) : [];
      const isCorrect = s?.correct ?? false;
      if (isCorrect) correctCount++;
      return { q, user, isCorrect, state: s };
    });
    const mastery = Math.round((correctCount / Math.max(1, total)) * 100);
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Practice review</h1>
        <div className="text-sm text-gray-600 mb-4">Score: <strong>{mastery}%</strong> ({correctCount}/{total})</div>

        <div className="space-y-4">
          {reviewed.map((r, idx) => (
            <div key={r.q.id} className="p-4 border rounded bg-white">
              <div className="font-semibold mb-2">Q{idx + 1}. {r.q.stem}</div>

              {Array.isArray(r.q.options) ? (
                <ul className="space-y-1">
                  {r.q.options!.map((opt, i) => {
                    const isUser = (Array.isArray(r.user) ? r.user.map(String) : [String(r.user)]).map(String).includes(String(opt));
                    const isCorrect = Array.isArray(r.q.answer) ? r.q.answer.map(String).includes(String(opt)) : String(r.q.answer) === String(opt);
                    return (
                      <li key={i} className={`p-2 rounded ${isCorrect ? "bg-green-50 border border-green-200" : isUser ? "bg-yellow-50 border border-yellow-200" : ""}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm">{opt}</div>
                          <div className="text-xs text-gray-500">
                            {isCorrect ? "correct" : isUser ? "your choice" : ""}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-sm text-gray-700">
                  <div><strong>Your answer:</strong> <pre className="whitespace-pre-wrap">{String(r.user) || "(no answer)"}</pre></div>
                  <div className="mt-1"><strong>Expected:</strong> {String(r.q.answer ?? "(no model answer)")}</div>
                </div>
              )}

              {r.q.explanation && <div className="mt-3 text-sm text-gray-600">{r.q.explanation}</div>}
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={() => { setShowReview(false); setStarted(false); }} className="px-4 py-2 rounded border bg-gray-100">Back</button>
          <button onClick={() => { router.push(`/dashboard?selected=${encodeURIComponent(roadmapId ?? "")}&openPractice=1`); }} className="px-4 py-2 rounded bg-indigo-600 text-white">Done</button>
        </div>
      </div>
    );
  }

  /* ---- Running quiz UI ---- */
  return (
    <div className="p-8 max-w-4xl mx-auto">
      {!started ? (
        <div className="p-8 border rounded bg-white text-center">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{practicePayload?.meta?.title ?? "Practice Session"}</h1>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (roadmapId) router.push(`/dashboard?selected=${encodeURIComponent(roadmapId)}&openPractice=1`);
                  else router.back();
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
              >
                ← Back
              </button>
              <button onClick={start} className="px-6 py-3 rounded bg-indigo-600 text-white">Start</button>
            </div>
          </div>

          <p className="text-sm text-gray-600">Type: <strong>{(type || "").toUpperCase()}</strong> • Questions: <strong>{total}</strong></p>
          
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 border rounded bg-white relative">
            <div className="absolute right-4 top-4 text-xs text-gray-600">Progress: <strong>{progressPercent}%</strong></div>

            <div className="text-sm text-gray-500 mb-2">Question {currentIndex + 1} / {total}</div>
            <div className="font-semibold text-lg">{curQ.stem}</div>

            <div className="mt-4">
              {Array.isArray(curQ.options) ? (
                <div className="grid gap-2">
                  {curQ.options.map((opt, i) => {
                    const selected = (curState?.selected ?? []).map(String).includes(String(opt));
                    return (
                      <button key={i} onClick={() => toggleOption(opt)} className={`w-full text-left p-3 rounded border ${selected ? "bg-indigo-50 border-indigo-300" : "bg-white hover:bg-gray-50"}`}>
                        <div className="flex items-center justify-between">
                          <div className="truncate">{opt}</div>
                          {selected && <div className="text-xs text-indigo-600">Selected</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div>
                  {isOpenAnswer(String(type) ?? undefined) && (
                    <>
                      {/* For coding: use userCode store; for short/long: use responseText */}
                      <textarea
                        value={String(type).toLowerCase() === "coding" ? (userCode[curQ.id] ?? (curState?.responseText ?? "")) : (curState?.responseText ?? "")}
                        onChange={(e) => {
                          const txt = e.target.value;
                          if (String(type).toLowerCase() === "coding") {
                            setUserCode(prev => ({ ...prev, [curQ.id]: txt }));
                          } else {
                            handleTextChange(txt);
                          }
                        }}
                        rows={String(type).toLowerCase() === "coding" ? 12 : 6}
                        className="w-full border rounded p-3 text-sm font-mono"
                        placeholder={String(type).toLowerCase() === "coding" ? "Write your code here..." : "Type your answer here..."}
                      />

                      {/* Coding controls */}
                      {String(type).toLowerCase() === "coding" && (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={async () => {
                              const code = userCode[curQ.id] ?? "";
                              if (!code.trim()) { alert("Write code before running tests."); return; }
                              await runJudgeForQuestion(curQ, code, DEFAULT_LANGUAGE_ID);
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded"
                            disabled={judgeRunning}
                          >
                            {judgeRunning ? "Running..." : "Run tests"}
                          </button>

                          <button
                            onClick={() => {
                              // save code as response and mark evaluation
                              handleTextChange(userCode[curQ.id] ?? "");
                              submitCurrentEvaluation();
                            }}
                            className="px-3 py-2 border rounded"
                          >
                            Save / Submit
                          </button>

                          {judgeResults && (
                            <div className="ml-4 text-sm">
                              {judgeResults.error ? (
                                <span className="text-rose-600">Error: {String(judgeResults.error)}</span>
                              ) : (
                                <div>
                                  <div className="font-medium">Results:</div>
                                  <div className="text-xs text-gray-600">Passed: {judgeResults.summary?.passed ?? 0}/{judgeResults.summary?.total ?? judgeResults.results?.length ?? "?"}</div>
                                  <div className="mt-2 space-y-1">
                                    {Array.isArray(judgeResults.results) && judgeResults.results.map((r:any, i:number) => (
                                      <div key={i} className={`p-2 border rounded ${r.success ? "bg-green-50" : "bg-yellow-50"}`}>
                                        <div className="text-xs font-medium">Test {i+1}: {r.success ? "PASS" : "FAIL"}</div>
                                        <div className="text-xs"><strong>Stdout:</strong> <pre className="whitespace-pre-wrap text-xs">{String(r.stdout ?? "").slice(0,800)}</pre></div>
                                        {r.stderr && <div className="text-xs text-rose-600"><strong>Stderr:</strong> {String(r.stderr).slice(0,400)}</div>}
                                        {r.compile_output && <div className="text-xs text-rose-600"><strong>Compile:</strong> {String(r.compile_output).slice(0,400)}</div>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={clearAnswer} className="px-3 py-1 rounded border text-sm">Clear</button>
              </div>

              <div className="flex gap-2">
                <button onClick={goPrev} disabled={currentIndex === 0} className="px-3 py-1 rounded border text-sm">Previous</button>

                {currentIndex < total - 1 ? (
                  <button onClick={goNext} className="px-3 py-1 rounded text-white bg-indigo-600">Next</button>
                ) : (
                  <button onClick={goNext} className="px-3 py-1 rounded bg-rose-600 text-white">End Practice</button>
                )}
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Tip: You can change answers before finishing. Progress is saved for the subtopic after you finish the practice.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
