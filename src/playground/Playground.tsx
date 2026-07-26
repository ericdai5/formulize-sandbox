import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import {
  Brain,
  ExternalLink,
  FlaskConical,
  Grid3X3,
  Image as ImageIcon,
  RotateCcw,
  Square,
} from "lucide-react";
import {
  getPlaygroundFiles,
  getSeeds,
  makeFiles,
  type PlaygroundFiles,
} from "./playgroundConfig";
import {
  captureSnapshot,
  ensureSandbox,
  pushFiles,
  type SandboxInfo,
} from "./snapshotClient";
import { SnapshotSidebar, type SnapshotEntry } from "./SnapshotSidebar";
import { getExample } from "../examples";
import { startSimulation } from "../simulation/simulationClient";
import { GrammarHeatmap } from "../simulation/GrammarHeatmap";
import type { ConstructTrace } from "../simulation/types";

const SNAPSHOT_KEY_PREFIXES_TO_CLEAR = [
  "formulize-playground:snapshots:v2:",
  "formulize-playground:snapshots:v3:",
];
const SNAPSHOTS_KEY_PREFIX = "formulize-playground:snapshots:v4:";
const FILES_KEY_PREFIX = "formulize-playground:files:v4:";
const RESIZE_HANDLE_WIDTH = 1;
const MIN_SIDEBAR_WIDTH = 180;
const MIN_PANEL_WIDTH = 320;
const ICON_BUTTON_CLASS =
  "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white";
const ICON_LINK_CLASS =
  "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function beginResizeDrag(
  event: React.PointerEvent<HTMLDivElement>,
  onPointerMove: (event: PointerEvent) => void,
) {
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);

  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";

  const onPointerUp = () => {
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp, { once: true });
}

function filesKey(exampleId: string) {
  return `${FILES_KEY_PREFIX}${exampleId}`;
}

function snapshotsKey(exampleId: string) {
  return `${SNAPSHOTS_KEY_PREFIX}${exampleId}`;
}

function clearStoredSnapshots(exampleId: string) {
  try {
    for (const prefix of SNAPSHOT_KEY_PREFIXES_TO_CLEAR) {
      localStorage.removeItem(`${prefix}${exampleId}`);
    }
  } catch {
    /* ignore */
  }
}

function loadSnapshots(exampleId: string): SnapshotEntry[] {
  clearStoredSnapshots(exampleId);
  try {
    const raw = localStorage.getItem(snapshotsKey(exampleId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SnapshotEntry => {
      return (
        entry &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        typeof entry.label === "string" &&
        typeof entry.description === "string" &&
        typeof entry.takenAt === "number" &&
        typeof entry.pngDataUrl === "string" &&
        entry.files &&
        typeof entry.files === "object"
      );
    });
  } catch {
    return [];
  }
}

function loadInitialFiles(exampleId: string): PlaygroundFiles {
  try {
    const raw = localStorage.getItem(filesKey(exampleId));
    if (raw) return makeFiles(exampleId, JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return makeFiles(exampleId, {});
}

export const Playground: React.FC = () => {
  const { exampleId } = useParams<{ exampleId: string }>();
  const example = exampleId ? getExample(exampleId) : undefined;

  if (!exampleId || !example) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50 text-gray-700">
        <div className="text-center">
          <div className="text-sm mb-3">
            Example {exampleId ? <code>{exampleId}</code> : ""} not found.
          </div>
          <Link to="/" className="text-blue-600 hover:underline text-sm">
            ← Back to menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PlaygroundForExample
      key={exampleId}
      exampleId={exampleId}
      label={example.label}
    />
  );
};

type InnerProps = {
  exampleId: string;
  label: string;
};

const PlaygroundForExample: React.FC<InnerProps> = ({ exampleId, label }) => {
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>(() =>
    loadSnapshots(exampleId),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playgroundFiles = useMemo(
    () => getPlaygroundFiles(exampleId),
    [exampleId],
  );
  const [files, setFiles] = useState<PlaygroundFiles>(() =>
    loadInitialFiles(exampleId),
  );
  const [savedFiles, setSavedFiles] = useState<PlaygroundFiles>(() => files);
  const [saving, setSaving] = useState(false);
  const [activeFile, setActiveFile] = useState<string>(playgroundFiles[0].path);
  const [sandbox, setSandbox] = useState<SandboxInfo | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    null,
  );
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(false);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [editorWidth, setEditorWidth] = useState<number | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  const pageLoadCaptureStartedRef = useRef(false);
  const hasStoredSnapshotsRef = useRef(snapshots.length > 0);
  const snapshotSyncVersionRef = useRef(0);
  const [simulating, setSimulating] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);
  const simAbortRef = useRef<AbortController | null>(null);
  const [simTraces, setSimTraces] = useState<Map<string, ConstructTrace>>(new Map());
  const [activeConstructId, setActiveConstructId] = useState<string | null>(null);
  const [heatmapOpen, setHeatmapOpen] = useState(false);

  const seeds = useMemo(() => getSeeds(exampleId), [exampleId]);

  const captureAndStore = useCallback(
    async (
      snapshotFiles: PlaygroundFiles,
      options: {
        replace?: boolean;
        label?: string;
        description?: string;
        throwOnError?: boolean;
      } = {},
    ): Promise<SnapshotEntry | null> => {
      setBusy(true);
      setError(null);
      try {
        const result = await captureSnapshot(snapshotFiles);
        setSandbox(result);
        const entry: SnapshotEntry = {
          id: result.id,
          label: options.label ?? `edit ${new Date().toLocaleTimeString()}`,
          description: options.description ?? "Manual code edit",
          takenAt: Date.now(),
          pngDataUrl: result.pngDataUrl,
          files: snapshotFiles,
        };
        setSnapshots((prev) => {
          return options.replace ? [entry] : [...prev, entry];
        });
        setSelectedSnapshotId(entry.id);
        // The screenshot endpoint writes files to the sandbox too, so the
        // sandbox is in sync with `snapshotFiles` after a successful snapshot.
        setSavedFiles(snapshotFiles);
        return entry;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        if (options.throwOnError) throw err;
        return null;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // Boot the sandbox once on mount, then push the example's current files so
  // the preview matches what's in the editor. Page-load screenshots are never
  // reused; the local cache is cleared above, then replaced with a fresh PNG.
  useEffect(() => {
    let cancelled = false;
    ensureSandbox()
      .then(async (info) => {
        if (cancelled) return;
        setSandbox(info);
        try {
          const syncedSandbox = await pushFiles(filesRef.current);
          if (!cancelled) setSandbox(syncedSandbox);
          if (!cancelled) setSavedFiles(filesRef.current);
          if (
            !cancelled &&
            !hasStoredSnapshotsRef.current &&
            !pageLoadCaptureStartedRef.current
          ) {
            pageLoadCaptureStartedRef.current = true;
            await captureAndStore(filesRef.current, {
              replace: true,
              label: "Starter",
              description: "Initial playground state",
            });
          }
        } catch (err) {
          console.warn("[playground] initial file sync failed:", err);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setBootError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [captureAndStore]);

  // Persist the in-editor state to localStorage on every change. Pushing to
  // the sandbox is gated on the explicit Save action below.
  useEffect(() => {
    try {
      localStorage.setItem(filesKey(exampleId), JSON.stringify(files));
    } catch {
      /* ignore */
    }
  }, [files, exampleId]);

  useEffect(() => {
    try {
      if (snapshots.length > 0) {
        localStorage.setItem(snapshotsKey(exampleId), JSON.stringify(snapshots));
      } else {
        localStorage.removeItem(snapshotsKey(exampleId));
      }
    } catch {
      /* ignore */
    }
  }, [snapshots, exampleId]);

  // Dev-only escape hatch so headless test scripts can drive the editor.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as {
      __playground_updateAppCode?: (next: string) => void;
      __playground_updateFile?: (path: string, next: string) => void;
    };
    w.__playground_updateAppCode = (next: string) =>
      setFiles((prev) => ({ ...prev, "/App.tsx": next }));
    w.__playground_updateFile = (path, next) =>
      setFiles((prev) => ({ ...prev, [path]: next }));
    return () => {
      delete w.__playground_updateAppCode;
      delete w.__playground_updateFile;
    };
  }, []);

  const handleEditorChange = useCallback(
    (next: string) => {
      setFiles((prev) => ({ ...prev, [activeFile]: next }));
    },
    [activeFile],
  );

  const hasUnsavedChanges = useMemo(() => {
    for (const path of Object.keys(files)) {
      if (files[path] !== savedFiles[path]) return true;
    }
    return false;
  }, [files, savedFiles]);

  const handleSave = useCallback(async () => {
    if (!sandbox) return;
    setSaving(true);
    setError(null);
    try {
      const snapshot = files;
      const syncedSandbox = await pushFiles(snapshot);
      setSandbox(syncedSandbox);
      setSavedFiles(snapshot);
      await captureAndStore(snapshot, {
        label: `edit ${new Date().toLocaleTimeString()}`,
        description: "Saved from editor",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [files, sandbox, captureAndStore]);

  const handleRunSimulation = useCallback(() => {
    if (!sandbox || simulating) return;

    setSimulating(true);
    setSimulationStatus("Starting simulation...");
    setError(null);
    setSnapshots([]);
    setSelectedSnapshotId(null);
    setAnalysisPanelOpen(true);
    setHeatmapOpen(true);
    setSimTraces(new Map());
    setActiveConstructId(null);

    const controller = startSimulation({
      onConstructStart(data) {
        setSimulationStatus(
          `[${data.index + 1}/${data.total}] ${data.phase} > ${data.constructName}`,
        );
        setActiveConstructId(data.constructId);
        // Mark as in_progress in the traces
        setSimTraces((prev) => {
          const next = new Map(prev);
          next.set(data.constructId, {
            constructId: data.constructId,
            constructName: data.constructName,
            phase: data.phase,
            status: "in_progress",
            attempts: [],
            difficulty: -1,
          });
          return next;
        });
      },
      onAttempt(data) {
        const cm = {
          constructId: data.constructId,
          constructName: data.constructId, // will be overwritten below
          phase: "",
          goal: "",
          attemptNumber: data.attemptNumber + 1,
          passed: data.attempt.verifyResult.pass,
          error: data.attempt.verifyResult.error,
          query: data.attempt.query,
          oracleHint: data.attempt.oracleHint,
        };
        // Build a snapshot entry from the attempt
        const entry: SnapshotEntry = {
          id: `sim-${data.constructId}-${data.attemptNumber}`,
          label: `${data.constructId} #${data.attemptNumber + 1}`,
          description: data.constructId,
          takenAt: Date.now(),
          pngDataUrl: data.attempt.screenshotUrl ?? "",
          files: { [`/${exampleId}.tsx`]: data.attempt.guess },
          constructMeta: cm,
        };
        setSnapshots((prev) => [...prev, entry]);
        setSelectedSnapshotId(entry.id);
        // Update the editor to show the latest guess
        setFiles((prev) => ({
          ...prev,
          [`/${exampleId}.tsx`]: data.attempt.guess,
        }));
      },
      onConstructEnd(data) {
        // Update heatmap traces
        setSimTraces((prev) => {
          const next = new Map(prev);
          next.set(data.trace.constructId, data.trace);
          return next;
        });
        setActiveConstructId(null);
        // Patch the last snapshot(s) for this construct with full metadata
        setSnapshots((prev) =>
          prev.map((s) =>
            s.constructMeta?.constructId === data.trace.constructId
              ? {
                  ...s,
                  constructMeta: {
                    ...s.constructMeta!,
                    constructName: data.trace.constructName,
                    phase: data.trace.phase,
                    goal:
                      s.constructMeta!.goal ||
                      `${data.trace.constructName} (${data.trace.phase})`,
                  },
                }
              : s,
          ),
        );
        setSimulationStatus(
          `${data.trace.constructName}: ${data.trace.status} (${data.trace.attempts.length} attempt${data.trace.attempts.length === 1 ? "" : "s"})`,
        );
      },
      onCodeUpdate(data) {
        setFiles((prev) => ({
          ...prev,
          [`/${exampleId}.tsx`]: data.code,
        }));
      },
      onDone() {
        setSimulating(false);
        setActiveConstructId(null);
        setSimulationStatus("Simulation complete");
      },
      onError(message) {
        setError(message);
        setSimulating(false);
        setActiveConstructId(null);
        setSimulationStatus(null);
      },
    });

    simAbortRef.current = controller;
  }, [exampleId, sandbox, simulating]);

  const handleStopSimulation = useCallback(() => {
    simAbortRef.current?.abort();
    setSimulating(false);
    setSimulationStatus(null);
  }, []);

  // Save with Cmd/Ctrl+S.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && sandbox && !saving) handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasUnsavedChanges, sandbox, saving, handleSave]);

  const handleSelect = useCallback(
    async (entry: SnapshotEntry) => {
      const nextFiles = makeFiles(exampleId, entry.files);
      const syncVersion = snapshotSyncVersionRef.current + 1;
      snapshotSyncVersionRef.current = syncVersion;

      setSelectedSnapshotId(entry.id);
      setFiles(nextFiles);

      if (!sandbox) return;

      setPreviewStatus("Loading snapshot...");
      setError(null);
      try {
        const syncedSandbox = await pushFiles(nextFiles);
        if (snapshotSyncVersionRef.current !== syncVersion) return;
        setSandbox(syncedSandbox);
        setSavedFiles(nextFiles);
        setPreviewReloadKey((value) => value + 1);
      } catch (err) {
        if (snapshotSyncVersionRef.current === syncVersion) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (snapshotSyncVersionRef.current === syncVersion) {
          setPreviewStatus(null);
        }
      }
    },
    [exampleId, sandbox],
  );

  const handleDelete = useCallback((id: string) => {
    setSnapshots((prev) => {
      return prev.filter((s) => s.id !== id);
    });
    setSelectedSnapshotId((cur) => (cur === id ? null : cur));
  }, []);

  const selectedSnapshot = useMemo(
    () => snapshots.find((s) => s.id === selectedSnapshotId) ?? null,
    [snapshots, selectedSnapshotId],
  );

  const handleResetSeed = useCallback(async () => {
    if (
      confirm(
        `Reset all editable files to the ${label} starter and clear this code progression?`,
      )
    ) {
      const seedFiles = makeFiles(exampleId, {});
      setFiles(seedFiles);
      setSnapshots([]);
      setSelectedSnapshotId(null);
      clearStoredSnapshots(exampleId);
      await captureAndStore(seedFiles, {
        replace: true,
        label: "Starter",
        description: "Reset to seed files",
      });
    }
  }, [captureAndStore, exampleId, label]);

  const extensions = useMemo(
    () => [javascript({ jsx: true, typescript: true })],
    [],
  );

  const startSidebarResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const layout = layoutRef.current;
      if (!layout) return;

      const rect = layout.getBoundingClientRect();
      const maxSidebarWidth = Math.max(
        MIN_SIDEBAR_WIDTH,
        rect.width - MIN_PANEL_WIDTH * 2 - RESIZE_HANDLE_WIDTH * 2,
      );

      const onPointerMove = (moveEvent: PointerEvent) => {
        const nextSidebarWidth = clamp(
          moveEvent.clientX - rect.left,
          MIN_SIDEBAR_WIDTH,
          maxSidebarWidth,
        );
        const availableMainWidth =
          rect.width - nextSidebarWidth - RESIZE_HANDLE_WIDTH * 2;

        setSidebarWidth(nextSidebarWidth);
        setEditorWidth((current) =>
          current === null
            ? current
            : clamp(
                current,
                MIN_PANEL_WIDTH,
                Math.max(MIN_PANEL_WIDTH, availableMainWidth - MIN_PANEL_WIDTH),
              ),
        );
      };

      beginResizeDrag(event, onPointerMove);
    },
    [],
  );

  const startPreviewResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const layout = layoutRef.current;
      if (!layout) return;

      const rect = layout.getBoundingClientRect();
      const availableMainWidth =
        rect.width - sidebarWidth - RESIZE_HANDLE_WIDTH * 2;
      const minEditorWidth = Math.min(MIN_PANEL_WIDTH, availableMainWidth / 2);
      const maxEditorWidth = Math.max(
        minEditorWidth,
        availableMainWidth - minEditorWidth,
      );
      const startX = event.clientX;
      const startEditorWidth = clamp(
        editorWidth ?? availableMainWidth / 2,
        minEditorWidth,
        maxEditorWidth,
      );

      const onPointerMove = (moveEvent: PointerEvent) => {
        setEditorWidth(
          clamp(
            startEditorWidth + moveEvent.clientX - startX,
            minEditorWidth,
            maxEditorWidth,
          ),
        );
      };

      beginResizeDrag(event, onPointerMove);
    },
    [editorWidth, sidebarWidth],
  );

  return (
    <div className="fixed inset-0 bg-gray-50">
      <div
        ref={layoutRef}
        className="grid h-full min-h-0 overflow-hidden"
        style={{
          gridTemplateColumns: `${sidebarWidth}px ${RESIZE_HANDLE_WIDTH}px minmax(${MIN_PANEL_WIDTH}px, ${
            editorWidth === null ? "1fr" : `${editorWidth}px`
          }) ${RESIZE_HANDLE_WIDTH}px minmax(${MIN_PANEL_WIDTH}px, 1fr)`,
        }}
      >
        <aside className="min-w-0 bg-white flex flex-col min-h-0">
          <div className="flex h-10 items-center justify-between border-b border-slate-200 px-2">
            <Link
              to="/"
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              title="Back to menu"
            >
              ← Menu
            </Link>
            <button
              onClick={handleResetSeed}
              disabled={
                busy ||
                simulating ||
                Boolean(previewStatus) ||
                false ||
                !sandbox
              }
              aria-label="Reset to seed"
              className={ICON_BUTTON_CLASS}
              title="Reset to seed"
            >
              <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="border-b border-slate-200 p-2">
              {simulating ? (
                <button
                  onClick={handleStopSimulation}
                  className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded bg-red-600 px-2 text-xs font-medium text-white hover:bg-red-700"
                  title="Stop simulation"
                >
                  <Square size={14} strokeWidth={2} aria-hidden="true" />
                  <span>Stop Simulation</span>
                </button>
              ) : (
                <button
                  onClick={handleRunSimulation}
                  disabled={
                    !sandbox ||
                    simulating ||
                    busy ||
                    Boolean(previewStatus) ||
                    false
                  }
                  className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  title="Run construct-level learnability simulation"
                >
                  <FlaskConical size={14} strokeWidth={2} aria-hidden="true" />
                  <span>Run Simulation</span>
                </button>
              )}
              {simulationStatus && (
                <div className="mt-1 truncate text-[11px] text-slate-500">
                  {simulationStatus}
                </div>
              )}
            </div>
            <SnapshotSidebar
              snapshots={snapshots}
              selectedId={selectedSnapshotId}
              onSelect={handleSelect}
              onDelete={handleDelete}
            />
          </div>
        </aside>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize snapshot sidebar"
          className="relative cursor-col-resize bg-slate-200 hover:bg-slate-300"
          onPointerDown={startSidebarResize}
          title="Resize snapshot sidebar"
        />

        <div className="min-w-0 flex flex-col min-h-0">
          <div className="flex h-10 items-stretch justify-between bg-slate-50 border-b border-slate-200">
            <div className="flex min-w-0 overflow-hidden">
              {playgroundFiles.map((file) => {
                const dirty = files[file.path] !== seeds[file.path];
                const active = file.path === activeFile;
                return (
                  <button
                    key={file.path}
                    onClick={() => setActiveFile(file.path)}
                    className={`inline-flex h-full flex-shrink-0 items-center border-r border-slate-200 px-4 text-sm ${
                      active
                        ? "bg-white text-gray-900"
                        : "bg-slate-50 text-gray-500 hover:bg-white"
                    }`}
                    title={file.path}
                  >
                    {file.label}
                    {dirty && <span className="ml-1 text-blue-500">•</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-shrink-0 items-center px-2">
              <button
                onClick={handleSave}
                disabled={
                  !hasUnsavedChanges ||
                  saving ||
                  !sandbox ||
                  Boolean(previewStatus) ||
                  false
                }
                className={`px-2 py-0.5 text-xs rounded ${
                  hasUnsavedChanges && sandbox
                    ? "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    : "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed"
                }`}
                title="Push the current code to the preview (⌘S)"
              >
                {saving ? "Saving…" : hasUnsavedChanges ? "Save" : "Saved"}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <CodeMirror
              value={files[activeFile]}
              height="100%"
              theme="light"
              extensions={extensions}
              onChange={handleEditorChange}
              basicSetup={{ lineNumbers: true, foldGutter: true }}
              style={{ height: "100%", fontSize: 13 }}
            />
          </div>
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and preview"
          className="relative cursor-col-resize bg-slate-200 hover:bg-slate-300"
          onPointerDown={startPreviewResize}
          title="Resize editor and preview"
        />

        <div className="min-w-0 bg-white flex flex-col min-h-0">
          <div className="flex h-10 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-2">
            <div
              className={`min-w-0 truncate text-sm ${
                error || bootError ? "text-red-600" : "text-gray-500"
              }`}
              title={error ?? bootError ?? undefined}
            >
              {error ??
                bootError ??
                simulationStatus ??
                previewStatus ??
                (sandbox
                  ? busy
                    ? "Capturing latest version..."
                    : "Preview"
                  : "Starting sandbox...")}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                onClick={() => setHeatmapOpen((open) => !open)}
                aria-label={
                  heatmapOpen ? "Hide grammar heatmap" : "Show grammar heatmap"
                }
                className={`${ICON_BUTTON_CLASS} ${
                  heatmapOpen ? "bg-slate-100 text-slate-800" : ""
                }`}
                title={
                  heatmapOpen ? "Hide grammar heatmap" : "Show grammar heatmap"
                }
              >
                <Grid3X3 size={14} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                onClick={() => setAnalysisPanelOpen((open) => !open)}
                aria-label={
                  analysisPanelOpen ? "Hide UX analysis" : "Show UX analysis"
                }
                className={`${ICON_BUTTON_CLASS} ${
                  analysisPanelOpen ? "bg-slate-100 text-slate-800" : ""
                }`}
                title={
                  analysisPanelOpen ? "Hide UX analysis" : "Show UX analysis"
                }
              >
                <Brain size={14} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                onClick={() => setImageModalOpen(true)}
                disabled={!selectedSnapshot}
                aria-label="View snapshot image"
                className={ICON_BUTTON_CLASS}
                title={
                  selectedSnapshot
                    ? `View image for ${selectedSnapshot.description}`
                    : "Select a snapshot first"
                }
              >
                <ImageIcon size={14} strokeWidth={2} aria-hidden="true" />
              </button>
              <a
                href={sandbox?.previewUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                aria-label="Open preview in new tab"
                aria-disabled={!sandbox}
                onClick={(e) => {
                  if (!sandbox) e.preventDefault();
                }}
                className={`${ICON_LINK_CLASS} ${
                  sandbox
                    ? "text-slate-600 hover:bg-slate-50"
                    : "text-slate-300 cursor-not-allowed"
                }`}
                title={sandbox ? "Open preview in new tab" : "Sandbox not ready"}
              >
                <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="h-full min-w-0">
              {sandbox ? (
                <iframe
                  key={`${sandbox.sandboxId}:${previewReloadKey}`}
                  src={sandbox.previewUrl}
                  title="E2B preview"
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  {bootError ?? "Starting sandbox..."}
                </div>
              )}
            </div>
            {analysisPanelOpen && (
              <div className="absolute bottom-3 right-3 top-3 z-20 w-80 max-w-[45%] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-700 shadow-xl">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-800">
                    {selectedSnapshot?.constructMeta
                      ? "Construct details"
                      : "UX analysis"}
                  </div>
                </div>
                {!selectedSnapshot ? (
                  <div className="text-slate-500">
                    Select a snapshot to view its analysis.
                  </div>
                ) : selectedSnapshot.constructMeta ? (
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium text-slate-800">
                        Construct
                      </div>
                      <div>{selectedSnapshot.constructMeta.constructName}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">Phase</div>
                      <div>{selectedSnapshot.constructMeta.phase}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">Goal</div>
                      <div>{selectedSnapshot.constructMeta.goal}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">Result</div>
                      <div
                        className={
                          selectedSnapshot.constructMeta.passed
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {selectedSnapshot.constructMeta.passed
                          ? `Passed on attempt ${selectedSnapshot.constructMeta.attemptNumber}`
                          : `Failed — ${selectedSnapshot.constructMeta.error}`}
                      </div>
                    </div>
                    {selectedSnapshot.constructMeta.query && (
                      <div>
                        <div className="font-medium text-slate-800">
                          Query to oracle
                        </div>
                        <div className="rounded bg-blue-50 px-2 py-1 text-blue-800">
                          {selectedSnapshot.constructMeta.query}
                        </div>
                      </div>
                    )}
                    {selectedSnapshot.constructMeta.oracleHint && (
                      <div>
                        <div className="font-medium text-slate-800">
                          Oracle hint
                        </div>
                        <div className="rounded bg-amber-50 px-2 py-1 text-amber-800 whitespace-pre-wrap">
                          {selectedSnapshot.constructMeta.oracleHint}
                        </div>
                      </div>
                    )}
                  </div>
                ) : selectedSnapshot.uxAnalysis ? (
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium text-slate-800">Result</div>
                      <div>
                        {selectedSnapshot.uxAnalysis.resultInterpretation}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">
                        Experience
                      </div>
                      <div>{selectedSnapshot.uxAnalysis.userExperience}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">
                        Cognitive dimensions
                      </div>
                      <div>
                        {selectedSnapshot.uxAnalysis.cognitiveDimensions}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">
                        DSL signal
                      </div>
                      <div>{selectedSnapshot.uxAnalysis.dslSignal}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">
                        Next improvement
                      </div>
                      <div>{selectedSnapshot.uxAnalysis.recommendation}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500">
                    Select a simulation snapshot to view construct details.
                  </div>
                )}
              </div>
            )}
            {heatmapOpen && (
              <div className="absolute bottom-3 left-3 top-3 z-20 w-[28rem] max-w-[60%] overflow-y-auto rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-700 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium text-slate-800 text-sm">
                    Grammar Heatmap
                  </div>
                  <button
                    onClick={() => setHeatmapOpen(false)}
                    className="text-slate-400 hover:text-slate-600 px-1"
                    title="Close"
                  >
                    ×
                  </button>
                </div>
                <GrammarHeatmap
                  traces={simTraces}
                  activeConstructId={activeConstructId}
                  onSelectConstruct={(constructId) => {
                    // Find the last snapshot for this construct and select it
                    const match = [...snapshots]
                      .reverse()
                      .find((s) => s.constructMeta?.constructId === constructId);
                    if (match) {
                      setSelectedSnapshotId(match.id);
                      setFiles((prev) => ({ ...prev, ...match.files }));
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {imageModalOpen && selectedSnapshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setImageModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] flex flex-col bg-white rounded-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
              <div className="text-sm font-medium text-gray-800">
                {selectedSnapshot.description}
              </div>
              <button
                onClick={() => setImageModalOpen(false)}
                className="text-gray-500 hover:text-gray-800 px-2"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="overflow-auto p-3">
              <img
                src={selectedSnapshot.pngDataUrl}
                alt={selectedSnapshot.description}
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Playground;
