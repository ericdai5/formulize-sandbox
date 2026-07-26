/**
 * Server-side simulation engine.
 *
 * Runs the guess → verify → query-oracle loop for each construct,
 * using the same OpenAI API and E2B sandbox as the playground.
 *
 * Emits events via a callback so the Vite plugin can stream them as SSE.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Construct definitions (duplicated from src/ for server-side use —
// the src/ version uses ESM imports that Vite transforms for the browser)
// ---------------------------------------------------------------------------

type Phase = "basics" | "variables" | "semantics" | "interactivity" | "stepping" | "visualization" | "advanced";

interface Construct {
  id: string;
  name: string;
  phase: Phase;
  dependsOn: string[];
  goal: string;
  checks: Array<[string, string, string]>;
}

interface VerifyResult {
  pass: boolean;
  error?: string;
}

function verifyCode(checks: Construct["checks"], code: string): VerifyResult {
  for (const [source, flags, errorMsg] of checks) {
    const regex = new RegExp(source, flags);
    if (!regex.test(code)) {
      return { pass: false, error: errorMsg };
    }
  }
  return { pass: true };
}

// Import constructs at runtime to avoid ESM/CJS issues. We'll inline them.
// This is loaded from the compiled constructs — but since this runs via Vite's
// server (Node), we need to load them directly.

const CONSTRUCTS: Construct[] = [
  // ── Basics ──────────────────────────────────────────────────────────────
  {
    id: "config-shape",
    name: "Config object shape",
    phase: "basics",
    dependsOn: [],
    goal: "Create a Config object with empty formulas, variables, and semantics fields.",
    checks: [
      ["formulas\\s*:", "", "Missing `formulas` field in Config"],
      ["variables\\s*:", "", "Missing `variables` field in Config"],
      ["semantics\\s*:", "", "Missing `semantics` field in Config"],
    ],
  },
  {
    id: "formula-entry",
    name: "Formula with id and latex",
    phase: "basics",
    dependsOn: ["config-shape"],
    goal: 'Add a formula entry to the formulas array with an `id` of "gravity" and the LaTeX string "\\\\vec{F} = G \\\\frac{m_1 m_2}{r^2}".',
    checks: [
      ["id\\s*:\\s*[\"']gravity[\"']", "", 'Formula must have id "gravity"'],
      ["latex\\s*:", "", "Formula entry must have a `latex` field"],
      ["\\\\vec\\{F\\}", "", "LaTeX should contain \\vec{F}"],
      ["\\\\frac", "", "LaTeX should contain \\frac"],
    ],
  },
  {
    id: "provider-formula",
    name: "Provider + Formula components",
    phase: "basics",
    dependsOn: ["formula-entry"],
    goal: "Render the formula using a <Provider> component that receives the config, with a <Formula> component inside that references the formula by its id.",
    checks: [
      ["<Provider", "", "Must use <Provider> component"],
      ["config\\s*=", "", "Provider must receive a config prop"],
      ["<Formula", "", "Must use <Formula> component"],
      ["id\\s*=\\s*[\"']gravity[\"']", "", 'Formula must reference id "gravity"'],
    ],
  },
  {
    id: "variables-basic",
    name: "Variable with default and name",
    phase: "variables",
    dependsOn: ["config-shape"],
    goal: 'Add a variable `G` to the variables object with a `default` value of 6.674e-11 and a `name` of "Gravitational Constant".',
    checks: [
      ["G\\s*:\\s*\\{", "", "Must define variable G as an object"],
      ["default\\s*:", "", "Variable must have a `default` field"],
      ["6\\.674e-11", "", "G should default to 6.674e-11"],
      ["name\\s*:", "", "Variable must have a `name` field"],
    ],
  },
  {
    id: "variables-precision",
    name: "precision and sigFigs",
    phase: "variables",
    dependsOn: ["variables-basic"],
    goal: "Add `precision` or `sigFigs` formatting to the variables. Set `sigFigs: 4` on the G variable and `precision: 2` on the force variable.",
    checks: [
      ["sigFigs\\s*:\\s*4", "", "G should have sigFigs: 4"],
      ["precision\\s*:\\s*2", "", "Force variable should have precision: 2"],
    ],
  },
  {
    id: "variables-escaped-key",
    name: "Escaped LaTeX key (\\\\vec{F})",
    phase: "variables",
    dependsOn: ["variables-basic"],
    goal: 'Add a variable whose key is the escaped LaTeX string "\\\\vec{F}". It must be quoted because it contains special characters. Give it a default of 0 and name "Gravitational Force".',
    checks: [
      ["[\"']\\\\\\\\vec\\{F\\}[\"']\\s*:", "", 'Must use quoted escaped LaTeX key "\\\\vec{F}"'],
      ["default\\s*:\\s*0", "", "\\vec{F} should default to 0"],
    ],
  },
  {
    id: "variables-subscript",
    name: "Subscripted variable key (m_1)",
    phase: "variables",
    dependsOn: ["variables-basic"],
    goal: "Add variables `m_1` and `m_2` with appropriate defaults and names. Subscripted keys like m_1 can be used as unquoted object keys.",
    checks: [
      ["m_1\\s*:\\s*\\{", "", "Must define variable m_1"],
      ["m_2\\s*:\\s*\\{", "", "Must define variable m_2"],
    ],
  },
  {
    id: "semantics-fn",
    name: "Semantics function shape",
    phase: "semantics",
    dependsOn: ["config-shape"],
    goal: "Write a semantics function that destructures `vars` from its context parameter. The function body should be empty for now.",
    checks: [
      ["semantics\\s*:\\s*function", "", "Must use `semantics: function`"],
      ["\\{\\s*vars\\s*\\}", "", "Must destructure { vars } from context"],
    ],
  },
  {
    id: "semantics-read",
    name: "Read variables via vars proxy",
    phase: "semantics",
    dependsOn: ["semantics-fn", "variables-basic"],
    goal: "Inside the semantics function, read the values of G, m_1, m_2, and r from the `vars` object using dot notation (e.g. `var G = vars.G`).",
    checks: [
      ["vars\\.G", "", "Must read vars.G"],
      ["vars\\.m_1", "", "Must read vars.m_1"],
      ["vars\\.m_2", "", "Must read vars.m_2"],
      ["vars\\.r", "", "Must read vars.r"],
    ],
  },
  {
    id: "semantics-write",
    name: "Write computed result via vars proxy",
    phase: "semantics",
    dependsOn: ["semantics-read", "variables-escaped-key"],
    goal: 'Compute the gravitational force (G * m1 * m2 / (r * r)) and assign the result to vars["\\\\vec{F}"] using bracket notation (required for keys with special characters).',
    checks: [
      ["vars\\s*\\[\\s*[\"']\\\\\\\\vec\\{F\\}[\"']\\s*\\]", "", 'Must write to vars["\\\\vec{F}"] with bracket notation'],
      ["\\*", "", "Must include multiplication in the formula"],
      ["\\/", "", "Must include division in the formula"],
    ],
  },
  {
    id: "input-drag",
    name: 'input: "drag" with range',
    phase: "interactivity",
    dependsOn: ["variables-basic"],
    goal: 'Make the variable `m_2` interactive by adding `input: "drag"` and a `range: [1, 200]` so users can drag to change its value.',
    checks: [
      ["input\\s*:\\s*[\"']drag[\"']", "", 'Must set input: "drag"'],
      ["range\\s*:\\s*\\[", "", "Must specify a range"],
    ],
  },
  {
    id: "input-inline",
    name: 'input: "inline"',
    phase: "interactivity",
    dependsOn: ["variables-basic"],
    goal: 'Make the variable `r` editable inline by adding `input: "inline"` so users can type a value directly.',
    checks: [
      ["input\\s*:\\s*[\"']inline[\"']", "", 'Must set input: "inline"'],
    ],
  },
  {
    id: "stepping-enable",
    name: "stepping: true",
    phase: "stepping",
    dependsOn: ["config-shape"],
    goal: "Enable step-through mode by adding `stepping: true` to the Config object.",
    checks: [
      ["stepping\\s*:\\s*true", "", "Must set stepping: true"],
    ],
  },
  {
    id: "step-call",
    name: "step() with labels",
    phase: "stepping",
    dependsOn: ["stepping-enable", "semantics-fn"],
    goal: 'Destructure `step` from the semantics context. After computing the product of m1 * m2, call step() with a `labels` object that maps variable names to their current values, e.g. `step({ labels: { m_1: m1, m_2: m2 } })`.',
    checks: [
      ["step\\s*\\(", "", "Must call step()"],
      ["labels\\s*:", "", "step() must include a labels object"],
    ],
  },
  {
    id: "step-description",
    name: "step() with description",
    phase: "stepping",
    dependsOn: ["step-call"],
    goal: 'Add a `description` field to one of the step() calls to explain what the step does, e.g. `step({ description: "Square the distance", labels: { r: r } })`.',
    checks: [
      ["description\\s*:", "", "step() must include a description field"],
    ],
  },
  {
    id: "step-latex-helper",
    name: "latex() formatter in steps",
    phase: "stepping",
    dependsOn: ["step-call"],
    goal: "Destructure `latex` from the semantics context. Use `latex(value).sigfigs(4)` or `latex(value).precision(2)` inside step labels to format numbers for display.",
    checks: [
      ["latex\\s*\\(", "", "Must call latex()"],
      ["\\.(sigfigs|precision)\\s*\\(", "", "Must chain .sigfigs() or .precision()"],
    ],
  },
  {
    id: "step-control",
    name: "StepControl component",
    phase: "stepping",
    dependsOn: ["stepping-enable", "provider-formula"],
    goal: "Add a <StepControl /> component inside the <Provider> to let users navigate through steps.",
    checks: [
      ["<StepControl", "", "Must include <StepControl /> component"],
    ],
  },
  {
    id: "sample-call",
    name: "sample() in semantics",
    phase: "visualization",
    dependsOn: ["semantics-fn"],
    goal: 'Destructure `sample` from the semantics context. Call `sample("curve", { x: xValue, y: yValue })` inside a loop to collect data points for a 2D graph.',
    checks: [
      ["sample\\s*\\(", "", "Must call sample()"],
      ["x\\s*:", "", "sample() must include x coordinate"],
      ["y\\s*:", "", "sample() must include y coordinate"],
    ],
  },
  {
    id: "graph2d-line",
    name: "graph2d with a line",
    phase: "visualization",
    dependsOn: ["sample-call"],
    goal: "Add a `graph2d` array to the config with a graph that has an `id`, and a `lines` array containing one line with a `sampleId` matching the sample() call, and a `parameter` specifying which variable to iterate.",
    checks: [
      ["graph2d\\s*:", "", "Must define graph2d"],
      ["lines\\s*:", "", "graph2d must have a lines array"],
      ["sampleId\\s*:", "", "Line must have a sampleId"],
      ["parameter\\s*:", "", "Line must have a parameter"],
    ],
  },
  {
    id: "graph2d-point",
    name: "graph2d with a point",
    phase: "visualization",
    dependsOn: ["sample-call"],
    goal: "Add a `points` array to the graph2d config with a point that has a `sampleId` matching a sample() call. Points show the current position without sampling over a parameter.",
    checks: [
      ["points\\s*:", "", "graph2d must have a points array"],
      ["sampleId\\s*:", "", "Point must have a sampleId"],
    ],
  },
  {
    id: "graph2d-vector",
    name: "graph2d with vectors",
    phase: "visualization",
    dependsOn: ["sample-call"],
    goal: "Add a `vectors` array to the graph2d config with a vector that has `startSampleId` and `endSampleId` matching sample() calls for the start and end points.",
    checks: [
      ["vectors\\s*:", "", "graph2d must have a vectors array"],
      ["startSampleId\\s*:", "", "Vector must have startSampleId"],
      ["endSampleId\\s*:", "", "Vector must have endSampleId"],
    ],
  },
  {
    id: "control-slider",
    name: "Slider control",
    phase: "visualization",
    dependsOn: ["input-drag"],
    goal: 'Add a `controls` array to the config with a slider control: `{ type: "slider", variable: "m_2" }`.',
    checks: [
      ["controls\\s*:", "", "Must define controls"],
      ["type\\s*:\\s*[\"']slider[\"']", "", 'Control must have type: "slider"'],
      ["variable\\s*:", "", "Slider must specify which variable to control"],
    ],
  },
  {
    id: "datatype-vector",
    name: 'dataType: "vector" with dimensions',
    phase: "advanced",
    dependsOn: ["variables-basic"],
    goal: 'Define a variable with `dataType: "vector"` and `dimensions: [3]` for a 3D vector, with a default value as an array like `[1, 2, 3]`.',
    checks: [
      ["dataType\\s*:\\s*[\"']vector[\"']", "", 'Must set dataType: "vector"'],
      ["dimensions\\s*:\\s*\\[", "", "Must specify dimensions"],
      ["default\\s*:\\s*\\[", "", "Default must be an array"],
    ],
  },
  {
    id: "graph3d-surface",
    name: "graph3d with a surface",
    phase: "advanced",
    dependsOn: ["sample-call"],
    goal: "Add a `graph3d` array to the config with a surface that has a `sampleId`, `parameters` (two variable names), and `ranges` for each parameter.",
    checks: [
      ["graph3d\\s*:", "", "Must define graph3d"],
      ["surfaces\\s*:", "", "graph3d must have surfaces"],
      ["parameters\\s*:", "", "Surface must have parameters"],
    ],
  },
];

// ---------------------------------------------------------------------------
// Doc Oracle
// ---------------------------------------------------------------------------

let docsCache: string | null = null;

function loadDocs(): string {
  if (docsCache) return docsCache;

  const tutorialPaths = [
    resolve(__dirname, "../tutorial.md"),
    resolve(__dirname, "../../tutorial.md"),
  ];
  const typesDir = resolve(__dirname, "../../formula-editor/src/types");

  let docs = "";

  for (const p of tutorialPaths) {
    try {
      docs += "## Tutorial\n\n" + readFileSync(p, "utf-8") + "\n\n";
      break;
    } catch { /* try next */ }
  }

  const typeFiles = [
    "formula.ts", "variable.ts", "computation.ts", "control.ts",
    "graph.ts", "graph2d.ts", "graph3d.ts", "step.ts", "environment.ts",
  ];

  docs += "## Type Definitions\n\n";
  for (const file of typeFiles) {
    try {
      const content = readFileSync(resolve(typesDir, file), "utf-8");
      docs += `### ${file}\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
    } catch {
      // skip missing files
    }
  }

  docsCache = docs;
  return docs;
}

const ORACLE_SYSTEM = `You are a documentation oracle for the Formulize interactive math library.

You have access to the full Formulize documentation and type definitions (provided below).
A code-writing AI is trying to learn the Formulize API one construct at a time.
It will ask you questions when it gets stuck.

YOUR RULES:
1. Answer with the MINIMUM information needed — a single relevant section, a type signature, or a one-line clarification.
2. NEVER dump the full documentation.
3. NEVER provide a complete working code example that solves the problem directly.
4. You may show a small snippet (1-3 lines) illustrating syntax, but NEVER a full Config object.
5. If the question is vague, give the smallest useful nudge.
6. Prefer showing type signatures over code examples.
7. Be concise — aim for 1-5 sentences plus at most a small snippet.

DOCUMENTATION:
`;

const CODER_SYSTEM = `You are learning the Formulize interactive math library API by building a formula step by step.

You will be given:
1. The code you have built so far
2. A goal describing what construct to add next
3. Optionally, hints from documentation if you asked a question

YOUR RULES:
1. Output ONLY the complete updated code. No explanation, no markdown fences, just code.
2. Keep all previously working code intact — only add or modify what the goal asks for.
3. If you are unsure about syntax, make your best guess based on what you know so far.
4. The code should be a complete TypeScript/React file that uses the Formulize library.

You are importing from "math-notation" which provides: Provider, Formula, StepControl, and the Config type.
You must also import "math-notation/style.css" for the library's styles to apply.`;

const QUERY_SYSTEM = `You are a code-writing AI that got stuck using the Formulize library.
You just tried to use a construct and it didn't work.
Formulate a SHORT, SPECIFIC question about the Formulize API to ask the documentation oracle.
Output ONLY the question, nothing else. One or two sentences max.`;

// ---------------------------------------------------------------------------
// OpenAI helpers
// ---------------------------------------------------------------------------

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const VERIFIER_SYSTEM = `You are verifying whether a Formulize interactive math formula rendered correctly.

You will be shown:
1. A screenshot of the rendered output
2. The construct that was just added (what it should do)
3. The code that produced the screenshot

Decide whether the output looks correct. Specifically check:
- Is a formula actually visible on screen (rendered LaTeX math notation)?
- Is there a blank screen, an error message, or a crash?
- Does the output match what the construct goal describes?
- Are there any visible React/JavaScript errors?

Respond with EXACTLY one of two formats:
PASS
or
FAIL: <one sentence explaining what looks wrong>

Nothing else.`;

async function llmCall(
  apiKey: string,
  model: string,
  system: string,
  userContent: string | Array<Record<string, unknown>>,
  maxTokens: number,
): Promise<string> {
  const input: Array<Record<string, unknown>> = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input,
      max_output_tokens: maxTokens,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 500)}`);
  }

  const data = JSON.parse(text);
  // Extract text from Responses API format
  if (typeof data.output_text === "string") return data.output_text;
  const chunks: string[] = [];
  for (const item of data.output ?? []) {
    for (const part of item.content ?? []) {
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }
  const result = chunks.join("");
  if (!result) throw new Error("OpenAI response did not include output text.");
  return result;
}

/** Make a multimodal user content array with text + image */
function visionContent(
  text: string,
  imageDataUrl: string,
): Array<Record<string, unknown>> {
  return [
    { type: "input_text", text },
    { type: "input_image", image_url: imageDataUrl, detail: "low" },
  ];
}

function stripCodeFences(code: string): string {
  const fencePattern = /^```(?:typescript|tsx|ts|jsx|js)?\s*\n([\s\S]*?)\n```\s*$/;
  const match = code.match(fencePattern);
  return match ? match[1] : code;
}

// ---------------------------------------------------------------------------
// Simulation runner
// ---------------------------------------------------------------------------

export interface SimulationOptions {
  openAiApiKey: string;
  openAiModel: string;
  maxAttempts: number;
  /** Called with each SSE event */
  emit: (event: Record<string, unknown>) => void;
  /** Write files to sandbox and capture screenshot; returns PNG data URL */
  screenshotFn: (files: Record<string, string>) => Promise<string>;
}

export async function runSimulation(opts: SimulationOptions): Promise<void> {
  const { openAiApiKey, openAiModel, maxAttempts, emit, screenshotFn } = opts;

  const exampleFile = "/gravitational-force.tsx";

  let currentCode = `import { Formula, Provider, type Config } from "math-notation";
import "math-notation/style.css";

const config: Config = {
};

export default function GravityFormula() {
  return (
    <div />
  );
}
`;

  const constructs = CONSTRUCTS;

  for (let i = 0; i < constructs.length; i++) {
    const construct = constructs[i];

    emit({
      type: "construct_start",
      constructId: construct.id,
      constructName: construct.name,
      phase: construct.phase,
      index: i,
      total: constructs.length,
    });

    const trace: {
      constructId: string;
      constructName: string;
      phase: string;
      status: string;
      attempts: Array<{
        guess: string;
        verifyResult: { pass: boolean; error?: string };
        query?: string;
        oracleHint?: string;
        screenshotUrl?: string;
      }>;
      difficulty: number;
    } = {
      constructId: construct.id,
      constructName: construct.name,
      phase: construct.phase,
      status: "in_progress",
      attempts: [],
      difficulty: -1,
    };

    let solved = false;
    const hintsSoFar: string[] = [];
    let lastScreenshotUrl: string | undefined;

    for (let attemptNum = 0; attemptNum < maxAttempts; attemptNum++) {
      // ── Guess ──────────────────────────────────────────────────────
      // Build the coder prompt. If there was a previous failed attempt
      // with a screenshot, include it so the coder can see what went wrong.
      let guessTextParts = `Here is the code you have built so far:

\`\`\`typescript
${currentCode}
\`\`\`

YOUR NEXT GOAL: ${construct.goal}

Output the complete updated code with this construct added.`;

      if (hintsSoFar.length > 0) {
        guessTextParts += "\n\nHINTS FROM DOCUMENTATION (from previous questions you asked):\n";
        hintsSoFar.forEach((h, idx) => {
          guessTextParts += `\n${idx + 1}. ${h}`;
        });
      }

      // If we have a screenshot from a previous failed attempt, show it
      let guessContent: string | Array<Record<string, unknown>>;
      if (lastScreenshotUrl) {
        guessTextParts += "\n\nBelow is a screenshot of what your PREVIOUS attempt rendered. It was not correct — look at it carefully and fix the issue.";
        guessContent = visionContent(guessTextParts, lastScreenshotUrl);
      } else {
        guessContent = guessTextParts;
      }

      let guess: string;
      try {
        guess = await llmCall(openAiApiKey, openAiModel, CODER_SYSTEM, guessContent, 2000);
        guess = stripCodeFences(guess);
      } catch (err) {
        emit({ type: "error", message: `LLM call failed: ${err instanceof Error ? err.message : String(err)}` });
        return;
      }

      // ── Regex checks (preliminary gate) ────────────────────────────
      const regexResult = verifyCode(construct.checks, guess);

      // ── Screenshot ─────────────────────────────────────────────────
      let screenshotUrl: string | undefined;
      try {
        const files: Record<string, string> = {
          [exampleFile]: guess,
          "/App.tsx": `import Example from "./gravitational-force";\nimport "math-notation/style.css";\n\nexport default function App() {\n  return (\n    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>\n      <Example />\n    </div>\n  );\n}\n`,
          "/main.tsx": `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\n\nconst root = createRoot(document.getElementById("root")!);\nroot.render(<App />);\n`,
        };
        screenshotUrl = await screenshotFn(files);
      } catch {
        // screenshot failure is non-fatal
      }

      // ── Visual verification (if regex passed) ─────────────────────
      // Even if regex checks pass, the code may be structurally wrong
      // (e.g. formulas as an object instead of an array). Send the
      // screenshot to a verifier LLM to check the actual render.
      let verifyResult = regexResult;

      if (regexResult.pass && screenshotUrl) {
        try {
          const verifierPrompt = visionContent(
            `Construct goal: ${construct.goal}\n\nCode:\n\`\`\`typescript\n${guess}\n\`\`\`\n\nDoes the screenshot show the expected result? Respond with PASS or FAIL: <reason>.`,
            screenshotUrl,
          );
          const verifierResponse = await llmCall(
            openAiApiKey, openAiModel, VERIFIER_SYSTEM, verifierPrompt, 200,
          );
          const trimmed = verifierResponse.trim();
          if (trimmed.startsWith("FAIL")) {
            const reason = trimmed.replace(/^FAIL:?\s*/, "") || "Visual output does not match expected result";
            verifyResult = { pass: false, error: `Visual check: ${reason}` };
          }
          // If verifier says PASS (or anything else), keep regexResult (pass)
        } catch {
          // verifier failure is non-fatal — trust the regex result
        }
      }

      const attempt = {
        guess,
        verifyResult,
        screenshotUrl,
        query: undefined as string | undefined,
        oracleHint: undefined as string | undefined,
      };

      if (verifyResult.pass) {
        trace.attempts.push(attempt);
        emit({ type: "attempt", constructId: construct.id, attempt, attemptNumber: attemptNum });
        currentCode = guess;
        emit({
          type: "code_update",
          code: currentCode,
          files: { [exampleFile]: currentCode },
        });
        solved = true;
        lastScreenshotUrl = undefined;
        break;
      }

      // ── Failed — remember this screenshot for next attempt ─────────
      lastScreenshotUrl = screenshotUrl;

      // ── Query oracle ───────────────────────────────────────────────
      try {
        // Build query prompt — include screenshot if available
        const queryText = `You tried to add this construct: "${construct.goal}"

Your code attempt produced this error:
${verifyResult.error}

Your current code:
${guess}

${screenshotUrl ? "A screenshot of the actual rendered output is attached." : ""}

What specific question would you ask about the Formulize API?`;

        const queryContent = screenshotUrl
          ? visionContent(queryText, screenshotUrl)
          : queryText;

        const question = await llmCall(openAiApiKey, openAiModel, QUERY_SYSTEM, queryContent, 200);

        const oraclePrompt = `The code-writing AI is currently working on:
Goal: ${construct.goal}
Error: ${verifyResult.error}

It has this question:
${question}`;

        const phaseDocs = loadDocs();
        const hint = await llmCall(openAiApiKey, openAiModel, ORACLE_SYSTEM + phaseDocs, oraclePrompt, 500);

        attempt.query = question;
        attempt.oracleHint = hint;
        hintsSoFar.push(hint);
      } catch (err) {
        // oracle failure is non-fatal, just skip the hint
        attempt.query = "Failed to query oracle";
        attempt.oracleHint = err instanceof Error ? err.message : String(err);
      }

      trace.attempts.push(attempt);
      emit({ type: "attempt", constructId: construct.id, attempt, attemptNumber: attemptNum });
    }

    if (solved) {
      trace.status = "success";
      trace.difficulty = trace.attempts.length;
    } else {
      trace.status = "failed";
      trace.difficulty = -1;
    }

    emit({ type: "construct_end", trace });
  }

  emit({ type: "done", constructs: constructs.map((c) => c.id) });
}
