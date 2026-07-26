import React from "react";
import type { PlaygroundFiles } from "./playgroundConfig";
import type { SnapshotUxAnalysis } from "./snapshotClient";

/** Metadata attached to snapshots created by the construct simulation */
export type ConstructMeta = {
  constructId: string;
  constructName: string;
  phase: string;
  goal: string;
  attemptNumber: number;
  passed: boolean;
  error?: string;
  query?: string;
  oracleHint?: string;
};

export type SnapshotEntry = {
  id: string;
  label: string;
  description: string;
  takenAt: number;
  pngDataUrl: string;
  files: PlaygroundFiles;
  uxAnalysis?: SnapshotUxAnalysis;
  /** Present only for simulation-generated snapshots */
  constructMeta?: ConstructMeta;
};

type Props = {
  snapshots: SnapshotEntry[];
  selectedId: string | null;
  onSelect: (entry: SnapshotEntry) => void;
  onDelete: (id: string) => void;
};

const PHASE_BADGE: Record<string, string> = {
  basics: "bg-blue-100 text-blue-700",
  variables: "bg-purple-100 text-purple-700",
  semantics: "bg-amber-100 text-amber-700",
  interactivity: "bg-green-100 text-green-700",
  stepping: "bg-rose-100 text-rose-700",
  visualization: "bg-cyan-100 text-cyan-700",
  advanced: "bg-orange-100 text-orange-700",
};

export const SnapshotSidebar: React.FC<Props> = ({
  snapshots,
  selectedId,
  onSelect,
  onDelete,
}) => {
  if (snapshots.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 p-1">
      {snapshots.map((s) => {
        const active = s.id === selectedId;
        const cm = s.constructMeta;
        return (
          <div
            key={s.id}
            onClick={() => onSelect(s)}
            className={`group flex items-start gap-2 rounded px-2 py-1.5 cursor-pointer ${
              active ? "bg-blue-50" : "hover:bg-gray-50"
            }`}
            title={`${s.description} · ${new Date(s.takenAt).toLocaleTimeString()}`}
          >
            {cm && (
              <span
                className={`mt-0.5 flex-shrink-0 inline-block h-2 w-2 rounded-full ${
                  cm.passed ? "bg-green-500" : "bg-red-400"
                }`}
                title={cm.passed ? "Passed" : cm.error ?? "Failed"}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="whitespace-normal break-words text-xs leading-5 text-slate-700">
                {s.description}
              </div>
              {cm && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className={`text-[9px] px-1 py-px rounded ${PHASE_BADGE[cm.phase] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {cm.phase}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    attempt {cm.attemptNumber}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
              className="flex-shrink-0 px-1 text-xs leading-5 text-gray-400 opacity-0 hover:text-red-500 group-hover:opacity-100"
              title="Delete snapshot"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};
