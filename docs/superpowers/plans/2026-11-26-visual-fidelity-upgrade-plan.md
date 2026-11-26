# Blender 5.2.2 LTS High-Poly & PBR Visual Upgrade Plan

**Repository:** `jro-d/3d-marine-switchboard-sim`  
**Blender Runtime:** `D:\Blender\blender.exe` (`Blender 5.2.2 LTS`)  
**Engine & Stack:** Three.js `^0.187.0` + `DRACOLoader` + `EffectComposer` + Vite `^8.3.8`  
**Goal:** Replace the boxy low-poly code primitives in `engineer.glb`, switchroom cabinets/benches, room props, and trolley with true **Blender 5.2.2 sculpted, subdivided, beveled, smooth-skinned, Draco-compressed `.glb` assets** (25k–45k tris character, thousands of beveled/instanced parts across cabinets & tools), backed by **baked PBR normal/roughness/AO maps**, **HDR industrial IBL**, and **real-time SSAO + selective LED/HMI Bloom**.

---

## Architecture: Editable `.blend` Sources + Headless `bpy` Build Pipeline

We maintain both editable Blender source scenes and reproducible headless Blender CLI build scripts:
```text
assets-src/blender/              # Editable .blend files you can open & sculpt in Blender 5.2.2 GUI
  engineer.blend
  room_stations.blend
  architecture_props.blend
  switchboard_hardware.blend
tools/blender/                   # Headless bpy build + PBR bake + Draco glTF 2.0 export scripts
  common_pbr.py                  # Shared Principled BSDF materials, Bevel/WeightedNormal/UV/Bake helpers
  build_engineer.py              # Contoured multi-bone smooth-skinned ETO humanoid + 5-finger hands + PPE
  build_room_stations.py         # Permit Desk, Megger/Proving Bench, PPE Locker, Key Box, VCB Workbench
  build_architecture_props.py    # Watertight Door, Rescue Hook, CO2 Extinguisher, Valves, Piping, Luminaires
  build_trolley_and_tools.py     # High-poly VCB Trolley + DLRO Micro-Ohmmeter + VDE Wrench + Tulip Cluster
  export_all.mjs                 # Node runner invoking D:\Blender\blender.exe -b -P ... -> public/models/*.glb
public/
  draco/                         # Local copy of Three.js draco_decoder.{js,wasm} (zero external CDN)
  env/engine_room_1k.hdr         # Industrial machine-room HDR environment map (or Blender-rendered Equirectangular HDR)
  models/                        # Draco-compressed glTF 2.0 binary assets loaded cleanly by Vite & GH Pages
```

> **Node Test Compatibility:** Three.js `DRACOLoader` works in browser WebGL; for Node headless tests (`models.test.mjs`, `ik.test.mjs`), either test uncompressed validation exports alongside Draco OR inspect glTF JSON/metadata + load via `DRACOLoader` / un-Draco CI test fixture so all `npm test` checks run cleanly without a browser.

---

## Multi-PR Roadmap (`PR B1` – `PR B4`)

### PR B1: Blender Pipeline, `DRACOLoader`, PBR Pipeline, HDR IBL & Post-Processing
**Files:** `package.json`, `public/draco/*`, `tools/blender/export_all.mjs`, `tools/blender/common_pbr.py`, `src/switchboard/materials.js`, `src/game/materials-pbr.js`, `src/main.js`, `src/game/character.js`, `src/game/room.js`, `src/ui/hud.js`
1. **Draco & Shared Blender Runner:**
   - Bundle `node_modules/three/examples/jsm/libs/draco/gltf/*` into `public/draco/` and configure a shared `createGltfLoader()` helper (`DRACOLoader` + `GLTFLoader`) used by `character.js` and `room.js`.
   - Create `npm run blender:build` (`node tools/blender/export_all.mjs`) auto-detecting `D:\Blender\blender.exe` (or `$env:BLENDER_EXE`) to build & Draco-export `.glb` assets from Python `bpy` + save `.blend` files in `assets-src/blender/`.
2. **Industrial HDR IBL & Procedural/Baked PBR Maps:**
   - Render a seamless **marine switchroom HDRI equirectangular `.exr`/`.hdr`** inside Blender 5.2.2 Cycles (`Camera -> Panoramic Equirectangular` inside a lit metallic gallery) OR load a verified CC0 machine-room `.hdr` via `RGBELoader` + `PMREMGenerator` in `src/main.js`, replacing the synthetic minimal `RoomEnvironment()`.
   - Upgrade `src/switchboard/materials.js` + `src/game/materials-pbr.js` with true **tangent-space `normalMap` + `roughnessMap`** generators for powder-coat steel grain, brushed galvanized metal, worn diamond checkerplate deck steel, laminated desk wood, copper busbars, and phenolic ESD mats.
3. **Adaptive Post-Processing (`EffectComposer`):**
   - Wire `EffectComposer` -> `RenderPass` -> `SSAOPass` (soft cabinet/bench/corner contact shadows) -> subtle thresholded `UnrealBloomPass` (live CVI LEDs, HMI displays, wand collar glow, arc-flash) -> `OutputPass` (ACES Filmic), with a `Graphics Quality: High / Standard` toggle in the More menu.

---

### PR B2: High-Poly Blender Rigged Engineer (`engineer.glb`, 25k–45k Tris, Smooth Skinning)
**Files:** `tools/blender/build_engineer.py`, `assets-src/blender/engineer.blend`, `public/models/engineer.glb`, `src/game/character.js`, `src/game/models.test.mjs`, `src/game/ik.test.mjs`
1. **High-Poly Anatomical Modeling & Garments in Blender 5.2.2 (`bmesh` + `Subdivision Surface` + `Bevel`):**
   - **Continuous Body Mesh:** Smooth subdivided organic silhouette across shoulders, collarbones, ribcage, tapered waist, hips, thighs, knees, calves, and ankles (zero boxy blocks or disconnected cylinders).
   - **Sculpted Head & Safety Gear:** Detailed cranial/jaw/brow/nose/ear topology, safety spectacles with wrap-around frame & lenses, and a **contoured `Subsurf` marine hard hat** with ribbed crown ridge, rain gutter brim, and internal ratchet suspension straps.
   - **Workwear & PPE Details:** Collared FR Nomex coveralls with front storm-flap zipper placket, chest radio/pen pockets with stitched pocket flaps, cuffed sleeves, stitched yellow FR reflective bands (raised slightly with beveled seams), belt with brass buckle & tool pouch, knee reinforcement pads, and lug-sole dielectric safety boots.
   - **5-Finger Articulated Hands & Class 2 HV Gauntlets:** Proper palm + thumb + index/middle/ring/pinky fingers so reaching for `Trip [O]`, `Close [I]`, keys, and handles looks human in both 3rd-person and 1st-person close-ups.
   - **Separate Rig-Driven PPE Meshes (`ArcCoatMesh`, `ArcHoodMesh`, `HVGlovesMesh`, `DielectricSolesMesh`):** Modeled cleanly in Blender over the torso/arms/head with real fabric folds & curved green face-shield visor, toggled by `sim.ppe` in `character.js`.
2. **Smooth Multi-Bone Linear Blend Skinning & Baked Maps:**
   - Bind to our exact skeleton bone contract (`Hips`, `Spine`, `Chest`, `Neck`, `Head`, `Left/Right UpperArm/ForeArm/Hand`, `Left/Right Thigh/Shin/Foot`, `RightHandIKTarget`, `LeftHandIKTarget`) with **smooth normalized bone falloff weights** across shoulder/elbow/hip/knee joints (so crouching to crank `rackPort` or `EK6` bends fabric smoothly).
   - UV-unwrap and bake a **cloth-fold `normalMap` + ambient occlusion `aoMap`** directly in Blender onto packed textures inside `engineer.glb`.
   - Export `Idle`, `Walk`, `Sprint`, and `PushTrolley` NLA Action clips + **exact `RigRightToolSocket` grip orientation** verified against `CCDIKSolver` (`< 2.5 cm` error in `ik.test.mjs`).

---

### PR B3: Blender-Modeled Switchroom Stations, Equipment & Marine Architecture
**Files:** `tools/blender/build_room_stations.py`, `tools/blender/build_architecture_props.py`, `public/models/*.glb`, `src/game/room.js`
Replace every blocky procedural station in `src/game/room.js` with **Draco-compressed, beveled (`Bevel` + `WeightedNormal`), UV-baked `.glb` assemblies** containing hundreds to thousands of modeled sub-parts:
1. **Proving & 5 kV Megger Bench (`public/models/test-bench.glb`):**
   - Heavy bolted steel workbench frame with chamfered apron rails, rubber leveling feet, under-shelf cable tray, ESD mat.
   - **MIT525-style 5 kV Insulation Tester:** Chamfered pelican housing with corner rubber guards, hinged latchable lid, dual rotary selector dials, recessed LCD readout, 3 guarded color-coded HV sockets (`+`, `-`, `G`), and **coiled silicone HV leads with insulated alligator clips**.
   - **6.6 kV Proving Unit & HV Detector Wand:** Detailed unit with 6-LED bargraph ladder, recessed brass probe electrodes, and contoured fiberglass proving wand resting on rubber brackets.
2. **Permit-to-Work Desk (`public/models/permit-desk.glb`):**
   - Folded sheet-metal marine pedestal desk with 3 beveled drawers, brushed stainless U-pulls, cam locks, chamfered hardwood/laminate top with black PVC bumper trim, articulated drafting task lamp (`warm spotlight` accent), open steel-ring PTW binder, PA handset, desktop SLD status monitor, and an ergonomic **wheeled swivel mesh task chair**.
3. **HV PPE Locker (`public/models/ppe-locker.glb`):**
   - Slotted stamped ventilation louver banks, continuous piano hinges, recessed 3-point turning cam handle, internal coat rod & shelf, **draped high-poly 40 cal/cm² arc suit + hood with curved visor**, hanging **5-finger Class 2 orange gloves**, detailed boots, and strapped **15 kV ribbed dielectric mat roll**.
4. **LOTO Key Box & Tool Board (`public/models/key-board.glb`):**
   - Perforated galvanized pegboard (`array`/instanced holes), glass-windowed red LOTO safety lock box with brass cam lock & keyed padlocks hanging on internal racks, shadow-board painted outlines, forged racking crank with knurled grip sleeve, and coiled portable CME earthing leads on heavy cable hooks.
5. **Expanded Shipboard Switchroom Structure (`public/models/room-architecture.glb` + `src/game/room.js`):**
   - True C-channel bulkhead stiffeners with bolted gusset plates, watertight dogged bulkhead door (Upgraded with Blender `Subsurf` rubber seals & brass dog linkages), bulkhead chilled-water/CO2 piping runs with **spoked valve handwheels & Bourdon gauges**, Roxtec-style modular cable transits (MCTs), caged vapor-tight marine LED battens, and fire-rated cable penetration collars.

---

### PR B4: Blender Upgrade for Switchboard Hardware, VCB Trolley & Workbench Tools
**Files:** `tools/blender/build_trolley_and_tools.py`, `public/models/vcb-trolley.glb`, `public/models/workbench-tools.glb`, `src/switchboard/trolley.js`, `src/switchboard/hv-bay.js`, `src/switchboard/lv-bay.js`
1. **High-Poly VCB Withdrawal Service Trolley (`public/models/vcb-trolley.glb`):**
   - Exported from Blender with chamfered heavy C-channel deck frame, articulated hydraulic scissor lift arms, hydraulic pump cylinder & foot-release lever, 4 dual-bearing **swivel industrial casters with rubber treads & red locking pedals**, knurled rubber push-bar sleeves, spring-loaded rail alignment latches, and diamond-plate transfer bed retaining our exact `bedAnchor` alignment (`z = 1.04`, `yaw = PI`).
2. **Workbench Diagnostic Kit (`public/models/workbench-tools.glb`) & Switchgear Exterior Detail:**
   - Detailed **DLRO 100A Micro-Ohmmeter** with kelvin duplex coiled leads, **VDE 1000V micrometer torque wrench** with knurled barrel & ratchet pawls, sculpted 18-finger **spare tulip cluster** with dual garter springs, plus `InstancedMesh` M8/M12 flanged bolts & upgraded shrouded switchgear fascia bezels on `C1`–`C5`.

---

## Performance & Compatibility Guardrails
- **Poly Budget Target:**
  - Engineer `.glb`: `~25,000–45,000` triangles (`< 1.2 MB` Draco-compressed)
  - All Room Stations + Architecture Props: `~120,000–250,000` triangles total (`InstancedMesh` + Draco)
  - Maintain smooth **60 FPS** on mid-range integrated & discrete GPUs via `Graphics Quality` toggle (`High`: `SSAOPass` + `Bloom`; `Standard`: crisp ACES Filmic forward PBR).
- **Drop-In Mixamo / Custom `.glb` Preservation:** Users can always open any file in `assets-src/blender/*.blend` in **Blender 5.2.2** or swap `public/models/engineer.glb` directly as long as the documented bone/clip names stay intact.
- **Automated Verification (`npm test` + Playwright WebGL):** Every PR verifies glTF asset schema, `CCDIKSolver` `< 2.5 cm` socket error, mission mechanics (`27+` tests), `npm run build`, and live 1st-person/3rd-person visual screenshots with `0` console/page errors.
