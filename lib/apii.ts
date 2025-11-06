// lib/api.ts
export async function fetchQuestions(nodeId: string, type: string, theoryText: string) {
  const url = "/api/practice";
  const payload = { nodeId, text: theoryText, types: [type], count: 6, difficulty: "medium" };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    // Network-level failure
    throw new Error(`fetch_failed: ${err?.name || "Error"} ${err?.message || ""}`);
  }

  // Read raw text first (safe)
  let rawText = "";
  try {
    rawText = await res.text();
  } catch {
    rawText = "";
  }

  // If non-OK, throw detailed error including body preview
  if (!res.ok) {
    const bodyPreview = rawText ? rawText.slice(0, 2000) : `HTTP ${res.status}`;
    throw new Error(`server_error: ${res.status} — ${bodyPreview}`);
  }

  // Try parse JSON
  let body: any;
  try {
    body = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`invalid_json_from_server: ${rawText.slice(0, 2000)}`);
  }

  if (!body || !body.questions) {
    throw new Error(`invalid_response_shape: ${JSON.stringify(body).slice(0, 2000)}`);
  }

  return body.questions as Array<any>;
}
