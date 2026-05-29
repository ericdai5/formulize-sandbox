/**
 * Every testable construct in the Formulize Config API, ordered by dependency.
 *
 * Each construct is a discrete, atomic piece of the grammar that the simulation
 * will ask the AI to figure out one at a time. The `dependsOn` field forms a
 * DAG that the simulation follows forward (and can backtrack along).
 */

export interface Construct {
  /** Unique identifier, e.g. "variables.input-drag" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Which phase this belongs to */
  phase: Phase;
  /** IDs of constructs that must be solved before attempting this one */
  dependsOn: string[];
  /** The goal prompt given to the code-writing LLM */
  goal: string;
  /**
   * Patterns the generated code must match to pass verification.
   * Each entry is [regex-source, flags, error-message].
   * Serializable so the server can run them.
   */
  checks: Array<[string, string, string]>;
}

export type Phase =
  | "basics"
  | "variables"
  | "semantics"
  | "interactivity"
  | "stepping"
  | "visualization"
  | "advanced";

export interface VerifyResult {
  pass: boolean;
  error?: string;
}

/** Run the checks array against code, return first failure or pass */
export function verifyCode(checks: Construct["checks"], code: string): VerifyResult {
  for (const [source, flags, errorMsg] of checks) {
    const regex = new RegExp(source, flags);
    if (!regex.test(code)) {
      return { pass: false, error: errorMsg };
    }
  }
  return { pass: true };
}

// ---------------------------------------------------------------------------
// Construct definitions
// ---------------------------------------------------------------------------

export const CONSTRUCTS: Construct[] = [
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
    goal: 'Render the formula using a <Provider> component that receives the config, with a <Formula> component inside that references the formula by its id.',
    checks: [
      ["<Provider", "", "Must use <Provider> component"],
      ["config\\s*=", "", "Provider must receive a config prop"],
      ["<Formula", "", "Must use <Formula> component"],
      ["id\\s*=\\s*[\"']gravity[\"']", "", 'Formula must reference id "gravity"'],
    ],
  },

  // ── Variables ───────────────────────────────────────────────────────────
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
    name: 'Escaped LaTeX key (\\\\vec{F})',
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

  // ── Semantics ───────────────────────────────────────────────────────────
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

  // ── Interactivity ───────────────────────────────────────────────────────
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

  // ── Stepping ────────────────────────────────────────────────────────────
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

  // ── Visualization ───────────────────────────────────────────────────────
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

  // ── Advanced ────────────────────────────────────────────────────────────
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

/** Build a lookup map */
export const CONSTRUCT_MAP = new Map(CONSTRUCTS.map((c) => [c.id, c]));
