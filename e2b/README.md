# Formulize Playground · E2B template

The playground runs the user's code in a remote E2B sandbox. Vite (inside the
sandbox) serves the dev server on port 5173; the host project iframes
`https://<sandbox>:5173` and pushes file edits over the E2B SDK.

## One-time setup

1. Sign up at https://e2b.dev and grab an API key.
2. Add it to a `.env` at the repo root (Vite picks this up):

   ```
   E2B_API_KEY=e2b_xxx
   ```

3. Install the E2B CLI and log in:

   ```
   npm i -g @e2b/cli
   e2b auth login
   ```

4. Build the template (this installs all 19 runtime deps and snapshots
   `npm run dev` running on :5173):

   ```
   cd formulize-sandbox
   npm run e2b:build
   ```

   This takes ~1–2 minutes. The script prints the template alias.

5. Add the alias to `.env`:

   ```
   E2B_TEMPLATE=formulize-playground
   ```

## Day-to-day

```
npm run dev
```

Visit `/playground`. The first request to `/api/sandbox` boots a fresh
sandbox (~2 s from the snapshot) and the iframe attaches. CodeMirror edits
are debounced (`SYNC_DEBOUNCE_MS = 400`) and written to
`/home/user/app/src/App.tsx` via `sbx.files.write`; Vite HMR inside the
sandbox does the rest.

## Updating the template

Whenever you change `e2b/project/*` (deps, vite config, scaffolding), rerun
`npm run e2b:build` to publish a new snapshot for the configured
`E2B_TEMPLATE`. The build verifies that `delta-dsl` is installed, and the
Vite plugin rejects stale templates with an actionable rebuild message.
