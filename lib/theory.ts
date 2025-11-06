// utils/theory.ts
export function generateTheoryOverview(title?: string): string {
  const t = (title || "This topic").replace(/\s+/g, " ").trim();

  // Build a compact, useful 20-25 line overview. Each line is a short sentence/phrase.
  const lines: string[] = [];

  lines.push(`<strong>AI Overview — ${t}</strong>`);
  lines.push(`${t} is the foundational concept you need to understand to build reliable web interfaces and user experiences.`);
  lines.push(`At its core, ${t} defines structure and presentation (HTML/CSS) or the essential behavior and logic depending on the topic.`);
  lines.push(`Why it matters: mastering ${t} reduces bugs, improves accessibility, and speeds development of real projects.`);

  // key subtopics (break the title into words to suggest areas, fallback to common subtopics)
  const words = t.split(/\s+/).slice(0, 4);
  const keySubs = words.length > 0 ? words.join(", ") : "fundamentals, examples";
  lines.push(`Key subtopics: ${keySubs}, best practices, important APIs, and integration patterns.`);

  // realistic examples
  lines.push(`Common real-world uses: small project prototypes, production web pages, component libraries, and learning exercises.`);
  lines.push(`Example tasks: build a responsive page, create a small interactive component, or wire a form to a backend.`);

  // practical first steps (3 short actions)
  lines.push(`First steps — 1) Read one short tutorial to get the idea, 2) follow a 20–30 minute hands-on example, 3) implement a tiny project.`);
  lines.push(`Mini exercises: create a single-page layout, style it responsively, and add one interactive element.`);

  // techniques & tools
  lines.push(`Useful tools & techniques: browser devtools for debugging, simple design systems, and small reusable components.`);
  lines.push(`When to use it: every time you structure content, style UI, or implement an interaction in a web project.`);

  // common pitfalls
  lines.push(`Common pitfalls: overcomplicating the first implementation, ignoring accessibility, copying without understanding.`);
  lines.push(`Watch out for: fragile selectors, untested edge-cases, and performance issues on mobile.`);

  // quick improvement tips
  lines.push(`Quick tip: start with a working prototype and iterate — ship minimal functionality first.`);
  lines.push(`Another tip: write one small test or checklist for each component you build.`);

  // learning timeline & progression
  lines.push(`Suggested learning path: learn the basics (1–2 days), build small projects (1–2 weeks), then refactor for reusability (ongoing).`);
  lines.push(`If you can, pair your practice with short code reviews — they'll expose gaps much faster.`);

  // suggested resources (generic but practical)
  lines.push(`Suggested resources: official docs, one short tutorial video (15–40 min), and a small project walkthrough.`);
  lines.push(`Recommended mini-projects: a landing page, a form with validation, and a small interactive widget.`);

  // assessment & next steps
  lines.push(`How to evaluate progress: can you implement the core feature without copying code? Can you explain why you made each choice?`);
  lines.push(`Next milestone: build a complete small app that uses ${t} plus one integration (API, storage, or state).`);

  // one-line actionable completion
  lines.push(`Actionable next step: spend 60–90 minutes building the smallest possible project that demonstrates ${t}.`);
  lines.push(`<em>Keep notes as you go — they become the best revision material.</em>`);

  // wrap each line in a paragraph for good spacing
  return lines.map((l) => `<p style="margin:0 0 .5rem">${l}</p>`).join("");
}
