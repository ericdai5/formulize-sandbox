/**
 * Types for simulation traces — the recorded history of every attempt.
 */

import type { PlaygroundFiles } from "../playground/playgroundConfig";

export interface Attempt {
  /** The code the LLM generated */
  guess: string;
  /** Result of verification */
  verifyResult: { pass: boolean; error?: string };
  /** If failed: the query the LLM asked the oracle */
  query?: string;
  /** If failed: the oracle's response */
  oracleHint?: string;
  /** Screenshot captured after pushing guess to E2B (if available) */
  screenshotUrl?: string;
}

export type ConstructStatus = "pending" | "in_progress" | "success" | "failed" | "skipped";

export interface ConstructTrace {
  constructId: string;
  constructName: string;
  phase: string;
  status: ConstructStatus;
  attempts: Attempt[];
  /** Difficulty score: attempts to succeed, or -1 if failed */
  difficulty: number;
}

export interface SimulationState {
  /** The target example being built up */
  targetExample: string;
  /** Max attempts per construct before marking as failed */
  maxAttempts: number;
  /** Per-construct traces in execution order */
  constructs: ConstructTrace[];
  /** Index of the construct currently being worked on */
  currentConstructIndex: number;
  /** The accumulated code so far */
  currentCode: string;
  /** The files state for the E2B sandbox */
  currentFiles: PlaygroundFiles;
  /** Whether the simulation is running */
  running: boolean;
  /** Whether the simulation has completed all constructs */
  finished: boolean;
  /** Error message if the simulation errored out */
  error?: string;
}

/** Server-sent event types for streaming simulation progress */
export type SimEvent =
  | { type: "construct_start"; constructId: string; constructName: string; phase: string; index: number; total: number }
  | { type: "attempt"; constructId: string; attempt: Attempt; attemptNumber: number }
  | { type: "construct_end"; trace: ConstructTrace }
  | { type: "code_update"; code: string; files: PlaygroundFiles }
  | { type: "done"; constructs: ConstructTrace[] }
  | { type: "error"; message: string };
