/**
 * Vite plugin that backs the playground with an E2B sandbox.
 *
 *   GET  /api/sandbox                 -> { sandboxId, previewUrl }
 *   POST /api/sandbox/files           { files: Record<path, code> } -> { ok }
 *   POST /api/code-snapshots          { instruction, files }         -> { snapshots }
 *   POST /api/snapshot-ux-analysis    { instruction, snapshots }     -> { analyses }
 *   POST /screenshot                  { files }                     -> { id, pngDataUrl }
 *   POST /api/simulation/start        {}                            -> SSE stream of simulation events
 *
 * One sandbox is held per Vite dev process and lazily booted on first request.
 * Playwright is launched lazily on the first /screenshot call.
 *
 * Required env: E2B_API_KEY, E2B_TEMPLATE. LLM generation also requires
 * OPENAI_API_KEY.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { Sandbox, SandboxNotFoundError, NotFoundError } from "e2b";
import { chromium, type Browser, type Page } from "playwright";
import { randomUUID } from "node:crypto";
import { runSimulation } from "./simulation-engine.js";

const VIEWPORT = { width: 1024, height: 720 };
const SCREENSHOT_DEVICE_SCALE_FACTOR = 2;
const SETTLE_MS = 600;
const POST_WRITE_SETTLE_MS = 350;
const CAPTURE_RETRIES = 4;
const CAPTURE_RETRY_DELAY_MS = 900;
const NAV_TIMEOUT_MS = 60_000;
const SANDBOX_TIMEOUT_MS = 30 * 60 * 1000;
const SANDBOX_HEALTHCHECK_TIMEOUT_MS = 5_000;
const SANDBOX_TIMEOUT_REFRESH_BUFFER_MS = 60_000;
const PROJECT_DIR = "/home/user/app";
const DEFAULT_OPENAI_MODEL = "gpt-5.2";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_ANALYSIS_FILE_CHARS = 5_000;

type StoredFiles = Record<string, string>;

type GeneratedSnapshot = {
  description: string;
  files: StoredFiles;
};

type SnapshotAnalysisInput = {
  id: string;
  description: string;
  pngDataUrl: string;
  files: StoredFiles;
};

type SnapshotUxAnalysis = {
  snapshotId: string;
  resultInterpretation: string;
  userExperience: string;
  cognitiveDimensions: string;
  dslSignal: string;
  recommendation: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFiles(input: unknown): StoredFiles {
  if (!input || typeof input !== "object") {
    throw new Error("`files` must be an object");
  }
  const out: StoredFiles = {};
  for (const [path, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string") {
      out[path] = value;
    } else if (value && typeof value === "object" && "code" in value) {
      const code = (value as { code: unknown }).code;
      if (typeof code !== "string") throw new Error(`File ${path} missing code`);
      out[path] = code;
    } else {
      throw new Error(`Unsupported file value for ${path}`);
    }
  }
  return out;
}

function truncateForPrompt(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n/* ...truncated ${value.length - maxChars} chars... */`;
}

function normalizeAnalysisSnapshots(input: unknown): SnapshotAnalysisInput[] {
  if (!Array.isArray(input)) {
    throw new Error("`snapshots` must be an array");
  }
  const snapshots: SnapshotAnalysisInput[] = [];
  for (const [index, raw] of input.entries()) {
    if (!isObject(raw)) {
      throw new Error(`Analysis snapshot ${index + 1} must be an object.`);
    }
    if (typeof raw.id !== "string" || !raw.id.trim()) {
      throw new Error(`Analysis snapshot ${index + 1} missing id.`);
    }
    if (typeof raw.description !== "string") {
      throw new Error(`Analysis snapshot ${index + 1} missing description.`);
    }
    if (
      typeof raw.pngDataUrl !== "string" ||
      !raw.pngDataUrl.startsWith("data:image/")
    ) {
      throw new Error(`Analysis snapshot ${index + 1} missing PNG data URL.`);
    }
    snapshots.push({
      id: raw.id,
      description: raw.description,
      pngDataUrl: raw.pngDataUrl,
      files: normalizeFiles(raw.files),
    });
  }
  if (snapshots.length === 0) {
    throw new Error("At least one snapshot is required for analysis.");
  }
  if (snapshots.length > 8) {
    throw new Error("Too many snapshots to analyze at once.");
  }
  return snapshots;
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractResponseText(data: unknown): string {
  if (isObject(data) && typeof data.output_text === "string") {
    return data.output_text;
  }

  const chunks: string[] = [];
  const output = isObject(data) && Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!isObject(item) || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (!isObject(part)) continue;
      if (typeof part.text === "string") {
        chunks.push(part.text);
      } else if (typeof part.refusal === "string") {
        throw new Error(part.refusal);
      }
    }
  }

  const text = chunks.join("");
  if (!text) throw new Error("OpenAI response did not include output text.");
  return text;
}

function makeSnapshotPlanSchema(filePaths: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["snapshots"],
    properties: {
      snapshots: {
        type: "array",
        description:
          "A chronological sequence of staged code edits. Each item builds on the previous one and moves from early implementation work toward a nearly complete result.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["description", "changedFiles"],
          properties: {
            description: {
              type: "string",
              description:
                "One concise phrase or sentence describing what this snapshot does.",
            },
            changedFiles: {
              type: "array",
              description:
                "Complete new source for each file changed by this stage.",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["path", "content"],
                properties: {
                  path: {
                    type: "string",
                    enum: filePaths,
                  },
                  content: {
                    type: "string",
                    description: "Complete source code for the file.",
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function makeSnapshotAnalysisSchema(snapshotIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["analyses"],
    properties: {
      analyses: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "snapshotId",
            "resultInterpretation",
            "userExperience",
            "cognitiveDimensions",
            "dslSignal",
            "recommendation",
          ],
          properties: {
            snapshotId: {
              type: "string",
              enum: snapshotIds,
            },
            resultInterpretation: {
              type: "string",
              description:
                "What the screenshot appears to show after this edit.",
            },
            userExperience: {
              type: "string",
              description:
                "How a DSL user would likely experience making this edit and seeing this result.",
            },
            cognitiveDimensions: {
              type: "string",
              description:
                "Cognitive-dimensions assessment, such as visibility, viscosity, closeness of mapping, hidden dependencies, error-proneness, and feedback.",
            },
            dslSignal: {
              type: "string",
              description:
                "What this step reveals about the DSL's learnability, expressiveness, or debugging feedback.",
            },
            recommendation: {
              type: "string",
              description:
                "One practical improvement to the DSL, editor, preview, or workflow suggested by this step.",
            },
          },
        },
      },
    },
  };
}

function normalizeGeneratedSnapshots(
  plan: unknown,
  startingFiles: StoredFiles,
): GeneratedSnapshot[] {
  if (!isObject(plan) || !Array.isArray(plan.snapshots)) {
    throw new Error("OpenAI response missing snapshots array.");
  }

  const allowedPaths = new Set(Object.keys(startingFiles));
  const snapshots: GeneratedSnapshot[] = [];
  let currentFiles: StoredFiles = { ...startingFiles };

  for (const [index, rawSnapshot] of plan.snapshots.entries()) {
    if (!isObject(rawSnapshot)) {
      throw new Error(`Snapshot ${index + 1} must be an object.`);
    }
    const description =
      typeof rawSnapshot.description === "string" &&
      rawSnapshot.description.trim()
        ? rawSnapshot.description.trim()
        : "Generated code edit";

    if (!Array.isArray(rawSnapshot.changedFiles)) {
      throw new Error(`Snapshot ${index + 1} missing changedFiles array.`);
    }
    if (rawSnapshot.changedFiles.length === 0) {
      throw new Error(`Snapshot ${index + 1} did not change any files.`);
    }

    const nextFiles = { ...currentFiles };
    for (const rawFile of rawSnapshot.changedFiles) {
      if (!isObject(rawFile)) {
        throw new Error(`Snapshot ${index + 1} has an invalid changed file.`);
      }
      if (typeof rawFile.path !== "string" || !allowedPaths.has(rawFile.path)) {
        throw new Error(
          `Snapshot ${index + 1} tried to edit unsupported file ${String(rawFile.path)}.`,
        );
      }
      if (typeof rawFile.content !== "string") {
        throw new Error(
          `Snapshot ${index + 1} did not provide source for ${rawFile.path}.`,
        );
      }
      nextFiles[rawFile.path] = rawFile.content;
    }

    currentFiles = nextFiles;
    snapshots.push({ description, files: currentFiles });
  }

  if (snapshots.length === 0) {
    throw new Error("OpenAI response did not include any snapshots.");
  }
  if (snapshots.length > 6) {
    throw new Error("OpenAI returned too many snapshots. Try a smaller request.");
  }
  return snapshots;
}

function normalizeSnapshotAnalyses(
  response: unknown,
  snapshotIds: Set<string>,
): SnapshotUxAnalysis[] {
  if (!isObject(response) || !Array.isArray(response.analyses)) {
    throw new Error("OpenAI response missing analyses array.");
  }
  const analyses: SnapshotUxAnalysis[] = [];
  for (const [index, raw] of response.analyses.entries()) {
    if (!isObject(raw)) {
      throw new Error(`Analysis ${index + 1} must be an object.`);
    }
    if (typeof raw.snapshotId !== "string" || !snapshotIds.has(raw.snapshotId)) {
      throw new Error(`Analysis ${index + 1} references an unknown snapshot.`);
    }
    const fields = [
      "resultInterpretation",
      "userExperience",
      "cognitiveDimensions",
      "dslSignal",
      "recommendation",
    ] as const;
    for (const field of fields) {
      if (typeof raw[field] !== "string" || !raw[field].trim()) {
        throw new Error(`Analysis ${index + 1} missing ${field}.`);
      }
    }
    analyses.push({
      snapshotId: raw.snapshotId,
      resultInterpretation: raw.resultInterpretation as string,
      userExperience: raw.userExperience as string,
      cognitiveDimensions: raw.cognitiveDimensions as string,
      dslSignal: raw.dslSignal as string,
      recommendation: raw.recommendation as string,
    });
  }
  return analyses;
}

function buildSnapshotPrompt(instruction: string, files: StoredFiles): string {
  return JSON.stringify(
    {
      instruction,
      filePaths: Object.keys(files),
      currentFiles: files,
      snapshotGuidance:
        "Create 3 to 5 meaningful snapshots unless the request is very small. Do not include an unchanged starter/basic snapshot. Work like a developer learning and using the provided library: first make the smallest useful structural edit, then introduce the core library primitives, then wire data/interactions, then refine the visual behavior. The final snapshot should be an almost-finished product, not a disconnected alternate version. Every snapshot must be a runnable intermediate state and must build directly on the previous snapshot. For each snapshot, write only a simple phrase or one-sentence description of what it does; do not write a separate title.",
    },
    null,
    2,
  );
}

function buildSnapshotAnalysisContent(
  instruction: string,
  snapshots: SnapshotAnalysisInput[],
) {
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: JSON.stringify(
        {
          task:
            "Analyze this DSL editing progression as a simulated user study. For each snapshot, combine the screenshot, the step description, and the current code state. Focus on cognitive dimensions and user experience: what a user would infer, where feedback is clear or confusing, how visible the result of the edit is, whether the DSL mapping feels direct, and what the next product improvement should be.",
          originalInstruction: instruction,
          snapshots: snapshots.map((snapshot, index) => ({
            order: index + 1,
            snapshotId: snapshot.id,
            description: snapshot.description,
            files: Object.fromEntries(
              Object.entries(snapshot.files).map(([path, content]) => [
                path,
                truncateForPrompt(content, MAX_ANALYSIS_FILE_CHARS),
              ]),
            ),
          })),
        },
        null,
        2,
      ),
    },
  ];

  for (const [index, snapshot] of snapshots.entries()) {
    content.push({
      type: "input_text",
      text: `Screenshot for snapshot ${index + 1}. snapshotId=${snapshot.id}. description=${snapshot.description}`,
    });
    content.push({
      type: "input_image",
      image_url: snapshot.pngDataUrl,
      detail: "low",
    });
  }
  return content;
}

// Map the playground's logical paths to their location inside the sandbox.
// We accept any /<filename>.tsx or /<filename>.ts at the top level — the file
// goes into ${PROJECT_DIR}/src/<filename>. The character class disallows path
// separators and `..`, so stray paths can't escape the project dir.
const SAFE_NAME = /^\/([A-Za-z0-9_-]+)\.(tsx?)$/;
function resolveSandboxPath(playgroundPath: string): string | null {
  const m = SAFE_NAME.exec(playgroundPath);
  if (!m) return null;
  return `${PROJECT_DIR}/src/${m[1]}.${m[2]}`;
}

export type E2bPluginOptions = {
  apiKey?: string;
  template?: string;
  openAiApiKey?: string;
  openAiModel?: string;
};

export function e2bPlugin(opts: E2bPluginOptions = {}): Plugin {
  let sandbox: Sandbox | null = null;
  let sandboxPromise: Promise<Sandbox> | null = null;
  let previewUrl: string | null = null;
  let lastSandboxTimeoutRefreshAt = 0;
  let browser: Browser | null = null;
  let page: Page | null = null;
  const apiKey = opts.apiKey ?? process.env.E2B_API_KEY;
  const template = opts.template ?? process.env.E2B_TEMPLATE;
  const openAiApiKey = opts.openAiApiKey ?? process.env.OPENAI_API_KEY;
  const openAiModel =
    opts.openAiModel ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;

  function makePreviewUrl(sbx: Sandbox): string {
    const host = sbx.getHost(5173);
    return host.startsWith("http") ? host : `https://${host}`;
  }

  function rememberSandbox(sbx: Sandbox) {
    previewUrl = makePreviewUrl(sbx);
    sandbox = sbx;
    lastSandboxTimeoutRefreshAt = Date.now();
  }

  function getSandboxInfo(sbx: Sandbox) {
    if (!previewUrl || sandbox?.sandboxId !== sbx.sandboxId) {
      previewUrl = makePreviewUrl(sbx);
    }
    return {
      sandboxId: sbx.sandboxId,
      previewUrl,
    };
  }

  function isSandboxGoneError(err: unknown): boolean {
    if (err instanceof SandboxNotFoundError) return true;
    if (err instanceof NotFoundError) return true;
    if (!(err instanceof Error)) return false;
    return /sandbox .*not found|sandbox not found|not found.*sandbox/i.test(
      err.message,
    );
  }

  async function forgetCachedSandbox(reason: string): Promise<void> {
    if (sandbox) {
      console.warn(`[e2b] discarding cached sandbox ${sandbox.sandboxId}: ${reason}`);
    }
    sandbox = null;
    previewUrl = null;
    lastSandboxTimeoutRefreshAt = 0;
    await resetPage();
  }

  async function validateCachedSandbox(sbx: Sandbox): Promise<boolean> {
    const now = Date.now();
    if (
      now - lastSandboxTimeoutRefreshAt <
      SANDBOX_TIMEOUT_MS - SANDBOX_TIMEOUT_REFRESH_BUFFER_MS
    ) {
      return true;
    }

    try {
      await sbx.setTimeout(SANDBOX_TIMEOUT_MS, {
        requestTimeoutMs: SANDBOX_HEALTHCHECK_TIMEOUT_MS,
      });
      lastSandboxTimeoutRefreshAt = now;
      return true;
    } catch (err) {
      if (isSandboxGoneError(err)) return false;
      throw err;
    }
  }

  async function ensureSandbox(): Promise<Sandbox> {
    if (sandbox) {
      const current = sandbox;
      if (await validateCachedSandbox(current)) return current;
      if (sandbox === current) {
        await forgetCachedSandbox("remote sandbox is no longer running");
      }
    }
    if (sandboxPromise) return sandboxPromise;
    if (!template) {
      throw new Error(
        "E2B_TEMPLATE env var is not set. Build the template via `npx tsx e2b/build.ts` and set E2B_TEMPLATE to the alias.",
      );
    }
    if (!apiKey) {
      throw new Error("E2B_API_KEY env var is not set.");
    }
    sandboxPromise = (async () => {
      const sbx = await Sandbox.create(template, {
        apiKey,
        timeoutMs: SANDBOX_TIMEOUT_MS,
      });
      rememberSandbox(sbx);
      console.log(`[e2b] sandbox ${sbx.sandboxId} booted, preview ${previewUrl}`);
      return sbx;
    })();
    try {
      return await sandboxPromise;
    } finally {
      sandboxPromise = null;
    }
  }

  async function writeFiles(files: StoredFiles): Promise<Sandbox> {
    const sbx = await ensureSandbox();
    const entries = Object.entries(files)
      .map(([k, v]) => {
        const dest = resolveSandboxPath(k);
        return dest ? { path: dest, data: v } : null;
      })
      .filter((e): e is { path: string; data: string } => e !== null);
    if (entries.length === 0) return sbx;
    try {
      await sbx.files.write(entries);
      return sbx;
    } catch (err) {
      if (!isSandboxGoneError(err)) throw err;
      await forgetCachedSandbox("file write reached an expired sandbox");
      const fresh = await ensureSandbox();
      await fresh.files.write(entries);
      return fresh;
    }
  }

  async function ensurePage(): Promise<Page> {
    if (browser && page && !page.isClosed()) return page;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: SCREENSHOT_DEVICE_SCALE_FACTOR,
    });
    page = await context.newPage();
    return page;
  }

  async function resetPage(): Promise<void> {
    try {
      await page?.context().close();
    } catch {
      /* ignore */
    }
    page = null;
  }

  async function captureScreenshot(): Promise<string> {
    if (!previewUrl) throw new Error("preview URL not yet known");

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= CAPTURE_RETRIES; attempt += 1) {
      const p = await ensurePage();
      try {
        await p.goto(previewUrl, {
          waitUntil: "domcontentloaded",
          timeout: NAV_TIMEOUT_MS,
        });

        await p.waitForTimeout(SETTLE_MS);

        const buf = await p.screenshot({ type: "png", fullPage: false });
        return `data:image/png;base64,${buf.toString("base64")}`;
      } catch (err) {
        lastError = err;
        await resetPage();
        if (attempt < CAPTURE_RETRIES) {
          console.warn(
            `[screenshot] navigation attempt ${attempt} failed, retrying:`,
            err instanceof Error ? err.message : err,
          );
          await delay(CAPTURE_RETRY_DELAY_MS);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async function generateCodeSnapshots(
    instruction: string,
    files: StoredFiles,
  ): Promise<GeneratedSnapshot[]> {
    if (!openAiApiKey) {
      throw new Error("OPENAI_API_KEY env var is not set.");
    }
    if (!instruction.trim()) {
      throw new Error("Instruction text is required.");
    }

    const filePaths = Object.keys(files);
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel,
        input: [
          {
            role: "system",
            content:
              "You generate staged React/TypeScript code edits for a visual formula playground. Return only the structured JSON requested. Order snapshots exactly as a careful developer would perform the work: small foundation, library integration, behavior wiring, then near-finished polish. Do not include the unmodified starter as a snapshot. Preserve imports and existing behavior unless the user asks to change them. Only edit the provided file paths. Each snapshot must compile as a standalone intermediate state and must build on the previous snapshot. Describe each snapshot with one simple phrase or sentence, not a title.",
          },
          {
            role: "user",
            content: buildSnapshotPrompt(instruction, files),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "code_snapshot_plan",
            strict: true,
            schema: makeSnapshotPlanSchema(filePaths),
          },
        },
        max_output_tokens: 20_000,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `OpenAI request failed (${response.status}): ${text.slice(0, 1000)}`,
      );
    }

    const responseJson = JSON.parse(text) as unknown;
    const outputText = extractResponseText(responseJson);
    const plan = JSON.parse(outputText) as unknown;
    return normalizeGeneratedSnapshots(plan, files);
  }

  async function analyzeSnapshotUx(
    instruction: string,
    snapshots: SnapshotAnalysisInput[],
  ): Promise<SnapshotUxAnalysis[]> {
    if (!openAiApiKey) {
      throw new Error("OPENAI_API_KEY env var is not set.");
    }

    const snapshotIds = snapshots.map((snapshot) => snapshot.id);
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel,
        input: [
          {
            role: "system",
            content:
              "You are evaluating a domain-specific language tester. You simulate a thoughtful DSL user who edits code, observes the visual result, and reports cognitive-dimensions and user-experience findings. Use the screenshot for each step as visual evidence. Be concise, specific, and product-oriented.",
          },
          {
            role: "user",
            content: buildSnapshotAnalysisContent(instruction, snapshots),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "snapshot_ux_analysis",
            strict: true,
            schema: makeSnapshotAnalysisSchema(snapshotIds),
          },
        },
        max_output_tokens: 8_000,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `OpenAI request failed (${response.status}): ${text.slice(0, 1000)}`,
      );
    }

    const responseJson = JSON.parse(text) as unknown;
    const outputText = extractResponseText(responseJson);
    const analysis = JSON.parse(outputText) as unknown;
    return normalizeSnapshotAnalyses(analysis, new Set(snapshotIds));
  }

  async function shutdown() {
    try {
      await page?.context().close();
    } catch {
      /* ignore */
    }
    try {
      await browser?.close();
    } catch {
      /* ignore */
    }
    page = null;
    browser = null;
    try {
      await sandbox?.kill();
    } catch {
      /* ignore */
    }
    sandbox = null;
    previewUrl = null;
  }

  function sendJson(res: ServerResponse, status: number, body: unknown) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  }

  return {
    name: "formulize-e2b",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        "/api/sandbox/files",
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("method not allowed");
            return;
          }
          try {
            const body = (await readJsonBody(req)) as { files?: unknown };
            const files = normalizeFiles(body.files);
            const sbx = await writeFiles(files);
            sendJson(res, 200, { ok: true, ...getSandboxInfo(sbx) });
          } catch (err) {
            console.error("[e2b] write failed:", err);
            res.statusCode = 500;
            res.end(err instanceof Error ? err.message : String(err));
          }
        },
      );

      server.middlewares.use(
        "/api/sandbox",
        async (req: IncomingMessage, res: ServerResponse) => {
          // Only handle the bare /api/sandbox path; /api/sandbox/files is
          // registered separately above.
          if (req.url && req.url !== "/" && req.url !== "") return;
          try {
            const sbx = await ensureSandbox();
            sendJson(res, 200, getSandboxInfo(sbx));
          } catch (err) {
            console.error("[e2b] sandbox boot failed:", err);
            res.statusCode = 500;
            res.end(err instanceof Error ? err.message : String(err));
          }
        },
      );

      server.middlewares.use(
        "/api/code-snapshots",
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("method not allowed");
            return;
          }
          try {
            const body = (await readJsonBody(req)) as {
              instruction?: unknown;
              files?: unknown;
            };
            const instruction =
              typeof body.instruction === "string" ? body.instruction : "";
            const files = normalizeFiles(body.files);
            const snapshots = await generateCodeSnapshots(instruction, files);
            sendJson(res, 200, { snapshots });
          } catch (err) {
            console.error("[code-snapshots] failed:", err);
            res.statusCode = 500;
            res.end(err instanceof Error ? err.message : String(err));
          }
        },
      );

      server.middlewares.use(
        "/api/snapshot-ux-analysis",
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("method not allowed");
            return;
          }
          try {
            const body = (await readJsonBody(req)) as {
              instruction?: unknown;
              snapshots?: unknown;
            };
            const instruction =
              typeof body.instruction === "string" ? body.instruction : "";
            const snapshots = normalizeAnalysisSnapshots(body.snapshots);
            const analyses = await analyzeSnapshotUx(instruction, snapshots);
            sendJson(res, 200, { analyses });
          } catch (err) {
            console.error("[snapshot-ux-analysis] failed:", err);
            res.statusCode = 500;
            res.end(err instanceof Error ? err.message : String(err));
          }
        },
      );

      server.middlewares.use(
        "/screenshot",
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("method not allowed");
            return;
          }
          try {
            const body = (await readJsonBody(req)) as { files?: unknown };
            const files = normalizeFiles(body.files);
            const sbx = await writeFiles(files);
            await delay(POST_WRITE_SETTLE_MS);
            const id = randomUUID();
            const pngDataUrl = await captureScreenshot();
            sendJson(res, 200, { id, pngDataUrl, ...getSandboxInfo(sbx) });
          } catch (err) {
            console.error("[screenshot] failed:", err);
            res.statusCode = 500;
            res.end(err instanceof Error ? err.message : String(err));
          }
        },
      );

      server.middlewares.use(
        "/api/simulation/start",
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("method not allowed");
            return;
          }
          if (!openAiApiKey) {
            res.statusCode = 500;
            res.end("OPENAI_API_KEY env var is not set.");
            return;
          }

          // SSE setup
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });

          const sendEvent = (data: Record<string, unknown>) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          };

          try {
            await ensureSandbox();

            await runSimulation({
              openAiApiKey,
              openAiModel,
              maxAttempts: 5,
              emit: sendEvent,
              screenshotFn: async (files) => {
                await writeFiles(files);
                await delay(POST_WRITE_SETTLE_MS);
                const pngDataUrl = await captureScreenshot();
                return pngDataUrl;
              },
            });
          } catch (err) {
            sendEvent({
              type: "error",
              message: err instanceof Error ? err.message : String(err),
            });
          } finally {
            res.end();
          }
        },
      );

      server.httpServer?.on("close", () => void shutdown());
      process.once("SIGINT", () => void shutdown().then(() => process.exit(0)));
      process.once("SIGTERM", () => void shutdown().then(() => process.exit(0)));
    },
  };
}
