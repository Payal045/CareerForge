// app/api/judge/route.ts
import { NextResponse } from "next/server";

type TestCase = { stdin: string; expected: string };
type ReqBody = {
  language_id: number | string;
  source_code: string;
  tests: TestCase[];
  // optional: base64 bool, but we'll encode where needed
};

const JUDGE0_URL = process.env.JUDGE0_URL || "";
const JUDGE0_KEY = process.env.JUDGE0_KEY || "";
const JUDGE0_RAPIDAPI_HOST = process.env.JUDGE0_RAPIDAPI_HOST || ""; // if using RapidAPI

// Config limits
const MAX_SOURCE_CHARS = 80_000;
const MAX_TESTS = 12;
const MAX_STDIN_CHARS = 10_000;
const POLL_INTERVAL_MS = 800;
const SUBMISSION_TIMEOUT_MS = 35_000; // per submission polling timeout

function safeString(v: any) {
  return v === undefined || v === null ? "" : String(v);
}

async function submitAndPollSingle(test: TestCase, language_id: number | string, source_code: string) {
  // Build body: base64 encoded fields are optional. We'll send raw (Judge0 accepts raw).
  const body = {
    source_code,
    language_id,
    stdin: safeString(test.stdin),
    expected_output: safeString(test.expected),
    // set "wait": false to get token immediately
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // Support RapidAPI judge0 vs direct judge0
  if (JUDGE0_RAPIDAPI_HOST) {
    // RapidAPI judge0 requires x-rapidapi-host & x-rapidapi-key
    headers["x-rapidapi-host"] = JUDGE0_RAPIDAPI_HOST;
    if (!JUDGE0_KEY) throw new Error("JUDGE0_KEY required for RapidAPI usage");
    headers["x-rapidapi-key"] = JUDGE0_KEY;
  } else if (JUDGE0_KEY) {
    // Some deployments expect Authorization header
    headers["Authorization"] = `Bearer ${JUDGE0_KEY}`;
  }

  // Submit
  const submitRes = await fetch(`${JUDGE0_URL.replace(/\/$/, "")}/submissions?base64_encoded=false&wait=false`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const txt = await submitRes.text().catch(() => "");
    throw new Error(`Judge0 submit failed ${submitRes.status}: ${txt}`);
  }

  const submitJson = await submitRes.json();
  const token = submitJson.token ?? submitJson['token'] ?? null;
  if (!token) throw new Error("No token returned from Judge0");

  // Polling loop
  const start = Date.now();
  while (true) {
    if (Date.now() - start > SUBMISSION_TIMEOUT_MS) {
      throw new Error("Submission polling timed out");
    }

    const pollRes = await fetch(`${JUDGE0_URL.replace(/\/$/, "")}/submissions/${token}?base64_encoded=false`, { headers });
    if (!pollRes.ok) {
      // keep trying (transient failure) but propagate meaningful error after loop times out
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }
    const pollJson: any = await pollRes.json();

    // Judge0 status: status.id < 3 -> in queue/running; >=3 finished
    const statusId = Number(pollJson?.status?.id ?? -1);
    if (statusId >= 3) {
      // finished - return normalized result
      return {
        token,
        status: pollJson.status,
        stdout: pollJson.stdout ?? null,
        stderr: pollJson.stderr ?? null,
        compile_output: pollJson.compile_output ?? null,
        message: pollJson.message ?? null,
        time: pollJson.time ?? null,
        memory: pollJson.memory ?? null,
        expected_output: pollJson.expected_output ?? null,
      };
    }

    // not finished - wait
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

export async function POST(req: Request) {
  try {
    if (!JUDGE0_URL) {
      return NextResponse.json({ error: "judge0_not_configured" }, { status: 500 });
    }

    const body: ReqBody = await req.json().catch(() => ({} as ReqBody));
    const language_id = body.language_id;
    const source_code = safeString(body.source_code || "");
    const tests = Array.isArray(body.tests) ? body.tests : [];

    // validation & limits
    if (!language_id || !source_code) {
      return NextResponse.json({ error: "missing_fields", message: "language_id and source_code are required" }, { status: 400 });
    }
    if (source_code.length > MAX_SOURCE_CHARS) {
      return NextResponse.json({ error: "source_too_large", max: MAX_SOURCE_CHARS }, { status: 400 });
    }
    if (tests.length === 0) {
      return NextResponse.json({ error: "no_tests_provided" }, { status: 400 });
    }
    if (tests.length > MAX_TESTS) {
      return NextResponse.json({ error: "too_many_tests", max: MAX_TESTS }, { status: 400 });
    }
    for (const t of tests) {
      if (safeString(t.stdin).length > MAX_STDIN_CHARS || safeString(t.expected).length > MAX_STDIN_CHARS) {
        return NextResponse.json({ error: "test_io_too_large" }, { status: 400 });
      }
    }

    // run tests sequentially (safer). If you want parallel, we can use Promise.all with concurrency limits.
    const results: any[] = [];
    for (const t of tests) {
      try {
        const result = await submitAndPollSingle(t, language_id, source_code);
        results.push({ ok: true, result });
      } catch (err: any) {
        results.push({ ok: false, error: String(err?.message ?? err) });
      }
    }

    // compute simple summary: passed count where stdout matches expected (normalize whitespace)
    let passed = 0;
    const normalizedResults = results.map((r) => {
      if (!r.ok) return { success: false, error: r.error };
      const res = r.result;
      const out = safeString(res.stdout ?? "");
      const expected = safeString(res.expected_output ?? "");
      // normalize newlines/trailing whitespace
      const oN = out.replace(/\r/g, "").trim();
      const eN = expected.replace(/\r/g, "").trim();
      const success = oN === eN;
      if (success) passed++;
      return { success, stdout: out, expected: expected, time: res.time, memory: res.memory, compile_output: res.compile_output, stderr: res.stderr, status: res.status };
    });

    return NextResponse.json({ ok: true, summary: { total: tests.length, passed }, results: normalizedResults });
  } catch (err: any) {
    console.error("/api/judge error:", err);
    return NextResponse.json({ error: "server_error", message: String(err?.message ?? err) }, { status: 500 });
  }
}
