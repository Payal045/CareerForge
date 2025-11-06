// app/api/theory/route.ts
import { NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "gpt-4o-mini";

if (!OPENROUTER_KEY) {
  // warn in server logs; route will respond gracefully
  console.warn("[/api/theory] OPENROUTER_API_KEY not set");
}

function clean(text: string) {
  return (text || "").trim();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = (url.searchParams.get("query") || "").trim();
    if (!raw) return NextResponse.json({ error: "missing_query", theory: "" }, { status: 400 });

    if (!OPENROUTER_KEY) {
      return NextResponse.json({ error: "missing_key", theory: "" }, { status: 500 });
    }

    // Build a strict prompt to get a short, 7-8 line overview in plain text/HTML.
    const prompt = `Write a concise 7-8 line learning overview for the technical topic "${raw}".
Provide:
1) A short paragraph (approx 3-4 sentences) summarizing the topic and core idea.
2) A short "How to approach learning" (2 sentences).
3) A "Key prerequisites" line listing 2-3 items.
4) Output as plain HTML (use <p>, <strong>, <ul>, <li> where helpful) and keep it short.
Do NOT include code fences, lists outside HTML, or extra commentary. Return only the HTML (no markdown). Also include a "source_span" text (a 6–12 word excerpt from what you'd base the questions on).`;

    const payload = {
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: "You are an expert technical educator writing short study overviews. Output must be valid HTML only. No markdown or code fences." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 450,
      n: 1,
    };

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => String(res.status));
      console.error("[/api/theory] model non-ok:", res.status, text.slice?.(0, 1000));
      return NextResponse.json({ error: "model_error", theory: "" }, { status: 502 });
    }

    // read raw text (some providers return envelope)
    const rawText = await res.text();
    // attempt to extract JSON-like chat envelope
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // not raw json — try to find the content part manually
      // common shape: { choices: [{ message: { content: "..." } }] }
      const match = rawText.match(/"content"\s*:\s*"([^"]+)"/);
      if (match) {
        parsed = { choices: [{ message: { content: match[1] } }] };
      }
    }

    // safest: if parsed has choices use that; otherwise use raw text
    const modelText =
      parsed?.choices?.[0]?.message?.content ??
      parsed?.choices?.[0]?.text ??
      rawText ??
      "";

    // strip surrounding code fences and whitespace
    let cleaned = String(modelText).replace(/```(?:html)?/gi, "").replace(/```/g, "").trim();

    // try to find first HTML fragment inside cleaned text
    const htmlMatch = cleaned.match(/(<(?:p|div|strong|ul|ol|li|br|em)[\s\S]*>[\s\S]*<\/(?:p|div|ul|ol)>)/i);
    // prefer full cleaned if it looks like valid small HTML; otherwise use whole cleaned
    const theory = htmlMatch ? htmlMatch[0] : cleaned;

    // also attempt to produce a small source span: take first 10–12 words from theory (plaintext)
    const textOnly = theory.replace(/<\/?[^>]+(>|$)/g, " ").replace(/\s+/g, " ").trim();
    const source_span = textOnly.split(" ").slice(0, 12).join(" ");

    return NextResponse.json({ theory: clean(theory), source_span }, { status: 200 });
  } catch (err: any) {
    console.error("[/api/theory] error:", err);
    return NextResponse.json({ error: "server_error", theory: "" }, { status: 500 });
  }
}
