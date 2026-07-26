import { getExampleSource } from "../examples";

export type PlaygroundFiles = Record<string, string>;

export type PlaygroundFile = {
  path: string;
  label: string;
  seed: string;
};

export const MAIN_TSX_SEED = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`;

function appSeedFor(exampleId: string): string {
  return `import Example from "./${exampleId}";

export default function App() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <Example />
    </div>
  );
}
`;
}

// The set of files exposed in the editor for a given example. Order matters —
// the first entry is the default-active tab. Paths are the playground's
// logical paths; the Vite plugin maps them to their location inside the E2B
// sandbox.
export function getPlaygroundFiles(exampleId: string): PlaygroundFile[] {
  const examplePath = `/${exampleId}.tsx`;
  const exampleSource = getExampleSource(exampleId);
  const exampleSeed = exampleSource
    ? exampleSource
    : `// Example "${exampleId}" not found.\nexport default function NotFound() {\n  return <div>not found</div>;\n}\n`;

  return [
    { path: examplePath, label: `${exampleId}.tsx`, seed: exampleSeed },
    { path: "/App.tsx", label: "App.tsx", seed: appSeedFor(exampleId) },
    { path: "/main.tsx", label: "main.tsx", seed: MAIN_TSX_SEED },
  ];
}

export function getSeeds(exampleId: string): PlaygroundFiles {
  const out: PlaygroundFiles = {};
  for (const f of getPlaygroundFiles(exampleId)) out[f.path] = f.seed;
  return out;
}

export function makeFiles(
  exampleId: string,
  files: Partial<PlaygroundFiles> = {},
): PlaygroundFiles {
  const seeds = getSeeds(exampleId);
  const out: PlaygroundFiles = {};
  for (const path of Object.keys(seeds)) {
    out[path] = files[path] ?? seeds[path];
  }
  return out;
}
