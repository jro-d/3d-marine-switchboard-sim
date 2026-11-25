# 3D Walkable Marine HV Switchroom Game — Design Specification & Roadmap

**Date:** 2026-11-26  
**Repository:** `jro-d/3d-marine-switchboard-sim`  
**Status:** Draft (Pending User Approval)

---

## 1. Intent & Why

Transform the repository from a dual-mode `Classic CAD` + prototype `Play Game` single-file HTML simulator (`index.html`, 9,172 lines) into a dedicated, deeply interactive **3D Walkable Marine 6.6 kV HV Switchroom Game**.

Users must be able to walk naturally around a realistic shipboard switchroom—including behind the switchboard and to a VCB maintenance bay—physically push a VCB withdrawal trolley to extract the heavy Vacuum Circuit Breaker (VCB) completely from its cubicle, troubleshoot the withdrawn VCB and rear bus-ties, and perform every STCW / IEC 62271-200 / COSWP switching, racking, Prove–Test–Prove (`L1`–`L3`), earthing, and PTW action with accurate 3D targeting and aligned hand/tool animations.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Fix Step 5/6 Proving Wand (`L1`–`L3`) Bug:** Resolve the `VOLTAGE_TESTER` vs `HV_TESTER` tool ID mismatch and enable direct 3D targeting of individual `L1`, `L2`, `L3`, and `PE` terminals (plus HUD fallback buttons).
- **Physical VCB Withdrawal & Trolley System:** Replace the `0.10` m in-cubicle racking stroke with a full withdrawal sequence using a pushable VCB service trolley that latches onto cubicle sill rails, extracts the entire VCB cassette, and wheels it aside to a Maintenance Bay—clearing the cubicle interior for `L1`–`L3` probing and exposing the VCB for troubleshooting.
- **Exact Hand-to-Control Precision:** Replace primitive box-limb hardcoded Euler poses with a rigged `.glb` engineer character (`AnimationMixer` + `CCDIKSolver`) and world-space 1st-person hands whose fingertips/tools snap cleanly to named 3D sockets on every button, lever, port, key cylinder, and spout.
- **Surgical Switchboard Remodel & Modularization:** Extract the Three.js switchboard out of `index.html` into clean Vite ES modules, detach the VCB truck onto the trolley transfer rig, remodel the internal spout/shutter/bus-tie compartments for clear access, and upgrade front fascia controls.
- **Rich Marine Switchroom + Rear Aisle:** Expand the surrounding room with a walk-behind rear busbar/bus-tie inspection aisle, VCB Maintenance Workbench, watertight bulkhead door, overhead cable trays/bus-ducts, ventilation trunking, rescue hook, CO2 extinguisher, and PBR lighting.
- **Remove Old 3D Simulator:** Delete `marine-hv-simulator-3d.html`, remove the `Classic CAD` mode toggle, 2.5D Faceplate/Compartment view overrides, Explode/X-ray/callouts, and classic Bay Operator shortcut panel, while retaining the STCW Missions 1–4 engine, interlock rules, AudioEngine, PTW/SFT paperwork, and Single-Line Diagram reference modal.
- **Extend Missions & Add Mission 05:** Update Missions 1–4 to use full VCB trolley withdrawal and individual `L1`–`L3` proving, and add **Mission 05** covering `BT1` bus-tie & withdrawn VCB troubleshooting/maintenance.

### Non-Goals
- Rewriting the entire 5-bay switchboard internals from scratch in external CAD before gameplay works (we remodel surgically and provide clean `.glb` slot overrides).
- Multi-player networking, server-side persistence, or external database backends.
- Full rigid-body physics engine (Rapier/Cannon) for general props—deterministic 2D XZ collision + rail-guided trolley kinematics keep controls crisp and unit-testable.

### Anti-Goals
- **Floating / Misaligned Hands:** Hands must never jab empty air 30 cm away from a button or clip blindly through a closed cubicle door.
- **Macro Shortcuts Bypassing Physical Work:** No single button should teleport-complete `L1`/`L2`/`L3` or vanish the VCB without physical trolley extraction when in the 3D game loop.
- **Broken Static Deploy:** GitHub Pages (`pages.yml`) and local Express (`server.js`) must continue to build and serve cleanly with zero CDN-only fragility.

---

## 3. Confirmed Root Causes in Current Codebase

1. **Step 5/6 Proving Wand (`L1`–`L3`) Failure:**
   - [`game/controller.js`](file:///c:/Users/johnr/OneDrive/Desktop/Project%20Ascend/08-3D-Marine-Switchboard-Sim/game/controller.js#L329-L394) sets `sim.activeTool = 'VOLTAGE_TESTER'` in `proveUnit` and `probePhases`, whereas [`interactTerminal`](file:///c:/Users/johnr/OneDrive/Desktop/Project%20Ascend/08-3D-Marine-Switchboard-Sim/index.html#L3316) in `index.html` checks `if (SIM.activeTool === 'HV_TESTER')`. As a result, probing `L1`–`L3` in Game Mode silently falls through to a generic prompt without marking phases tested.
   - [`index.html`](file:///c:/Users/johnr/OneDrive/Desktop/Project%20Ascend/08-3D-Marine-Switchboard-Sim/index.html#L8526) short-circuits 3D mesh raycasting (`if (window.__HV_GAME_MODE__) return;`), and [`game/controller.js`](file:///c:/Users/johnr/OneDrive/Desktop/Project%20Ascend/08-3D-Marine-Switchboard-Sim/game/controller.js#L683) only raycasts coarse whole-bay boxes (`room.clickProxies`), making `L1`, `L2`, and `L3` meshes unselectable in 3D.
2. **VCB Obstructing Compartment After Rack-Out:**
   - [`index.html`](file:///c:/Users/johnr/OneDrive/Desktop/Project%20Ascend/08-3D-Marine-Switchboard-Sim/index.html#L8560) defines `const RACK_STROKE = 0.10;` (10 cm). The VCB truck never exits the bay, and `SUBSYSTEMS.TC` + children (`SD`, `MF`, `AX`, `EP`, `VI`, `TL`) remain permanently parented inside `bayModels[id]`.
3. **Hand / Movement Desync:**
   - [`game/character.js`](file:///c:/Users/johnr/OneDrive/Desktop/Project%20Ascend/08-3D-Marine-Switchboard-Sim/game/character.js#L384-L528) builds box/cylinder limbs and applies hardcoded Euler rotations from a fixed center-bay anchor (`z: 1.36`), ignoring actual button/lever/spout positions.
4. **Monolithic Coupling & Missing Dependencies:**
   - `index.html` (9,172 lines) embeds styles, state, UI, Three.js switchboard construction, and animation loop in one file; `tools/build-pages.mjs` relies on `dist/marine-hv-simulator-3d-offline.html`.

---

## 4. Architectural Decisions (Approaches & Trade-Offs)

| Domain | Alternatives Considered | Chosen Approach & Rationale |
| :--- | :--- | :--- |
| **3D Modeling Pipeline** | (A) Hybrid Three.js switchgear + `.glb` assets; (B) Full Blender `.glb` switchboard remodel; (C) Pure procedural Three.js | **Hybrid (A):** Retains and surgically upgrades the mechanically accurate Three.js switchgear internals (vacuum interrupters, bellows, live needles, dynamic cables) while adopting rigged Blender `.glb` models via `GLTFLoader` for the engineer, tools, VCB trolley, and room props—with clean `.glb` slot overrides for custom enclosures later. |
| **Camera & Hand Alignment** | (A) Dual 1st-Person precision + 3rd-Person `[V]` with 3D socket IK; (B) 3rd-Person only; (C) 1st-Person only | **Dual Perspective with Socket IK (A):** 1st-Person is optimized for close-up precision work (probing `L1`–`L3`, latching trolley, turning keys) while `[V]` toggles 3rd-Person walk/situational view. Every control exposes a live 3D socket driving `CCDIKSolver` (3rd-person) and world-targeted 1st-person hands. |
| **Control Selection** | (A) Direct 3D part raycasting + HUD fallback; (B) Strict 3D-only; (C) HUD-first | **Direct 3D + HUD Fallback (A):** Hovering/clicking individual 3D parts (Trip `[O]`, Close `[I]`, `L1`–`L3`, `PE`, racking port, EK6 lever, trolley latch) highlights the part and shows a contextual tooltip; proximity HUD retains individual fallback buttons (including separate `Probe L1`, `Probe L2`, `Probe L3` buttons—no collapsed macro). |
| **VCB Withdrawal & Trolley** | (A) Physical pushable trolley + rail latch; (B) Auto-summoned scripted trolley; (C) Built-in floor rails | **Physical Pushable Trolley (A):** Player walks to the parked trolley, grabs/pushes it up to the open cubicle sill, latches guide rails, pulls the full VCB cassette onto the trolley, unlatches, and wheels it to the Maintenance Zone. |
| **Switchboard Remodel** | (A) Surgical remodel & module extraction; (B) Full Blender rebuild; (C) Minimal tweaks | **Surgical Remodel & Extraction (A):** Extract `buildSwitchboard()` out of `index.html`, detach the VCB carriage into a transferable sub-assembly, open up the lower spout & rear compartments, add `L1`/`L2`/`L3`/`PE` spout sockets & labels, and upgrade fascia controls. |
| **Old Simulator Removal** | (A) Remove Classic CAD + legacy HTML, keep STCW/PTW/SLD; (B) Hard purge all drawers/SLD; (C) Keep VCB explode only | **Focused Removal (A):** Delete `marine-hv-simulator-3d.html`, remove `Classic CAD` mode toggle, 2.5D Faceplate/Compartment views, Explode/X-ray/part-chips/callouts, and classic Bay Operator action list. Keep STCW Missions 1–4, interlocks, AudioEngine, PTW/SFT drawers/modals, and Single-Line Diagram reference modal. |
| **Room & Surroundings** | (A) Switchroom + Rear Aisle + Maintenance Bay; (B) Front-only room; (C) Multi-room glass bulkhead | **Switchroom + Rear Aisle + Maintenance Bay (A):** Adds walkable port/starboard corridors around the 5-bay switchboard to a rear maintenance aisle (rear busbar/cable & bus-tie inspection panels) plus a dedicated VCB Maintenance Zone with workbench and diagnostic tester. |
| **Animation System** | (A) Rigged `.glb` (`AnimationMixer`) + `CCDIKSolver` + mechanism tweens; (B) Pure code rig; (C) 100% baked `.glb` clips | **Layered `AnimationMixer` + `CCDIKSolver` + Mechanism Tweens (A):** Smooth locomotion cross-fades layered with runtime IK onto exact control sockets and multi-stage switchgear tweens (latch -> swing, crank -> rack -> shutter cam, trolley docking, wand contact LED). |
| **Tech Stack & Build** | (A) Vite + Modular ES JS + npm `three`; (B) Zero-build importmap; (C) Vite + TypeScript | **Vite + Modular ES JS (A):** Splits `index.html` into clean ES modules under `src/`, bundles `three` (`GLTFLoader`, `CCDIKSolver`, `DRACOLoader`) + `public/models/*.glb`, serves `dist/` from `server.js`, and builds cleanly in GitHub Actions for GitHub Pages. |
| **Missions & Troubleshooting** | (A) Update Missions 1–4 + add Mission 05 (`BT1` & VCB troubleshooting); (B) Missions 1–4 only; (C) Sandbox mode | **Missions 1–4 + Mission 05 (A):** Missions 1–4 integrate VCB trolley withdrawal & individual `L1`–`L3` proving; Mission 05 adds full VCB tulip/interrupter/spring troubleshooting on the trolley + rear bus-tie (`BT1`) inspection & torque verification. |

---

## 5. Detailed System Design

### 5.1 Project Structure (Post-Refactor)
```text
src/
  main.js                  # Entry point, renderer, loop, mode/HUD bootstrap
  sim/
    state.js               # SIM state, topology solver (getTopology), metering
    interlocks.js          # STCW Tier-1 / Tier-2 interlock rules & violation handler
    missions.js            # Missions 1-5 step definitions & LOTO evaluation
    audio.js               # Procedural WebAudio AudioEngine
  switchboard/
    materials.js           # Shared PBR materials & procedural canvas textures
    switchboard.js         # 5-bay assembly, bay layout, rear doors, live sync
    hv-bay.js              # C1-C4 enclosure, spouts, shutters, EK6, sockets registry
    lv-bay.js              # C5 440 V ACB bay + sockets registry
    vcb-cassette.js        # Detachable withdrawable VCB truck (TC/SD/MF/AX/EP/VI/TL)
    trolley.js             # Pushable VCB Withdrawal Trolley kinematics & rail latching
  game/
    navigation.js          # Room bounds, dynamic obstacle AABBs (trolley/doors), stations
    room.js                # Expanded switchroom, rear aisle, props, PBR lighting, decals
    character.js           # GLTF rigged engineer + AnimationMixer + CCDIKSolver + FP rig
    interaction.js         # Per-part 3D raycaster, hover outline, reticle tooltip, action queue
    controller.js          # Game loop, 1st/3rd camera, trolley pushing, HUD orchestration
    game.css               # Game HUD & reticle styles
  ui/
    hud.js                 # Top bar, Mission stepper, PPE/Toolbelt, SLD modal, PTW/SFT forms
public/
  models/                  # Starter CC0 / Blender-exported .glb assets (engineer, trolley, props)
design-system/             # Tokens, fonts, icons (retained)
tools/
  build-pages.mjs          # Updated to stage Vite dist/ for GitHub Pages
server.js                  # Serves dist/ (or Vite dev middleware)
```

### 5.2 Bug Fix: Step 5/6 Proving Wand & Direct 3D `L1`–`L3` Selection
1. **Unify Tool Constants:** Standardize on `HV_TESTER` (and accept legacy alias `'VOLTAGE_TESTER'` defensively during transition, or remove `'VOLTAGE_TESTER'` everywhere in `controller.js` / `navigation.js`).
2. **Individual Phase Probing:**
   - Replace the collapsed `probe_all_phases` macro with individual clickable 3D targets (`L1`, `L2`, `L3`, `PE`) inside the open cubicle—each having a dedicated `Box3`/collider mesh, phase-colored insulator collar, glowing hover highlight, and `3D` floating label (`L1 · 0V` / `L1 · UNTESTED`) once the VCB is withdrawn.
   - Keep individual fallback buttons in the proximity HUD (`Probe L1`, `Probe L2`, `Probe L3`, `Clamp PE`) so keyboard/accessibility users can still trigger each phase cleanly.
3. **Interlock Guard on Door & Probing:**
   - Enforce that the VCB must be at `DISCONNECTED (0/20)` before opening the compartment door, and **extracted onto the VCB trolley** (or clear of the compartment) before the `L1`–`L3` cable spouts & shutters are physically accessible to the proving wand and CME hot-stick.

### 5.3 Physical VCB Withdrawal Trolley & Maintenance Zone
- **STCW Door & EK6 Sequencing (Missions 1–2):** Retain the existing STCW interlock sequence (`Trip [O] -> Rack to DISCONNECTED (0/20) -> Extract Castell Key & Padlock Racking Port -> Close & Padlock EK6 Earth Switch -> Lock Safety Key Box -> Open VCB Compartment Door -> Withdraw VCB onto Trolley -> Probe L1, L2, L3 Cable Spouts & Padlock Red Busbar Shutter -> Issue PTW`). Because the door interlock still requires `earthSwitchClosed === true`, the compartment door opens safely after earthing, and the player must wheel the VCB out onto the trolley to expose unobstructed access to the `L1`–`L3` cable spouts, red upper busbar shutter, and CME attachment points.
- **Missions 3 & 4 Starting State:** `initMission(3)` and `initMission(4)` start mid-isolation with `BT-M1` `doorOpen: true`, `earthSwitchClosed: true`, and the `BT-M1` VCB cassette **already extracted onto the trolley and parked at the Maintenance Bay** (`station:vcb-bench`). Mission 4 ends by wheeling the loaded trolley back, latching onto `BT-M1`, sliding the VCB back into `DISCONNECTED (0/20)`, closing the door, and racking to `SERVICE (20/20)`.
- **Trolley State Machine (per active VCB extraction):**
  1. `PARKED`: Trolley rests in the designated **VCB Trolley Bay** (starboard-forward staging area) with wheel brakes locked (`trolley.brakeLocked = true`).
  2. `PUSHING`: Player walks to the trolley and presses `[E]` / clicks `Grab Trolley` (`player.pushingTrolley = true`). Player movement steers the trolley smoothly in front of the character (`1.05` m ahead), with dynamic AABB collision against room walls, benches, and the switchboard.
  3. `RAIL_ALIGNED`: When pushed within `0.35` m of an open, `DISCONNECTED (0/20)` HV bay (`DG1`, `BT1`, `BT-M1`, `TR1-HV`), floor alignment guides snap green; player triggers `Latch Trolley Rails` -> mechanical rail hooks lock onto the cubicle sill (`trolley.latchedBayId = cubId`).
  4. `EXTRACTED`: Player pulls the VCB cassette (`vcb-cassette.js`) forward along the coupled rails from the cubicle onto the trolley bed (`cassette.mount = 'TROLLEY'`). Bay IP2X red & yellow safety shutters remain closed and padlocked; the cubicle interior (`L1`/`L2`/`L3` spouts, EK6 knives, CTs, bus-tie chamber) is now completely unobstructed.
  5. `MAINTENANCE_PARKED`: Player unlatches the trolley and pushes the loaded trolley to the **VCB Maintenance Workbench** (`station:vcb-bench`), engages wheel brakes, and can inspect/troubleshoot the withdrawn VCB (`VI` vacuum bottles, `TL` tulip fingers, `MF` spring charge, `AX` secondary plug).
- **Reverse Restoration (Mission 04 / Post-Maintenance):** Push loaded trolley back to bay -> Latch rails -> Slide VCB cassette back into `DISCONNECTED (0/20)` cubicle rails -> Unlatch trolley & park aside -> Close door -> Rack to `TEST (10/20)` -> `SERVICE (20/20)`.

### 5.4 Switchboard Surgical Remodel & Rear Access
- **Front Fascia & Ergonomics:** Add distinct 3D recessed/beveled pushbuttons (`Trip [O]`, `Close [I]`), shrouded racking hex port + sliding safety flap, raised EK6 lever handle, hinged door latch lever, and named `Object3D` sockets (`bay.sockets.<controlId>`) returning exact world position + approach normal.
- **Lower Cable Spout & Earth Compartment:** Open up the interior depth behind the VCB bay so removing the VCB reveals:
  - Upper red busbar shutters (`y = 1.20`) with visible padlock hasp.
  - Lower yellow feeder spouts (`y = 0.82`) + clearly separated `L1`, `L2`, `L3` copper cable-termination stabs and `PE` ship hull earth bar (`y = 0.25–0.45`), angled slightly forward for clean line-of-sight and unobstructed wand contact.
- **Rear Switchboard Panels:** Add bolted/latched rear inspection doors (`C1`–`C5` rear panels) along the new rear aisle (`z = -1.65` to `-2.65`), exposing rear 6.6 kV bus-tie (`BT1`) copper links, current transformers (`CT`), cable glands, and torque-check bolts for Mission 05.

### 5.5 Hand-to-Control Precision, `.glb` Skeleton Contract & Animation Architecture
1. **In-Repo Starter `.glb` Assets & Bone Contract:** Generate and bundle clean starter `.glb` models in `public/models/` (`engineer.glb`, `vcb-trolley.glb`, `rescue-hook.glb`, `workbench-tools.glb`) via a reproducible generator script (`tools/generate-models.mjs` using `GLTFExporter` / structured node names) so the project runs out of the box with zero external network asset dependencies. Document the exact humanoid bone names (`Hips`, `Spine`, `Chest`, `Neck`, `Head`, `LeftUpperArm`, `LeftForeArm`, `LeftHand`, `RightUpperArm`, `RightForeArm`, `RightHand`, `LeftThigh`, `LeftShin`, `RightThigh`, `RightShin`) and `AnimationClip` names (`Idle`, `Walk`, `Sprint`, `PushTrolley`) so custom Blender `.glb` exports can drop in seamlessly.
2. **Control Socket Registry:** Every interactable control registers `{ worldTargetFn, approachOffset, lookAtOffset, hand: 'right' | 'left' | 'both', gripPose, animStage }`.
3. **Micro-Positioning Before Action:** When an interaction starts, the character smoothly glides (`0.25` s) to the control's exact `approachOffset` (so `L1` stands slightly port of bay center, `L3` slightly starboard, `tripBtn` at comfortable arm reach `0.58` m from fascia) before starting the arm reach.
4. **Rigged `.glb` + `CCDIKSolver` (3rd Person) & World-Target Solver (1st Person):**
   - `THREE.AnimationMixer` drives locomotion (`Idle`, `Walk`, `Sprint`, `PushTrolley`) with `0.18` s cross-fades.
   - During interactions, `CCDIKSolver` bends the right/left arm chain (`UpperArm -> Forearm -> Hand`) toward the live `worldTarget` vector with an elbow pole target so the gloved hand or held tool tip physically touches the 3D button/spout/key.
   - In 1st Person, `fpRightPivot` / `fpLeftPivot` compute the target relative to `camera.matrixWorldInverse` so the 1st-person hand and tool tip land directly on the aimed 3D socket on screen.
5. **Asset Fallback Safety:** Keep a clean articulated procedural fallback inside `character.js` if a `.glb` fails to load in headless/unit-test environments.

### 5.6 Expanded Shipboard Switchroom Layout
- **Room Bounds:** Expanded from `8.8 m × 7.2 m` to **`10.4 m × 9.6 m`** (`x ∈ [-5.2, 5.2]`, `z ∈ [-2.8, 6.8]`), allowing full circulation around the switchboard (`z ∈ [-0.95, 0.78]`) via port (`x < -2.35`) and starboard (`x > 2.35`) walkways into the **Rear Busbar & Cable Aisle** (`z ∈ [-2.6, -1.0]`).
- **New/Upgraded Room Zones:**
  - **VCB Maintenance & Troubleshooting Bay** (Port-Forward / Side Staging, with Diagnostic Workbench, contact-resistance micro-ohmmeter, and trolley wheel stops).
  - **Watertight Marine Bulkhead Entry Door** (Aft bulkhead, with dogs, porthole, and `6.6 kV HV ROOM` safety placard).
  - **Overhead Infrastructure:** Galvanized steel cable ladder trays rising from top of `C1`–`C5`, 6.6 kV armored feeder conduits, ventilation supply ducting, and recessed marine LED batten fixtures casting realistic shadows/reflections.
  - **Safety Stations:** Wall-mounted insulated **HV Rescue Hook**, **CO2 Fire Extinguisher**, **First-Aid / Burn Kit**, and upgraded **PPE Locker**, **Key Box & Tool Board**, **Proving & 5 kV Megger Bench**, and **Permit Desk**.

---

## 6. Removal Plan for Old 3D Simulator & UI Shell

- **Delete:** `marine-hv-simulator-3d.html`, `tools/build-offline.mjs` (drop the legacy `file://` single-file `offline.html` bundle in favor of standard Vite `dist/` static hosting), and Classic CAD UI sections in `index.html` (`btnAppModeGame` / `btnAppModeClassic` toggle, `Explode` slider & `0/50/100` buttons, `X-ray` toggle, 19-part isolation chips `SK`–`CT`, SVG callout badges, `Faceplate` / `Compartment` 2.5D views, and classic `Bay Operator` command buttons).
- **UI Shell:** Transition to a **full-viewport 3D game canvas** with a slim top bar, floating objective/proximity HUD, and slide-out/modal drawers for the Mission LOTO Stepper, Single-Line Diagram reference, PTW/SFT paperwork, and Megger readout.
- **Training Guidance:** Keep `"Walk to Target"` waypoint guidance in Training Mode, and remove the one-click `"Do it"` auto-complete macro buttons (`actionFn`) from the Mission Stepper so all actions run through physical 3D/station interaction.
- **Retain & Modularize:** `SIM` state & topology solver, Missions 1–4 + new Mission 05, STCW Tier-1 / Tier-2 interlock rules & scoring, `Training` / `Exam` modes, `AudioEngine`, `PTW` / `SFT` formal document modal, `Megger` readout modal, `Single-line` diagram reference modal, and Day/Night/Projector themes.

---

## 7. Multi-Phase PR Roadmap

Each phase produces a self-contained, testable, shippable Pull Request on GitHub:

### Phase 1 (PR 1): Vite Modularization & Removal of Old Simulator
- Scaffold `vite.config.js` + modular `src/` layout; extract `sim/`, `switchboard/`, `game/`, and `ui/` from `index.html`.
- Remove `marine-hv-simulator-3d.html` and all Classic CAD mode UI/logic (`Explode`, `X-ray`, `2.5D Faceplate/Compartment`, callout overlays, mode toggle).
- Fix `HV_TESTER` vs `VOLTAGE_TESTER` mismatch immediately so Step 5/6 works cleanly in the baseline.
- Update `server.js`, `package.json`, `tools/build-pages.mjs`, `.github/workflows/pages.yml`, and `npm test` (`navigation.test.mjs` + `server.test.mjs`).

### Phase 2 (PR 2): Direct 3D Targeting, Surgical Switchboard Remodel & Socket Registry
- Remodel `hv-bay.js` / `lv-bay.js` front fascia controls, lower cable spout compartment, and `L1`/`L2`/`L3`/`PE` lugs with clear spacing and labels.
- Add named `sockets` (`Object3D` world anchors + approach offsets) to every control and terminal on `C1`–`C5`.
- Build `src/game/interaction.js` for per-part 3D raycasting in Game Mode, hover emissive highlight, 1st-person reticle tooltip (`L1`, `L2`, `L3`, `Trip [O]`, etc.), and individual HUD fallback buttons.

### Phase 3 (PR 3): Detachable VCB Cassette & Physical Pushable VCB Trolley
- Refactor `vcb-cassette.js` so the VCB truck detaches cleanly from `hv-bay.js` onto `trolley.js`.
- Implement the physical VCB Withdrawal Trolley (`PARKED -> PUSHING -> RAIL_ALIGNED -> EXTRACTED -> MAINTENANCE_PARKED`) with dynamic collision, rail-latching animation, and bay shutter/interior clearance.
- Update Missions 1–4 LOTO sequences and `getRecommendedTarget()` to require trolley withdrawal before `L1`–`L3` proving and restoration via trolley in Mission 04.

### Phase 4 (PR 4): Expanded Marine Switchroom, Rear Bus-Tie Aisle & `.glb` Environment Props
- Expand `room.js` & `navigation.js` to `10.4 m × 9.6 m` with port/starboard pass-throughs, walkable Rear Busbar/Bus-Tie Aisle, rear openable cabinet panels, and VCB Maintenance Workbench.
- Add watertight bulkhead door, overhead cable trays, ventilation ducts, HV rescue hook, CO2 extinguisher, PBR deck/bulkhead textures, and `.glb` room/trolley props in `public/models/`.

### Phase 5 (PR 5): Rigged `.glb` Engineer, `CCDIKSolver` Hand Alignment & Choreographed Animations
- Integrate rigged humanoid `.glb` character with `THREE.AnimationMixer` (Idle, Walk, Sprint, PushTrolley) and `CCDIKSolver` targeting live `bay.sockets.*` world coordinates.
- Upgrade 1st-person hands/tools to target exact screen/world sockets with micro-positioning before each action.
- Add multi-stage mechanism tweens: door latch + swing, racking crank engagement + truck travel + cam shutters, padlock shackle & Castell key insertion/turn, and proving wand contact LED + piezo pulse.

### Phase 6 (PR 6): Mission 05 (`BT1` Bus-Tie & VCB Troubleshooting) + Polish & Verification
- Add **Mission 05** (`BT1` isolated while `DG1` Bus A stays live behind padlocked Bus-A shutters; `BT1` gains racking/shutter padlock & rear inspection panel gating, treating the rear `BT1` feeder/joint chamber as safe once `BT1` is withdrawn and earthed):
  - Isolate `BT1` (trip, rack to `0/20`, padlock port, open door, withdraw `BT1` VCB onto trolley, prove `L1`–`L3` dead, padlock red Bus-A shutters).
  - Simulated fault diagnosis & repair: inspect `BT1` VCB on the Maintenance Workbench (micro-ohmmeter contact resistance test + inspect worn tulip contact / spring mechanism -> clean/replace faulted contact), then walk the rear aisle to open `BT1` rear panel, diagnose under-torqued bus-tie bolt, and torque to spec before restoring `BT1` to `SERVICE`.
- End-to-end automated Node + Playwright WebGL smoke verification across all 5 missions, audio/theme polish, and documentation update.

---

## 8. Builder Calls Made (Defaults Chosen Within Scope)
- **Full-Viewport HUD + Drawers:** Transitioned from the 3-column desktop dock to a full-viewport 3D canvas with floating HUD and slide-out/modal drawers.
- **Deterministic 2D XZ + Rail Kinematics:** Used deterministic XZ circle-vs-AABB collision and rail-coupled trolley kinematics instead of a heavy rigid-body physics engine so navigation and trolley alignment stay crisp and unit-testable in Node.
- **Defensive Tool Alias:** Standardized on `HV_TESTER` while guarding `VOLTAGE_TESTER` during transition if any state fixture references it.
- **Procedural Character Fallback:** Kept an articulated code fallback in `character.js` when running in headless tests without WebGL/asset fetch.

---

## 9. Verification Strategy
- **Unit Tests (`node --test`):** Pure logic coverage for `navigation.js` (expanded room + rear aisle bounds, dynamic trolley collision), `trolley.js` state transitions, `missions.js` (Missions 1–5 step progression), and `interlocks.js` (`HV_TESTER` proving sequence & trolley withdrawal interlocks).
- **Build & Static Staging Check:** `npm run build` (Vite bundle) + `node tools/build-pages.mjs _site` + `server.test.mjs` serving `dist/`.
- **Browser / WebGL Smoke Verification:** Automated headless check confirming zero console/page errors, `L1`/`L2`/`L3` individual 3D selection, trolley extraction + movement, IK socket alignment, and Mission 01 & Mission 05 completion.
