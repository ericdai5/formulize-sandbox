/**
 * Client-side API for starting a simulation and consuming the SSE stream.
 */

import type { Attempt, ConstructTrace } from "./types";
import type { PlaygroundFiles } from "../playground/playgroundConfig";

export type SimEventHandler = {
  onConstructStart?: (data: {
    constructId: string;
    constructName: string;
    phase: string;
    index: number;
    total: number;
  }) => void;
  onAttempt?: (data: {
    constructId: string;
    attempt: Attempt;
    attemptNumber: number;
  }) => void;
  onConstructEnd?: (data: { trace: ConstructTrace }) => void;
  onCodeUpdate?: (data: { code: string; files: PlaygroundFiles }) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

/**
 * Start the simulation. Returns an AbortController so the caller can cancel.
 */
export function startSimulation(handlers: SimEventHandler): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch("/api/simulation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        handlers.onError?.(`Simulation start failed (${res.status}): ${text}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        handlers.onError?.("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE: lines starting with "data: "
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          if (!json) continue;

          try {
            const event = JSON.parse(json);
            switch (event.type) {
              case "construct_start":
                handlers.onConstructStart?.(event);
                break;
              case "attempt":
                handlers.onAttempt?.(event);
                break;
              case "construct_end":
                handlers.onConstructEnd?.(event);
                break;
              case "code_update":
                handlers.onCodeUpdate?.(event);
                break;
              case "done":
                handlers.onDone?.();
                break;
              case "error":
                handlers.onError?.(event.message);
                break;
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        handlers.onError?.(err instanceof Error ? err.message : String(err));
      }
    }
  })();

  return controller;
}
