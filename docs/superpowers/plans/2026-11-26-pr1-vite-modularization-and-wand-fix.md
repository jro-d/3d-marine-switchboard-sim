# PR 1: Vite Modularization, Old Simulator Removal & Step 5/6 Proving Wand Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the 9,172-line `index.html` monolith into modular Vite ES modules, remove the legacy Classic CAD simulator (`marine-hv-simulator-3d.html`, `tools/build-offline.mjs`, Classic CAD UI/mode toggle), fix the Step 5/6 `HV_TESTER` vs `VOLTAGE_TESTER` proving wand bug (with individual `L1`/`L2`/`L3`/`PE` actions), and ensure Express (`server.js`), GitHub Pages (`.github/workflows/pages.yml`), and `npm test` pass cleanly.

**Architecture:** Extract the monolithic inline `<script>` and `<style>` blocks out of `index.html` into clean ES modules under `src/` (`src/sim/`, `src/switchboard/`, `src/game/`, `src/ui/`, `src/main.js`) bundled by Vite (`three` installed locally via npm instead of CDN importmap). Retain the STCW Missions 1–4 engine, interlock rules, `AudioEngine`, PTW/SFT paperwork, Megger readout, and Single-Line Diagram modal, while removing Classic CAD exploded/X-ray/callout/2.5D views and migrating the UI shell to a full-viewport 3D game canvas with floating HUD + slide-out/modal drawers.

**Tech Stack:** Vite, Vanilla ES Modules, Three.js (`three` npm package), Express (`server.js`), Node `node:test` runner, CSS (`design-system/` + `src/styles/`).

**Spec:** [docs/superpowers/specs/2026-11-26-3d-walkable-switchroom-design.md](../specs/2026-11-26-3d-walkable-switchroom-design.md)

## Global Constraints
- Maintain documentation and STCW/IEC rule fidelity (`STCW A-III/6`, `IEC 62271-200 Form 4b`, `IEC 60092-503`, `UK MCA COSWP Ch. 22`).
- Zero `Classic CAD` mode toggle, zero `Explode`/`X-ray`/`Parts` callout UI, zero 2.5D `Faceplate`/`Compartment` stage overrides, zero Training one-click `"Do it"` macro buttons (`actionFn`).
- Standardize active proving wand tool ID as `'HV_TESTER'` (defensively accepting `'VOLTAGE_TESTER'` in `interactTerminal` during transition).
- `server.js` must serve `dist/` in production and pass `server.test.mjs`; `.github/workflows/pages.yml` must build with Vite and stage `dist/` via `tools/build-pages.mjs`.
- All existing and new `node --test` unit tests and `npm run build` / `npm run lint` checks must pass with zero skipped assertions.

## Review Focus
- `interactTerminal(cubId, term)` receives `sim.activeTool === 'VOLTAGE_TESTER'` or `'HV_TESTER'` and still requires `ptp.state === 1` before marking `L1`, `L2`, `L3` tested.
- Individual `Probe L1`, `Probe L2`, `Probe L3` actions appear at HV bays when `doorOpen === true` (replacing the collapsed `probe_all_phases` macro) and correctly transition `ptp.state` from `1` -> `2` once all three phases are tested.
- Opening drawers (Mission Stepper / LOTO, Single-Line Diagram modal, PTW/SFT dialog, Help drawer, PPE/Tools drawer) never breaks WebGL canvas resize or leaves WASD/pointer input stuck while a `<dialog open>` is active.
- Running `node tools/build-pages.mjs _site` after `npm run build` succeeds without `dist/marine-hv-simulator-3d-offline.html` and copies `dist/` assets + `design-system/` cleanly.
- Legacy `marine-hv-simulator-3d.html` and `tools/build-offline.mjs` are deleted and no dangling references remain in `package.json`, `README.md`, or CI scripts.

---

### Task 1: Branch Setup, Package Dependencies & Vite Config

**Files:**
- Modify: `package.json`
- Create: `vite.config.js`
- Test: `node --version && npm run --silent`

**Interfaces:**
- Produces: npm packages `express`, `three`, `vite` installed; `npm run dev`, `npm run build`, `npm run lint`, `npm test` scripts configured.

- [ ] **Step 1: Create PR 1 feature branch and install npm packages**

Run:
```bash
git checkout -b feat/pr1-vite-modularization-wand-fix
npm install three express && npm install -D vite
```
Expected: `node_modules/` created with `three`, `express`, `vite`; `package-lock.json` generated.

- [ ] **Step 2: Configure `vite.config.js` and update `package.json` scripts**

Write `vite.config.js` (`base: './'`, `build.outDir: 'dist'`, `server.port: 5173`) and update `package.json` scripts (`dev`, `start`, `build`, `lint`, `test`).

- [ ] **Step 3: Verify Vite & Node test runner invoke cleanly**

Run: `npx vite --version && node --test game/navigation.test.mjs`
Expected: Vite version printed and 5 navigation tests pass.

---

### Task 2: Extract Simulation Engine (`src/sim/`) & Fix Step 5/6 Proving Wand Bug (TDD)

**Files:**
- Create: `src/sim/audio.js`
- Create: `src/sim/state.js`
- Create: `src/sim/interlocks.js`
- Create: `src/sim/missions.js`
- Create: `src/sim/sim.test.mjs`
- Source: `index.html:1849-3486`

**Interfaces:**
- Produces:
  - `createAudioEngine()` in `src/sim/audio.js`
  - `createSimState()`, `getTopology(sim)`, `bayMetering(sim, cubId, topo)`, `rackPos(turns)`, `isFullPPE(sim)` in `src/sim/state.js`
  - `createSimActions(sim, hooks)` (`pressTripVCB`, `pressCloseVCB`, `rackVCB`, `toggleRackingPadlock`, `toggleCastellVCBLock`, `toggleEarthSwitchKey`, `toggleIntegralEarthSwitch`, `toggleEarthPadlock`, `toggleSafetyKeyBox`, `toggleDoor3D`, `toggleShutterPadlock`, `proveTesterOnUnit`, `interactTerminal`, `connectMegger`, `runMegger`, `dischargeMegger`, `issuePTW`, `cancelPTW`, `issueSFT`, `cancelSFT`, `triggerViolation`, `checkPpe`, `logEvent`) in `src/sim/interlocks.js`
  - `getLotoSteps(sim)` (without `actionFn` macros), `initMission(sim, missionId, mode, hooks)` in `src/sim/missions.js`

- [ ] **Step 1: Write failing unit tests in `src/sim/sim.test.mjs`**

Test:
1. `proveTesterOnUnit()` sets `sim.activeTool === 'HV_TESTER'` and `sim.ptp.state === 1`.
2. `interactTerminal('BT-M1', 'L1' | 'L2' | 'L3')` succeeds when `sim.activeTool` is `'HV_TESTER'` OR `'VOLTAGE_TESTER'` (defensive alias) after proving, advancing `ptp.state` to `2` once all 3 phases are tested, and re-proving advances `ptp.state` to `3` with `ptp.completedCubicles['BT-M1'] === true`.
3. `getLotoSteps(sim)` for Missions 1–4 returns steps with NO `actionFn` property.
4. `interlocks` blocks live racking and live earthing with score deduction (`-5`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/sim/sim.test.mjs`
Expected: FAIL (`Cannot find module './state.js'` / `'./interlocks.js'`).

- [ ] **Step 3: Implement `src/sim/audio.js`, `src/sim/state.js`, `src/sim/interlocks.js`, `src/sim/missions.js`**

Extract pure ES modules with zero DOM globals inside `state.js` / `missions.js` / `interlocks.js` (DOM rendering callbacks injected via `hooks`).

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test src/sim/sim.test.mjs`
Expected: PASS (all cases).

- [ ] **Step 5: Commit Task 2**

```bash
git add src/sim/
git commit -m "feat(sim): extract simulation, interlocks, and missions modules and fix HV_TESTER proving bug"
```

---

### Task 3: Extract 3D Switchboard Builder (`src/switchboard/`) Without Classic Explode/Callout Overhead

**Files:**
- Create: `src/switchboard/materials.js`
- Create: `src/switchboard/textures.js`
- Create: `src/switchboard/hv-bay.js`
- Create: `src/switchboard/lv-bay.js`
- Create: `src/switchboard/switchboard.js`
- Source: `index.html:5134-8150`, `8559-9131`

**Interfaces:**
- Produces:
  - `createSwitchboardMaterials()`, `createBayTextures(...)`
  - `buildSwitchboard(scene, renderer)` returning `{ root, bayModels, allRegisteredMeshes, syncSwitchboard(sim, topo, dt), triggerArcFlashVfx(cubId, reason), triggerInterlockPulse(), getBayWorldBounds() }`

- [ ] **Step 1: Implement `materials.js`, `textures.js`, `hv-bay.js`, `lv-bay.js`, and `switchboard.js`**

Import `THREE`, `RoundedBoxGeometry`, and `mergeGeometries` from `three` / `three/examples/jsm/...`. Remove `explodeVec` / `calloutLayer` / `X-ray` / `partIsolation` dependencies while preserving all 19 sub-assemblies, live meters, mimic panels, relay HMIs, CVI LEDs, vacuum interrupter stroke, shutters, EK6 knives, CME cables, and arc-flash VFX.

- [ ] **Step 2: Syntax-check all `src/switchboard/` modules**

Run: `node --check src/switchboard/materials.js && node --check src/switchboard/textures.js && node --check src/switchboard/hv-bay.js && node --check src/switchboard/lv-bay.js && node --check src/switchboard/switchboard.js`
Expected: Exit code 0.

- [ ] **Step 3: Commit Task 3**

```bash
git add src/switchboard/
git commit -m "feat(switchboard): extract 5-bay 3D switchboard modules from index.html"
```

---

### Task 4: Migrate `game/` to `src/game/` & Split Step 5/6 `L1`–`L3` Proving Actions (TDD)

**Files:**
- Create: `src/game/navigation.js` (migrated from `game/navigation.js`, replacing `probe_all_phases` with individual `probe_L1`, `probe_L2`, `probe_L3`, `probe_PE` actions)
- Create: `src/game/navigation.test.mjs` (updated & expanded)
- Create: `src/game/room.js` (migrated from `game/room.js`)
- Create: `src/game/character.js` (migrated from `game/character.js`)
- Create: `src/game/controller.js` (migrated from `game/controller.js`, using `'HV_TESTER'` everywhere + `probePhase` handler + removing `appMode` Classic CAD toggle)
- Create: `src/game/game.css` (migrated from `game/game.css`, removing `.app-mode-switch` / `body[data-app-mode="classic"]`)
- Delete: `game/` directory once migrated

**Interfaces:**
- Produces:
  - `getStationActions(stationId, sim, topo)` emitting individual `probe_L1`, `probe_L2`, `probe_L3`, and `probe_PE` actions when `cub.doorOpen` is true and `!sim.ptp.completedCubicles[cub.id]`.
  - `initSwitchroomGame(bridge)` driving 1st/3rd-person game mode exclusively.

- [ ] **Step 1: Write failing tests in `src/game/navigation.test.mjs`**

Assert that when `BT-M1` has `doorOpen: true` and `ptp.state === 1`, `getStationActions('bay:BT-M1', sim, topo)` returns separate actions `probe_L1`, `probe_L2`, `probe_L3` (and NO `probe_all_phases`), and marks each `done: true` as `sim.ptp.phasesTested[phase]` becomes `true`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/game/navigation.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement `src/game/*` modules & fix `HV_TESTER` tool ID in `controller.js`**

Migrate `room.js`, `character.js`, `navigation.js`, `controller.js`, `game.css`, and delete legacy `game/` files.

- [ ] **Step 4: Run test to verify pass**

Run: `node --test src/game/navigation.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/game/ && git rm -r game/
git commit -m "feat(game): migrate game modules to src/game and split L1-L3 proving actions"
```

---

### Task 5: Build New Game-Only `index.html`, `src/ui/hud.js`, `src/main.js`, & Remove Old Simulator

**Files:**
- Delete: `marine-hv-simulator-3d.html`
- Delete: `tools/build-offline.mjs`
- Create: `src/styles/app.css` (extracted app CSS minus Classic CAD / callout / 2.5D rules)
- Create: `src/ui/hud.js` (top bar, mission menu, plant telemetry, theme/density/audio, slide-out drawers for LOTO stepper, PPE, Tools/Keys, Megger, Help, PTW/SFT modal, and Single-Line Diagram modal)
- Create: `src/main.js` (Three.js scene, lighting, `RoomEnvironment`, switchboard + game controller render loop)
- Modify: `index.html` (clean Vite entry HTML with SVG sprite icons, slim topbar, full-viewport 3D canvas + drawer/dialog shells, `<script type="module" src="/src/main.js">`)
- Modify: `server.js`, `server.test.mjs`, `tools/build-pages.mjs`, `.github/workflows/pages.yml`, `README.md`, `package.json`

**Interfaces:**
- Produces: Clean Vite-bundled entry `index.html` -> `dist/index.html`; `server.js` serves `dist/` (with fallback to root in dev); `build-pages.mjs` stages `dist/` into `_site/`.

- [ ] **Step 1: Update `server.test.mjs` to test serving the Vite `dist/` build (200 OK for `/` and bundled assets)**

- [ ] **Step 2: Create `src/styles/app.css`, `src/ui/hud.js`, `src/main.js`, and rewrite `index.html`**

Remove `Classic CAD` mode toggle, `Explode`, `X-ray`, `Parts`, `2.5D Faceplate`, `2.5D Compartment`, and `Bay Operator` action buttons; keep `Single-line` modal/drawer, `LOTO Stepper` drawer (without `"Do it"` macro buttons), `PPE` / `Tools & Keys` / `Megger` drawer, `PTW/SFT` modal, and `Help` drawer.

- [ ] **Step 3: Delete `marine-hv-simulator-3d.html` & `tools/build-offline.mjs`, update `server.js`, `tools/build-pages.mjs`, `.github/workflows/pages.yml`, `package.json`, `README.md`**

- [ ] **Step 4: Run full build, lint, pages staging, and all Node tests**

Run:
```bash
npm run lint && npm run build && node tools/build-pages.mjs _site && npm test
```
Expected: All syntax checks pass, Vite builds `dist/` cleanly, `_site/` stages cleanly, and all `node --test` suites pass.

- [ ] **Step 5: Browser smoke verification & commit PR 1**

Start local server, verify in headless browser/Playwright (if available) or via HTTP smoke check that the 3D game boots with zero console errors and Step 5/6 `L1`–`L3` proving works end-to-end. Commit changes cleanly on `feat/pr1-vite-modularization-wand-fix`.
