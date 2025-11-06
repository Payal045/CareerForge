require('dotenv').config({ path: '.env.local' });
(async () => {
  const key = process.env.OPENROUTER_API_KEY;
  console.log("KEY present?", !!key);
  const payload = {
    model: process.env.OPENROUTER_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a concise question generator. Output only valid JSON." },
      { role: "user", content: "Generate 1 mcq with options about HTML" }
    ],
    temperature: 0.0,
    max_tokens: 1400,
    top_p: 1.0,
    n: 1
  };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify(payload),
    });
    console.log("status:", res.status);
    const text = await res.text();
    console.log("RAW RESPONSE length:", text.length);
    console.log("RAW RESPONSE preview:", text.slice(0, 2000));
  } catch (err) {
    console.error("fetch error:", err?.name, err?.message);
  }
})();
