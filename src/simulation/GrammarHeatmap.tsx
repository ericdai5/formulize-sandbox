/**
 * BNF grammar heatmap derived from the Formulize TypeScript types.
 *
 * Each production rule token maps to one or more construct IDs.
 * Tokens are colored by simulation state:
 *   - green shades: solved (darker = more attempts needed)
 *   - red shades: failed
 *   - blue pulse: currently being simulated
 *   - gray: not yet attempted
 *
 * Clicking a token selects the corresponding snapshot in the sidebar.
 */

import React from "react";
import type { ConstructTrace } from "./types";

// ---------------------------------------------------------------------------
// BNF grammar structure — derived from the actual TypeScript type definitions
// ---------------------------------------------------------------------------

type Token = {
  /** Display text */
  text: string;
  /** Construct ID this token maps to, if any */
  constructId?: string;
  /** Is this a non-terminal (reference to another production)? */
  nonTerminal?: boolean;
  /** Is this punctuation / keyword? */
  punct?: boolean;
};

type Production = {
  /** Left-hand side non-terminal name */
  name: string;
  /** The right-hand side tokens */
  tokens: Token[];
};

const P = (text: string, punct = false): Token => ({ text, punct });
const NT = (text: string, constructId?: string): Token => ({
  text,
  nonTerminal: true,
  constructId,
});
const C = (text: string, constructId: string): Token => ({
  text,
  constructId,
});

/**
 * The BNF grammar, derived from:
 *   - formula-editor/src/types/environment.ts  → Config / IEnvironment
 *   - formula-editor/src/types/formula.ts      → IFormula
 *   - formula-editor/src/types/variable.ts     → IVariable
 *   - formula-editor/src/types/computation.ts  → ISemantics, ISemanticsContext
 *   - formula-editor/src/types/step.ts         → IStepInput, IView
 *   - formula-editor/src/types/graph2d.ts      → IGraph2D, I2DLine, I2DPoint, IVector
 *   - formula-editor/src/types/graph3d.ts      → IGraph3D, I3DSurface
 *   - formula-editor/src/types/control.ts      → IControls
 */
const GRAMMAR: Production[] = [
  {
    name: "Config",
    tokens: [
      P("{"),
      C("formulas", "config-shape"),
      P(": "),
      NT("IFormula[]", "formula-entry"),
      P(",  "),
      C("variables", "config-shape"),
      P(": "),
      NT("IVariablesUserInput", "variables-basic"),
      P(",  "),
      C("semantics", "config-shape"),
      P(": "),
      NT("ISemantics", "semantics-fn"),
      P(",  "),
      C("stepping", "stepping-enable"),
      P(": boolean,  "),
      C("graph2d", "graph2d-line"),
      P(": "),
      NT("IGraph2D[]"),
      P(",  "),
      C("graph3d", "graph3d-surface"),
      P(": "),
      NT("IGraph3D[]"),
      P(",  "),
      C("controls", "control-slider"),
      P(": "),
      NT("IControls[]"),
      P(",  fontSize: number }"),
    ],
  },
  {
    name: "IFormula",
    tokens: [
      P("{  "),
      C("id", "formula-entry"),
      P(": string,  "),
      C("latex", "formula-entry"),
      P(": string  }"),
    ],
  },
  {
    name: "IVariablesUserInput",
    tokens: [
      P("Record< "),
      C("string", "variables-basic"),
      P(",  "),
      NT("IVariableUserInput"),
      P(" >"),
    ],
  },
  {
    name: "IVariableUserInput",
    tokens: [
      P("{  "),
      C("default", "variables-basic"),
      P(": IValue,  "),
      C("name", "variables-basic"),
      P(": string,  "),
      C("precision", "variables-precision"),
      P(": number,  "),
      C("sigFigs", "variables-precision"),
      P(": number,  "),
      C('input', "input-drag"),
      P(': '),
      C('"drag"', "input-drag"),
      P(" | "),
      C('"inline"', "input-inline"),
      P(",  "),
      C("range", "input-drag"),
      P(": [number, number],  "),
      C("dataType", "datatype-vector"),
      P(': "scalar" | "vector" | "matrix" | "set",  '),
      C("dimensions", "datatype-vector"),
      P(": number[],  "),
      P("...  }"),
    ],
  },
  {
    name: "ISemantics",
    tokens: [
      P("("),
      C("ctx", "semantics-fn"),
      P(": "),
      NT("ISemanticsContext", "semantics-fn"),
      P(") => void"),
    ],
  },
  {
    name: "ISemanticsContext",
    tokens: [
      P("{  "),
      C("vars", "semantics-read"),
      P(": Record<string, any>,  "),
      C("sample", "sample-call"),
      P(": "),
      NT("ISampleFn", "sample-call"),
      P(",  "),
      C("step", "step-call"),
      P(": "),
      NT("IStepFn", "step-call"),
      P(",  "),
      C("latex", "step-latex-helper"),
      P(": "),
      NT("ILatexFn", "step-latex-helper"),
      P("  }"),
    ],
  },
  {
    name: "vars proxy",
    tokens: [
      C("vars.x", "semantics-read"),
      P("  (read),    "),
      C('vars["\\\\vec{F}"]', "semantics-write"),
      P("  (write)"),
    ],
  },
  {
    name: "ISampleFn",
    tokens: [
      P("(id: string,  { "),
      C("x", "sample-call"),
      P(": number,  "),
      C("y", "sample-call"),
      P(": number,  z?: number }) => void"),
    ],
  },
  {
    name: "IStepInput",
    tokens: [
      NT("IView", "step-call"),
      P(" | Record<string, "),
      NT("IView"),
      P(">"),
    ],
  },
  {
    name: "IView",
    tokens: [
      P("{  "),
      C("description", "step-description"),
      P(": string,  "),
      C("labels", "step-call"),
      P(": Record<string, IStepLabelValue>  }"),
    ],
  },
  {
    name: "ILatexFn",
    tokens: [
      P("(value: number) => {  "),
      C("precision", "step-latex-helper"),
      P("(n): string,  "),
      C("sigfigs", "step-latex-helper"),
      P("(n): string  }"),
    ],
  },
  {
    name: "IGraph2D",
    tokens: [
      P("{  id: string,  "),
      C("lines", "graph2d-line"),
      P(": "),
      NT("I2DLine[]", "graph2d-line"),
      P(",  "),
      C("points", "graph2d-point"),
      P(": "),
      NT("I2DPoint[]", "graph2d-point"),
      P(",  "),
      C("vectors", "graph2d-vector"),
      P(": "),
      NT("IVector[]", "graph2d-vector"),
      P(",  ...  }"),
    ],
  },
  {
    name: "I2DLine",
    tokens: [
      P("{  "),
      C("sampleId", "graph2d-line"),
      P(": string,  "),
      C("parameter", "graph2d-line"),
      P(": string,  range?, samples?, color?  }"),
    ],
  },
  {
    name: "I2DPoint",
    tokens: [
      P("{  "),
      C("sampleId", "graph2d-point"),
      P(": string,  color?, size?  }"),
    ],
  },
  {
    name: "IVector",
    tokens: [
      P("{  "),
      C("startSampleId", "graph2d-vector"),
      P(": string,  "),
      C("endSampleId", "graph2d-vector"),
      P(': string,  shape?: "arrow" | "dash" | "point",  ...  }'),
    ],
  },
  {
    name: "IGraph3D",
    tokens: [
      P("{  id: string,  "),
      C("surfaces", "graph3d-surface"),
      P(": "),
      NT("I3DSurface[]", "graph3d-surface"),
      P(",  lines?, points?  }"),
    ],
  },
  {
    name: "I3DSurface",
    tokens: [
      P("{  sampleId: string,  "),
      C("parameters", "graph3d-surface"),
      P(": [string, string],  ranges?, samples?  }"),
    ],
  },
  {
    name: "IControls",
    tokens: [
      P("{  "),
      C('type: "slider"', "control-slider"),
      P(",  "),
      C("variable", "control-slider"),
      P(': string  } | { type: "dropdown" | "checkbox" | "radio" | "button" | "set",  ...  }'),
    ],
  },
  {
    name: "Components",
    tokens: [
      C("<Provider", "provider-formula"),
      P(" config={...}>  "),
      C("<Formula", "provider-formula"),
      P(" id={...} />  "),
      C("<StepControl", "step-control"),
      P(" />  </Provider>"),
    ],
  },
];

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Map difficulty/status to a background color */
function tokenColor(
  constructId: string,
  traces: Map<string, ConstructTrace>,
  activeConstructId: string | null,
): string {
  if (constructId === activeConstructId) {
    return "bg-blue-300 animate-pulse";
  }

  const trace = traces.get(constructId);
  if (!trace) return "bg-slate-200 text-slate-500"; // not attempted

  if (trace.status === "failed") return "bg-red-400 text-white";
  if (trace.status === "in_progress") return "bg-blue-300 animate-pulse text-blue-900";
  if (trace.status !== "success") return "bg-slate-200 text-slate-500";

  // Success — shade by difficulty (attempts)
  if (trace.difficulty <= 1) return "bg-green-300 text-green-900";
  if (trace.difficulty <= 2) return "bg-green-400 text-green-950";
  if (trace.difficulty <= 3) return "bg-yellow-300 text-yellow-900";
  return "bg-orange-400 text-orange-950";
}

type Props = {
  traces: Map<string, ConstructTrace>;
  activeConstructId: string | null;
  onSelectConstruct?: (constructId: string) => void;
};

export const GrammarHeatmap: React.FC<Props> = ({
  traces,
  activeConstructId,
  onSelectConstruct,
}) => {
  return (
    <div className="space-y-1 font-mono text-[11px] leading-5">
      {GRAMMAR.map((production) => (
        <div key={production.name} className="flex flex-wrap items-baseline gap-x-0">
          <span className="font-semibold text-slate-700 mr-1 select-none">
            {production.name}
          </span>
          <span className="text-slate-400 mr-1 select-none">::=</span>
          {production.tokens.map((token, i) => {
            if (token.punct) {
              return (
                <span key={i} className="text-slate-400 whitespace-pre">
                  {token.text}
                </span>
              );
            }

            if (token.constructId) {
              const color = tokenColor(token.constructId, traces, activeConstructId);
              return (
                <button
                  key={i}
                  onClick={() => onSelectConstruct?.(token.constructId!)}
                  className={`rounded px-0.5 cursor-pointer transition-colors ${color} ${
                    token.nonTerminal ? "italic" : ""
                  }`}
                  title={`${token.constructId}${
                    traces.get(token.constructId!)
                      ? ` — ${traces.get(token.constructId!)!.status}` +
                        (traces.get(token.constructId!)!.difficulty > 0
                          ? ` (${traces.get(token.constructId!)!.difficulty} attempts)`
                          : "")
                      : " — pending"
                  }`}
                >
                  {token.text}
                </button>
              );
            }

            // Non-terminal without construct mapping
            return (
              <span
                key={i}
                className={`text-slate-600 ${token.nonTerminal ? "italic" : ""}`}
              >
                {token.text}
              </span>
            );
          })}
        </div>
      ))}
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-200 text-[10px] text-slate-500 font-sans">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded bg-green-300" /> 1 attempt
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded bg-yellow-300" /> 2–3
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded bg-orange-400" /> 4+
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded bg-red-400" /> failed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded bg-blue-300" /> active
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded bg-slate-200" /> pending
        </span>
      </div>
    </div>
  );
};

export default GrammarHeatmap;
