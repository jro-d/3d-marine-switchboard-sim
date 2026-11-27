# 3D Model & Texture Upgrade Plan — Blender 5.3 MCP $\rightarrow$ Godot 4.7 + Rust

**Project:** Marine HV 6.6 kV Switchboard Simulator (`08-3D-Marine-Switchboard-Sim`)  
**Target Output:** Standalone Windows `.exe` built with **Godot 4.7.2 + Rust (`gdext`)** *(web/HTML version dropped)*  
**Authoring Workflow:**
1. User generates & saves finalized multi-view reference sheets into `assets-src/references/` (using [REFERENCE_IMAGE_PROMPTS.md](file:///c:/Users/johnr/OneDrive/Desktop/Project%20Ascend/08-3D-Marine-Switchboard-Sim/docs/REFERENCE_IMAGE_PROMPTS.md)).
2. Antigravity inspects the reference sheet (`read_file`), models/upgrades assets live in **Blender 5.3.0** via **Blender MCP** (while user monitors the open Blender viewport), saves `.blend` to `assets-src/blender/`, and exports **uncompressed `.glb`** directly to `godot/assets/models/`.
3. Antigravity wires `.glb` assets into Godot 4.7.2 inherited scenes (`.tscn`) and Rust (`HvSimCore`) bindings, then verifies headlessly—**no backtracking between phases**.

---

## 1. Diagnosis: Why Current Textures Look Harsh, Grainy & Over-Metallic

Auditing `tools/blender/build_room_props.py`, `tools/blender/build_engineer.py`, `tools/blender/common_pbr.py`, and `src/switchboard/materials.js` reveals four root causes:

1. **128×128 Random-Noise Normal Maps:** `PropPowderNormal`, `PropBrushedNormal`, `PropWoodNormal`, `PropEsdNormal`, `EngineerTwillNormal`, `EngineerLeatherNormal`, and `EngineerHiVisNormal` are generated as 128×128 Gaussian noise with strong Sobel filtering (`1.20–1.50`) and tiled `4×–20×`. This produces blocky high-frequency specular grain across every cabinet, workbench, and uniform.
2. **Painted Steel Set Too Metallic:** Painted cabinets and structural frames use `metallic = 0.28–0.62` (`MarineTealCabinet`, `IndustrialSteelDark`, `IndustrialSteelMid`, `SafetyRedEnamel`). Physically, powder-coated paint is **dielectric (`metallic = 0.0–0.04`)**. Mixing high metallic with noisy normal maps creates harsh grainy metal reflections.
3. **Unbaked Procedural Shader Noise:** `common_pbr.py` uses `ShaderNodeTexNoise` $\rightarrow$ `ShaderNodeBump`, which adds viewport grain and does not export cleanly to `.glb` / Godot.
4. **Over-Reliance on Bump Noise Instead of Edge Shading:** Clean industrial surfaces look best with chamfered bevels + `WeightedNormal`, accurate dielectric vs. metallic separation, and subtle smooth roughness rather than pixel-level bump noise.

---

## 2. Complete Inventory of All Current Models in the Project

### A. Existing Blender-Authored `.glb` Models (`public/models/*.glb`, 12 files)
| Model File | Source `.blend` / Script | Contained Sub-Objects / Dynamic Nodes | Target Phase |
| :--- | :--- | :--- | :--- |
| `vcb-trolley.glb` | `trolley_and_tools.blend` | `VcbTrolleyFrame`, `TrolleyWheel_0..3`, `TrolleyLatchHook_L/R`, `TrolleyBrakePedals` | **Phase 2** |
| `workbench-tools.glb` | `trolley_and_tools.blend` | `WorkbenchToolsAssembly` (DLRO 100A, VDE torque wrench, multimeter, 12-finger copper tulip cluster) | **Phase 4** |
| `watertight-door.glb` | `trolley_and_tools.blend` | `WatertightDoorAssembly` (coaming sill, EPDM gasket, door leaf, brass porthole, 3 hinges, 6 dogging handles, 4-spoke handwheel) | **Phase 3** |
| `co2-extinguisher.glb` | `trolley_and_tools.blend` | `CO2ExtinguisherAssembly` (wall cradle, red cylinder, brass valve/pin/trigger, hose, flared horn) | **Phase 3** |
| `rescue-hook.glb` | `trolley_and_tools.blend` | `HVRescueHookAssembly` (yellow shadow-board, spring clips, 45 kV pole, hand-guard, shepherd's crook) | **Phase 3** |
| `ppe-locker.glb` | `room_props.blend` | `PpeLockerCabinet`, `PpeLockerSuit` (arc coat + hood + visor), `PpeLockerGloves` (Class 2 gloves), `PpeLockerBoots` (overboots + rolled 15 kV mat) | **Phase 4** |
| `permit-desk.glb` | `room_props.blend` | `PermitDeskAssembly` (desk, hardwood top, PTW binder, SFT clipboard, pen, intercom, cup/mug, beacon mast) | **Phase 4** |
| `test-bench.glb` | `room_props.blend` | `TestBenchAssembly` (frame, Pelican case, lead drum, ESD mat, power strip, 6.6 kV proving unit, 5 kV Megger + leads, resting proving wand) | **Phase 4** |
| `key-board.glb` | `room_props.blend` | `KeyBoardAssembly` (bench, pegboard, red LOTO lockbox, 6 padlocks, 6 brass Castell keys, wall racking crank, earth stick, danger tags) | **Phase 4** |
| `vcb-workbench.glb` | `room_props.blend` | `VcbWorkbenchAssembly` (frame, red 3-drawer chest, spare crate, ESD mat, overhead LED hood, 4 wrenches, 5 parts bins) | **Phase 4** |
| `room-architecture.glb` | `room_props.blend` | `RoomArchitectureDetails` (baseboards, beam gussets, 9 LED luminaires, CO₂/air pipes, junction boxes, gauge, first-aid cabinet, 2 trolley stops) | **Phase 3** |
| `engineer.glb` | `engineer.blend` | `EngineerBody`, `EngineerLeft/RightBareHand`, `EngineerLeft/RightHvGlove`, `EngineerHardHat`, `EngineerArcSuitCoat`, `EngineerArcHood`, `EngineerLeft/RightHvSole` + Armature & 4 clips (`Idle`, `Walk`, `Sprint`, `Interact`) | **Phase 5** |

### B. Currently Procedural Three.js Models (`src/`, Must Be Modeled for Godot)
| Component | Current JS Source | Required Blender / Godot Assets | Target Phase |
| :--- | :--- | :--- | :--- |
| **6.6 kV HV Bays (×4: `DG1`, `BT1`, `BT-M1`, `TR1-HV`)** | `src/switchboard/hv-bay.js` | Modular HV bay enclosure, hinged LV relay door (IED, mimic, pilot lamps, Castell lock), hinged breaker door (window, earthing lever, racking shutter), rear busbar/CT/cable chamber | **Phase 1** |
| **VCB Cassette (×4)** | `src/switchboard/vcb-cassette.js` | Drawout wheeled truck, lead-screw, 3 cast-epoxy poles, vacuum bottles, upper/lower copper tulip clusters, front flags | **Phase 1** |
| **440V LV ACB Bay (`ACB-TR1-LV`)** | `src/switchboard/lv-bay.js` | LV switchgear enclosure, metering fascia, drawout ACB front unit, lower feeder door | **Phase 1** |
| **Dielectric Floor Mat & Proving Wand** | `src/switchboard/switchboard.js` | Unrolled 15 kV dielectric floor mat (`dielectric-mat.glb`), standalone proving wand, Godot arc-flash VFX | **Phase 2** |
| **Handheld Toolbelt Props (×7)** | `src/game/character.js` | `racking_handle`, `castell_key`, `padlock`, `proving_wand`, `megger_leads`, `cme_stick`, `ptw_clipboard` | **Phase 2** |
| **Switchroom Structural Shell** | `src/game/room.js` | Checkerplate deck floor, bulkhead walls + T-bar stiffeners, zone signs, overhead cable ladder trays + 6.6 kV feeders + MCTs, HVAC trunking + grilles | **Phase 3** |

---

## 3. Global Blender $\rightarrow$ Godot 4.7 Material & Export Rules

Enforced across **every phase** before exporting any `.glb`:

1. **Clean Non-Grainy PBR Material Targets:**
   * **Painted / Powder-Coated Steel** (switchgear panels, teal locker, yellow trolley, red extinguisher, frames): `Metallic = 0.0`, `Roughness = 0.38–0.46`, `Coat Weight = 0.10–0.20`, **zero 128px normal noise maps**.
   * **Bare / Machined Metals** (stainless handles/rails, copper busbars/tulips, brass keys/valves, chrome piston): `Metallic = 0.90–1.0`, `Roughness = 0.18–0.32`, no speckled bump noise.
   * **Textiles / Rubber / Leather** (Nomex suit, ESD mat, EPDM gaskets, boots, gloves): `Metallic = 0.0`, `Roughness = 0.55–0.85`, smooth shading without gritty noise.
   * **Glass / Visors:** `Alpha` enabled (`BLEND`), `Roughness = 0.05–0.08`, `Coat Weight = 0.8–1.0`.
2. **Scale, Axes & Pivots:**
   * `1 Blender unit = 1 meter`. Apply All Transforms (`Ctrl+A`) on all non-rigged meshes.
   * Model forward facing `-Y` in Blender (`+Y Up` on glTF export $\rightarrow$ `-Z` forward in Godot).
   * Every moving part (doors, wheels, latches, handwheel, racking lever, VCB truck) must have its origin placed directly on its physical hinge/axle.
3. **Uncompressed `.glb` Export for Godot:**
   * **Draco compression MUST be OFF** (`export_draco_mesh_compression_enable=False`) so Godot 4.7 imports natively.
   * Save source `.blend` to `assets-src/blender/` and export `.glb` to `godot/assets/models/`.
   * In Godot, wrap every imported `.glb` in a **New Inherited Scene (`.tscn`)** inside `godot/scenes/` so future Blender re-exports never overwrite scripts, colliders, or Rust bindings.

---

## 4. Sequential Phase Plan (No Backtracking)

### Phase 0 — Clean Master Material Library & Blender Workspace Setup *(No Reference Upload Needed)*
* **Goal:** Establish shared clean materials and Godot folder layout once so Phases 1–5 inherit identical non-grainy shaders and naming conventions.
* **Tasks:**
  1. Create `assets-src/references/` and `assets-src/blender/master_materials.blend` containing the clean PBR material library (RAL 7035 satin grey, marine slate, marine teal, safety yellow/red/green, dielectric orange, copper, brushed stainless, machined brass, matte Nomex, ESD green, smooth EPDM rubber, clear polycarbonate, emerald visor).
  2. Create Godot inherited-scene folders: `godot/scenes/switchboard/`, `godot/scenes/props/`, `godot/scenes/room/`, `godot/scenes/character/`, `godot/assets/models/`.
* **Verification Checklist (Phase 0):**
  * [x] `assets-src/blender/master_materials.blend` contains zero `128×128` noise normal maps and zero `metallic > 0.05` values on painted materials.
  * [x] `godot/assets/models/` and `godot/scenes/*/` directories exist and `Godot_v4.7.2-stable_win64_console.exe --headless --path godot --quit-after 2` exits with code `0`.

---

### Phase 1 — Hero Assets: 6.6 kV HV Bays, VCB Cassette & 440V LV ACB Bay
* **User Reference Upload Gate (Upload BEFORE Modeling):**
  * `assets-src/references/ref-01-hv-switchboard-bay.jpg`
  * `assets-src/references/ref-02-vcb-cassette.jpg`
  * `assets-src/references/ref-03-lv-acb-bay.jpg`
* **Tasks:**
  1. Antigravity inspects `ref-01..03`, models clean modular assemblies in Blender 5.3 via MCP while user monitors live viewport:
     * `hv-bay-enclosure.glb` (separate pivoted `LvDoorPivot`, `BreakerDoorPivot`, `EarthingLeverPivot`, `RackingShutterPivot`, `CastellKeySlot`, `RearBusbarChamber`, and socket empties for meters/lamps/terminals).
     * `vcb-cassette.glb` (chassis, brass lead-screw, 3 cast-epoxy poles, vacuum bottles, 6 copper tulip clusters, mechanical status flags).
     * `lv-bay-acb.glb` (LV enclosure + drawout ACB unit + metering fascia).
  2. Save `.blend` files (`switchboard_bays.blend`, `vcb_cassette.blend`) and export uncompressed `.glb` files to `godot/assets/models/`.
  3. Create Godot inherited scenes (`hv_bay.tscn`, `vcb_cassette.tscn`, `lv_bay.tscn`, `switchboard_lineup.tscn` placing `DG1`, `BT1`, `BT-M1`, `TR1-HV`, `ACB-TR1-LV` at exact bay spacings) and connect door/racking/interlock hooks to Rust `HvSimCore`.
* **Verification Checklist (Phase 1):**
  * [x] Reference images (`ref-01`, `ref-02`, `ref-03`) visually matched against Blender viewport screenshots (`phase1_bays_preview.png` & `phase1_vcb_preview.png`).
  * [x] Zero harsh grainy textures; satin RAL 7035 steel panels have `metallic = 0.0` and crisp bevel highlights.
  * [x] All hinges (`LvDoorPivot`, `BreakerDoorPivot`, `LvUpperDoorPivot`, `LvLowerDoorPivot`) and `VcbCassette` rail mounts verified in Godot.
  * [x] `godot --headless --path godot --quit-after 2` loads `switchboard_lineup.tscn` with all 5 bays (`DG1`, `BT1`, `BT-M1`, `TR1-HV`, `ACB-TR1-LV`) and zero errors.

---

### Phase 2 — VCB Withdrawal Trolley, Dielectric Mat & Handheld Toolbelt Kit
* **User Reference Upload Gate (Upload BEFORE Modeling):**
  * `assets-src/references/ref-04-vcb-trolley.jpg`
  * `assets-src/references/ref-05-handheld-tools.jpg`
* **Tasks:**
  1. Antigravity inspects `ref-04` and upgrades `vcb-trolley.glb` in Blender 5.3 via MCP (clean satin yellow/slate chassis, machined stainless guide rails aligned to `hv-bay` rail height, preserved node pivots `TrolleyWheel_0..3`, `TrolleyLatchHook_L/R`, `TrolleyBrakePedals`, plus VCB bed anchor).
  2. Antigravity inspects `ref-05` and builds the 7 handheld tools + switchboard floor mat (`proving-wand.glb`, `racking-crank.glb`, `castell-key.glb`, `loto-padlock.glb`, `cme-earth-lead.glb`, `megger-probes.glb`, `ptw-clipboard.glb`, `dielectric-mat.glb`) with clean grip/tip anchor empties.
  3. Save `.blend` (`trolley_and_tools.blend`) and export uncompressed `.glb` files to `godot/assets/models/`.
  4. Build Godot inherited scenes (`vcb_trolley.tscn`, `toolbelt_props.tscn`, `dielectric_mat.tscn`) and verify trolley rail alignment against `hv_bay.tscn`.
* **Verification Checklist (Phase 2):**
  * [x] `ref-04` & `ref-05` matched visually via Blender MCP screenshots (`phase2_trolley_preview.png`, `phase2_tools_preview.png`).
  * [x] `TrolleyWheel_0..3` spin cleanly on local axle origins; `TrolleyLatchHook_L/R` align with `hv_bay.tscn` latch points.
  * [x] `vcb_cassette.tscn` transfers cleanly between `hv_bay.tscn` and `vcb_trolley.tscn` (`VcbBedAnchor`) deck height without floating or intersecting.
  * [x] Every handheld tool `.glb` has a clean grip origin (`(0,0,0)`) and `TipAnchor` marker for character attachment.

---

### Phase 3 — Marine Switchroom Structural Shell, Architecture & Safety Fixtures
* **User Reference Upload Gate (Upload BEFORE Modeling):**
  * `assets-src/references/ref-06-safety-fixtures.png` *(covers watertight door, CO₂ extinguisher, 45 kV rescue hook; room shell & piping follow Phase 0 clean material library + existing room dimensions `10.4 m × 9.6 m × 3.45 m`)*
* **Tasks:**
  1. Antigravity models/upgrades the complete switchroom shell & fixtures in Blender 5.3 via MCP:
     * `room-shell.glb` (clean marine checkerplate steel deck with crisp diamond tread & zero speckle noise, bulkhead walls + T-bar stiffeners, aft doorway cutout, wall safety plaques).
     * `room-architecture.glb` (baseboards, deckhead beam gussets, 9 vapor-tight LED luminaires, overhead galvanized cable ladder trays + 6.6 kV XLPE feeders + forward MCT frames, HVAC trunking + grilles, red CO₂ & grey air pipes, junction boxes, first-aid cabinet, 2 trolley wheel stops).
     * Upgrade `watertight-door.glb`, `co2-extinguisher.glb`, `rescue-hook.glb` matching `ref-06` with clean satin enamel, smooth brass/stainless, and pivoted door/handwheel nodes.
  2. Export uncompressed `.glb` files to `godot/assets/models/` and assemble `godot/scenes/room/switchroom.tscn` with Godot collision shapes (`StaticBody3D`), lighting (`DirectionalLight3D` / `OmniLight3D` / `WorldEnvironment` + `switchroom_studio.hdr`), and `NavigationRegion3D`.
* **Verification Checklist (Phase 3):**
  * [ ] `ref-06` matched visually; deck floor & bulkhead walls show zero harsh grainy specular artifacts under Godot `Forward+` lighting.
  * [ ] Switchboard lineup (`Phase 1`) and trolley stops sit flush on the deck at exact world coordinates with zero Z-fighting or wall penetration.
  * [ ] Watertight door leaf & handwheel pivots rotate cleanly; collision mesh leaves doorway/walkable floor unobstructed.

---

### Phase 4 — PPE Locker, Workstations & Diagnostic Bench Tools
* **User Reference Upload Gate (Upload BEFORE Modeling):**
  * `assets-src/references/ref-07-ppe-locker.png`
  * `assets-src/references/ref-08-workstations-and-instruments.png`
* **Tasks:**
  1. Antigravity inspects `ref-07` and upgrades `ppe-locker.glb` (clean satin marine-teal cabinet without metallic speckle, pivoted door leaves if animated, and sharp `PpeLockerSuit`, `PpeLockerGloves`, `PpeLockerBoots` dynamic child groups).
  2. Antigravity inspects `ref-08` and upgrades `permit-desk.glb`, `test-bench.glb`, `key-board.glb`, `vcb-workbench.glb`, and `workbench-tools.glb` (clean satin steel frames, smooth hardwood/ESD mats, crisp backlit LCDs, sharp 6 padlocks/Castell keys, DLRO, VDE torque wrench, multimeter, spare copper tulip cluster).
  3. Export uncompressed `.glb` files to `godot/assets/models/` and place inherited scenes (`ppe_locker.tscn`, `permit_desk.tscn`, `test_bench.tscn`, `key_board.tscn`, `vcb_workbench.tscn`) into `switchroom.tscn` with interaction `Area3D` triggers and indicator LED nodes.
* **Verification Checklist (Phase 4):**
  * [ ] `ref-07` & `ref-08` matched visually via Blender MCP screenshots.
  * [ ] Teal PPE locker and all steel bench frames read clearly as smooth satin painted steel (`metallic = 0.0`).
  * [ ] Dynamic child groups (`PpeLockerSuit`, `PpeLockerGloves`, `PpeLockerBoots`) toggle visibility cleanly in Godot when the player equips PPE.
  * [ ] Station interaction beacons (`permitBeacon`, `provingLed`, `keyBoxLed`) align flush with their Blender mast/bezel sockets.

---

### Phase 5 — Marine ETO Engineer Character, Swappable PPE & Animations
* **User Reference Upload Gate (Upload BEFORE Modeling):**
  * `assets-src/references/ref-09-engineer-base.png`
  * `assets-src/references/ref-10-engineer-ppe-kit.png`
* **Tasks:**
  1. Antigravity inspects `ref-09` & `ref-10` and upgrades `engineer.blend` in Blender 5.3 via MCP:
     * Replace 128px noisy twill/leather/hi-vis normal maps with smooth clean FR fabric, semi-matte boot leather, natural skin/hair, crisp reflective tape, and clear safety glasses.
     * Refine proportions and silhouettes of `EngineerBody` and all 9 swappable PPE meshes (`EngineerLeft/RightBareHand`, `EngineerLeft/RightHvGlove`, `EngineerHardHat`, `EngineerArcSuitCoat`, `EngineerArcHood`, `EngineerLeft/RightHvSole`), keeping Armature bone hierarchy & `RigRightToolSocket` intact.
     * Verify all 4 animation clips (`Idle`, `Walk`, `Sprint`, `Interact`) deform cleanly with zero weight clipping when PPE layers swap.
  2. Export uncompressed rigged `engineer.glb` to `godot/assets/models/`.
  3. Wire `godot/scenes/character/engineer.tscn` (`CharacterBody3D` + `Skeleton3D` + `AnimationTree` + right-hand `BoneAttachment3D` for Phase 2 toolbelt props) and test equipping/unequipping every PPE item inside `switchroom.tscn`.
* **Verification Checklist (Phase 5):**
  * [ ] `ref-09` & `ref-10` matched visually via Blender MCP screenshots (front, side, back, 3/4).
  * [ ] Zero 128px stipple noise on coveralls, gloves, boots, or skin.
  * [ ] All 4 animations (`Idle`, `Walk`, `Sprint`, `Interact`) play smoothly in Godot `AnimationPlayer` with zero skin-weight tearing across bare hands, HV gloves, arc-flash coat, and overboots.
  * [ ] Handheld tools from Phase 2 attach cleanly to `BoneAttachment3D` in the engineer's right hand.

---

### Phase 6 — Final Standalone `.exe` Build & End-to-End Scene Verification
* **Tasks:**
  1. Build release Rust GDExtension (`cargo build --release` inside `rust/`).
  2. Configure Godot Windows Desktop export preset (`godot/export_presets.cfg`) and export standalone `.exe` (with `marine_hv_sim.dll` bundled alongside).
* **Final Verification Checklist:**
  * [ ] `cargo build --release` exits `0` (`rust/target/release/marine_hv_sim.dll` up to date).
  * [ ] `Godot_v4.7.2-stable_win64_console.exe --headless --path godot --quit-after 5` loads full `switchroom.tscn` + `HvSimCore` with zero errors or missing resources.
  * [ ] Exported standalone `.exe` launches cleanly on Windows and renders all Phase 1–5 models with smooth, non-grainy marine PBR materials.
