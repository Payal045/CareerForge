// data/roadmap.sample.ts
export type RoadmapNode = {
  id: string;
  title: string;
  short: string;        // one-line theory snippet
  theory: string;       // longer markdown or HTML (string)
  prerequisites?: string[]; // ids
  unlocked?: boolean;
  mastery?: number;     // 0-100
  tags?: string[];
};

const sampleRoadmap: RoadmapNode[] = [
  {
    id: "html",
    title: "HTML Basics",
    short: "Structure pages with semantic HTML.",
    theory:
      "<p>HTML defines the structure of web pages. Learn tags like &lt;div&gt;, &lt;section&gt;, &lt;a&gt;, forms, and semantic elements like &lt;article&gt; and &lt;nav&gt;.</p>",
    unlocked: true,
    mastery: 40,
  },
  {
    id: "css",
    title: "CSS Fundamentals",
    short: "Styling, box model, flexbox and grid.",
    theory:
      "<p>CSS controls presentation. Start with selectors, box-model, then learn layout (Flexbox & Grid), and responsive design.</p>",
    prerequisites: ["html"],
    unlocked: false,
    mastery: 0,
  },
  {
    id: "javascript",
    title: "JavaScript Basics",
    short: "Variables, functions, DOM manipulation.",
    theory:
      "<p>JS adds interactivity: variables, functions, events and DOM APIs. Learn function scopes, closures and ES6 basics.</p>",
    prerequisites: ["html"],
    unlocked: false,
    mastery: 0,
  },
  {
    id: "dom",
    title: "DOM & Events",
    short: "Manipulate DOM; event handling.",
    theory:
      "<p>Understand document traversal, event propagation, and common DOM APIs used for interactive UI.</p>",
    prerequisites: ["javascript"],
    unlocked: false,
    mastery: 0,
  },
];

export default sampleRoadmap;
