import type { PlaygroundFiles } from "./playgroundConfig";

export type SandboxInfo = {
  sandboxId: string;
  previewUrl: string;
};

export type SnapshotResponse = {
  id: string;
  pngDataUrl: string;
} & SandboxInfo;

export type GeneratedSnapshot = {
  description: string;
  files: PlaygroundFiles;
};

export type GeneratedSnapshotResponse = {
  snapshots: GeneratedSnapshot[];
};

export type SnapshotUxAnalysis = {
  snapshotId: string;
  resultInterpretation: string;
  userExperience: string;
  cognitiveDimensions: string;
  dslSignal: string;
  recommendation: string;
};

export type SnapshotAnalysisInput = {
  id: string;
  description: string;
  pngDataUrl: string;
  files: PlaygroundFiles;
};

export type SnapshotAnalysisResponse = {
  analyses: SnapshotUxAnalysis[];
};

export async function ensureSandbox(): Promise<SandboxInfo> {
  const res = await fetch("/api/sandbox");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sandbox boot failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function analyzeSnapshotUx(
  instruction: string,
  snapshots: SnapshotAnalysisInput[],
): Promise<SnapshotAnalysisResponse> {
  const res = await fetch("/api/snapshot-ux-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, snapshots }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UX analysis failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function generateCodeSnapshots(
  instruction: string,
  files: PlaygroundFiles,
): Promise<GeneratedSnapshotResponse> {
  const res = await fetch("/api/code-snapshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, files }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Snapshot generation failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function pushFiles(files: PlaygroundFiles): Promise<SandboxInfo> {
  const res = await fetch("/api/sandbox/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`File sync failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function captureSnapshot(
  files: PlaygroundFiles,
): Promise<SnapshotResponse> {
  const res = await fetch("/screenshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Screenshot failed (${res.status}): ${text}`);
  }
  return res.json();
}
