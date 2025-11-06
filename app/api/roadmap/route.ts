// app/api/roadmap/route.ts
import { NextResponse } from "next/server";

type Phase = {
  name: string;
  milestones: string[];
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "gpt-4o-mini";

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function cleanTextLine(line = "") {
  return line
    .replace(/^[\-\*\u2022]\s*/, "") // bullets like - * •
    .replace(/^\d+\.\s*/, "") // numbered list
    .replace(/\*\*/g, "") // bold markers
    .replace(/`/g, "")
    .replace(/\s*[:\-–—]+\s*$/, "") // trailing separators
    .trim();
}

function tryExtractTextFromChoices(data: any) {
  // common shapes: data.choices[0].message.content, data.choices[0].text
  try {
    if (!data) return "";
    const c0 = data.choices?.[0] ?? null;
    if (c0?.message?.content) return String(c0.message.content).trim();
    if (typeof c0?.text === "string") return String(c0.text).trim();
    // sometimes providers return the whole thing as text
    if (typeof data === "string") return data.trim();
    // fallback: JSON.stringify of object
    return JSON.stringify(data);
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    if (!OPENROUTER_KEY) {
      console.warn("[/api/roadmap] OPENROUTER_API_KEY missing");
      return NextResponse.json({ error: "missing_openrouter_key" }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as { role?: string };
    const role = (body?.role ?? "").toString().trim();

    if (!role) {
      return NextResponse.json({ error: "missing_role" }, { status: 400 });
    }

    // Build prompt - keep it explicit and constrained
    const prompt = `Create a concise learning roadmap for the role: "${role}".
Output should contain clearly labeled phases such as "Phase 1", "Phase 2", etc., each followed by 3-6 short milestone lines (one per line). Avoid markdown fences. Example:

Phase 1: <title>
- milestone A
- milestone B

Phase 2: <title>
- milestone C
...`;

    const payload = {
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a roadmap generator. Produce plain text only. Use phases like 'Phase 1', 'Phase 2', followed by simple bullet lines for milestones. No code fences or markdown.",
        },
        { role: "user", content: prompt },
        { role: "user", content: `Create a roadmap for: ${role}` },
      ],
      temperature: 0.0,
      max_tokens: 900,
      top_p: 1.0,
      n: 1,
    };

    const res = await fetchWithTimeout(
      OPENROUTER_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_KEY}`,
        },
        body: JSON.stringify(payload),
      },
      25000
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[/api/roadmap] OpenRouter non-OK:", res.status, txt.slice?.(0, 2000));
      return NextResponse.json({ error: "openrouter_error", status: res.status, detail: txt }, { status: 502 });
    }

    const rawTextCandidate = tryExtractTextFromChoices(await res.json().catch(() => null));
    const rawText = (rawTextCandidate ?? "").toString().trim();
    if (!rawText) {
      return NextResponse.json({ error: "empty_model_output" }, { status: 502 });
    }

    // --- parsing phases ---
    // Try several splitting strategies: Phase, Step, or numbered groups.
    let phaseChunks: string[] = [];

    // Prefer explicit "Phase N" headings
    const phaseSplit = rawText.split(/(?=^Phase\s*\d+)/gim).map(s => s.trim()).filter(Boolean);
    if (phaseSplit.length > 1) phaseChunks = phaseSplit;
    else {
      // try Step N
      const stepSplit = rawText.split(/(?=^Step\s*\d+)/gim).map(s => s.trim()).filter(Boolean);
      if (stepSplit.length > 1) phaseChunks = stepSplit;
      else {
        // fallback: split on blank line groups that look like sections
        const blankSplit = rawText.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
        phaseChunks = blankSplit.length ? blankSplit : [rawText];
      }
    }

    const phases: Phase[] = [];

    for (const chunk of phaseChunks) {
      // find first line as the phase title if it contains "Phase" or begins with a short title
      const lines = chunk.split("\n").map(l => cleanTextLine(l)).filter(Boolean);
      if (lines.length === 0) continue;

      let title = lines[0];
      // if the first line is just "Phase 1" or "Phase 1: Title", clean it
      const titleMatch = title.match(/^(Phase|Step)\s*\d+\s*[:\-–—]?\s*(.*)$/i);
      if (titleMatch) {
        title = titleMatch[2] ? titleMatch[2].trim() : `Phase ${titleMatch[0].replace(/\s+/, " ")}`;
      }

      // milestones are the subsequent lines; if none, try to extract bullets from the chunk
      let milestones = lines.length > 1 ? lines.slice(1) : [];
      if (milestones.length === 0) {
        // try to extract dash/numbered bullets
        const bulletMatches = chunk
          .split("\n")
          .map(l => cleanTextLine(l))
          .filter(l => l && !/^Phase\s*\d+/i.test(l) && !/^Step\s*\d+/i.test(l));
        // drop the title line if duplicate
        milestones = bulletMatches.filter(m => m !== title);
      }

      // limit to 3-12 milestones to avoid unusable long lists
      milestones = milestones.slice(0, 12);

      // push valid phase
      phases.push({
        name: title || "Phase",
        milestones: milestones.length > 0 ? milestones : ["(no milestones detected)"],
      });
    }

    // final fallback if parsing produced nothing meaningful
    if (phases.length === 0) {
      const fallbackLines = rawText.split("\n").map(l => cleanTextLine(l)).filter(Boolean);
      phases.push({
        name: "Phase 1",
        milestones: fallbackLines.length ? fallbackLines.slice(0, 8) : ["(no specific milestones detected)"],
      });
    }

    return NextResponse.json({ roadmap: { phases } }, { status: 200 });
  } catch (err: unknown) {
    console.error("[/api/roadmap] handler error:", err);
    return NextResponse.json(
      { error: "server_error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
