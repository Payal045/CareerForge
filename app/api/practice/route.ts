// app/api/practice/route.ts
import { NextResponse } from "next/server";

type GenerateBody = {
  nodeId: string;
  text?: string;
  types?: string[];
  count?: number;
  difficulty?: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat-v3.1:free";

// runtime visibility in dev (safe: prints only whether key exists)
console.log("[/api/practice] OPENROUTER_KEY present?", !!OPENROUTER_KEY);
if (!OPENROUTER_KEY) {
  console.warn("[/api/practice] OPENROUTER_API_KEY not set. Requests to this endpoint will fail.");
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function POST(request: Request) {
  try {
    const body: GenerateBody = await request.json().catch(() => ({} as GenerateBody));
    let { nodeId, text = "", types = ["mcq"], count = 4, difficulty = "medium" } = body ?? {};

    if (!nodeId) {
      return NextResponse.json({ error: "nodeId_required" }, { status: 400 });
    }

    // If text is empty, fall back to using the nodeId as context so generator still runs.
    // This supports client fallback calls that don't have detailed source material.
    if (!text || String(text).trim().length === 0) {
      console.warn("[/api/practice] no text provided — falling back to nodeId as source text.");
      text = `Generate questions for the learning topic: "${String(nodeId)}". Provide accurate questions relevant to this topic.`;
    }

    if (!OPENROUTER_KEY) {
      return NextResponse.json({ error: "missing_openrouter_key" }, { status: 500 });
    }

    const prompt = buildPrompt({ nodeId, text, types, count, difficulty });

    const payload = {
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert question generator for technical learning platforms. Respond with JSON only. Do NOT include markdown, code fences (```), or any commentary — output must be raw JSON that exactly matches the requested shape.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.0,
      max_tokens: 1800,
      top_p: 1.0,
      n: 1,
    };

    let orRes;
    try {
      orRes = await fetchWithTimeout(
        OPENROUTER_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_KEY}`,
          },
          body: JSON.stringify(payload),
        },
        30000 // 30s timeout
      );
    } catch (err: any) {
      console.error("[/api/practice] fetch to OpenRouter failed:", { name: err?.name, message: err?.message });
      const msg = err?.name === "AbortError" ? "request_timeout" : "fetch_failed";
      return NextResponse.json({ error: msg, detail: String(err?.message ?? err) }, { status: 502 });
    }

    if (!orRes.ok) {
      const textResp = await orRes.text().catch(() => "");
      console.error("[/api/practice] OpenRouter returned non-OK:", orRes.status, textResp?.slice?.(0, 2000));
      return NextResponse.json({ error: "openrouter_error", status: orRes.status, detail: textResp }, { status: 502 });
    }

    // Read response as text to allow flexible parsing
    let rawResponseText = "";
    try {
      rawResponseText = await orRes.text();
    } catch (e) {
      rawResponseText = "";
    }

    // Try to interpret the provider's response in multiple ways
    let responseJson: any = null;
    try {
      responseJson = JSON.parse(rawResponseText);
    } catch {
      try {
        responseJson = tryExtractJsonObjectFromString(rawResponseText);
      } catch {
        responseJson = null;
      }
    }

    // Extract choices if present (chat envelope)
    const finalChoices = (responseJson?.choices ?? []) || [];
    if ((!finalChoices || finalChoices.length === 0) && typeof rawResponseText === "string") {
      // best-effort: find a JSON blob inside the raw text and parse
      try {
        const extracted = tryExtractJsonObjectFromString(rawResponseText);
        if (extracted && Array.isArray(extracted.choices)) responseJson = extracted;
      } catch {
        // fall through
      }
    }

    const choices = (responseJson?.choices ?? []) as any[];

    // If still no choices, attempt to fallback to any JSON in rawResponseText
    if ((!choices || choices.length === 0) && typeof rawResponseText === "string") {
      try {
        const maybe = tryExtractJsonObjectFromString(rawResponseText);
        if (maybe) {
          if (Array.isArray(maybe.choices)) responseJson = maybe;
        }
      } catch {
        // ignore
      }
    }

    const final = (responseJson?.choices ?? []) as any[];
    if (!final || final.length === 0) {
      console.error("[/api/practice] no choices in OpenRouter response. raw slice:", rawResponseText.slice(0, 2000));
      return NextResponse.json({ error: "no_choices", raw: rawResponseText.slice(0, 2000) }, { status: 502 });
    }

    const rawModelText =
      final[0]?.message?.content ?? final[0]?.text ?? JSON.stringify(responseJson) ?? rawResponseText ?? "";

    // Clean and extract JSON (your existing helpers)
    let parsed: any;
    try {
      const cleaned = cleanModelOutput(rawModelText);
      parsed = extractJSON(cleaned);
    } catch (err) {
      console.error("[/api/practice] parse failed:", String(err), "rawModelText:", rawModelText.slice(0, 2000));
      // return useful trimmed raw to help debugging
      return NextResponse.json({ error: "invalid_json_from_model", raw: rawModelText.slice(0, 2000) }, { status: 502 });
    }

    const items = (parsed.questions ?? parsed ?? []).map((q: any, i: number) => ({
      id: q.id ?? `${nodeId}_${Date.now()}_${i}`,
      nodeId,
      type: q.type ?? (q.options ? "mcq" : "short"),
      stem: q.stem ?? q.question ?? q.title ?? "",
      options: q.options ?? null,
      answer: q.answer ?? null,
      explanation: q.explanation ?? "",
      difficulty: q.difficulty ?? difficulty,
      metadata: q.metadata ?? {},
    }));

    return NextResponse.json({ questions: items }, { status: 200 });
  } catch (err: any) {
    console.error("[/api/practice] generation route error:", err);
    return NextResponse.json({ error: "server_error", detail: String(err?.message ?? err) }, { status: 500 });
  }
}

/* ---------- helpers (same as before) ---------- */

function buildPrompt({
  nodeId,
  text,
  types,
  count,
  difficulty,
}: {
  nodeId: string;
  text: string;
  types: string[];
  count: number;
  difficulty: string;
}) {
  const typeList = types.join(", ");
  return `Generate exactly ${count} ${difficulty} questions for the learning topic "${nodeId}". The source material is below (<<TEXT>>). Use the material to craft accurate questions. The allowed question types are: ${typeList}. Output must be valid JSON only with this exact shape:

{
  "questions": [
    {
      "id": "<unique-id>",
      "type": "mcq" | "multiselect" | "short" | "long" | "coding",
      "stem": "<question text>",
      "options": ["optA","optB","optC","optD"],
      "answer": "<correct answer or array for multiselect>",
      "explanation": "<short 1-3 sentence explanation>",
      "difficulty": "easy|medium|hard",
      "metadata": { "source_span": "<short excerpt from the input text>" }
    }
  ]
}

<<TEXT>>
${text}

Important constraints:
- Output only valid JSON and nothing else (no markdown, no code fences).
- For MCQs provide 3-4 plausible options.
- For multiselect answer return an array of indices or option texts.
- For coding questions include metadata.tests array with { "stdin": "...", "expected": "..." } objects.
- Keep explanations short (1-3 sentences).
- Where possible include a small metadata.source_span with the excerpt used as a hint.`;
}

function cleanModelOutput(text: string) {
  if (!text) return text;
  let s = String(text);

  // Remove code fence markers if present
  s = s.replace(/```(?:json)?\s*/gi, "");
  s = s.replace(/```/g, "");
  s = s.trim();

  return s;
}

function tryExtractJsonObjectFromString(text: string) {
  if (!text || typeof text !== "string") throw new Error("no text");
  const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) throw new Error("no JSON found");
  return JSON.parse(match[0]);
}

function extractJSON(text: string) {
  if (!text || typeof text !== "string") throw new Error("no text to extract JSON from");
  const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) throw new Error("no JSON found in text");
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    throw new Error("JSON parse failed: " + String(e));
  }
}
