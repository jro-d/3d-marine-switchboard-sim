# Gemini Reference Image Prompts — 3D Marine HV Switchboard Simulator

**Purpose:** Generate clean, consistent multi-view reference sheets in Gemini **before** Blender MCP modeling begins, so every 3D asset has an exact visual blueprint instead of blind prompt guessing.

**Save Folder:** `assets-src/references/` *(relative to project root `08-3D-Marine-Switchboard-Sim`)*

---

## Global Rules & Workflow (Read Once Before Running Prompts)

1. **One sheet per asset (do NOT generate 4 separate unlinked images):** Each prompt generates **4 views in a single image** (`FRONT VIEW`, `SIDE VIEW`, `TOP VIEW`, and `3/4 ISOMETRIC VIEW`) so proportions, handles, hinges, and gauges stay aligned across views.
2. **Clean, Direct Industrial Look (No Harsh Grainy Metal):** Every prompt enforces **smooth satin marine powder-coated steel**, **clean matte rubber/fabric**, **smooth brushed stainless steel**, and **zero noise/grunge/rust/scratches/fancy backgrounds**.
3. **Allowed Labels:** Only clean minimal black sans-serif labels (`FRONT VIEW`, `SIDE VIEW`, `TOP VIEW`, `3/4 ISOMETRIC VIEW`) under each view on a flat neutral light-grey background (`#DFE3E6`).
4. **If one view drifts in Gemini:** Reply directly to the generated image with:
   > *"Keep the exact design, colors, and proportions from the 3/4 ISOMETRIC VIEW, and fix the FRONT / SIDE / TOP orthographic views so every handle, latch, hinge, and wheel aligns horizontally and vertically across all four views. Keep the flat #DFE3E6 background, no noise, no grain, no extra props."*
5. **When satisfied:** Save the finalized PNG with the **exact filename** listed under each prompt into `assets-src/references/`.

---

## Phase 1 Reference Prompts — Hero Switchgear & VCB Cassette

### 1A. 6.6 kV Marine HV Switchgear Bay
**Save as:** `assets-src/references/ref-01-hv-switchboard-bay.png`

> Create a clean industrial technical turnaround sheet of a **6.6 kV Marine High Voltage Metal-Clad Switchgear Cubicle (single bay, IEC 60092 marine Form 4b)** on a completely flat, solid neutral light-grey background (`#DFE3E6`).
>
> Arrange **4 views** neatly on the sheet with minimal black sans-serif labels underneath each view:
> - `FRONT VIEW` (strictly flat orthographic, zero perspective)
> - `SIDE VIEW` (strictly flat orthographic, right profile, zero perspective)
> - `TOP VIEW` (strictly flat orthographic, looking straight down, zero perspective)
> - `3/4 ISOMETRIC VIEW` (clean isometric angle showing front and right side depth)
>
> **Exact design & proportions (real scale 0.80 m wide × 2.15 m tall × 1.20 m deep):**
> - **Base:** Dark slate-blue marine C-channel steel floor skid with a recessed navy-blue front kickplate and bolt-down mounting pads.
> - **Upper Compartment (Low-Voltage Relay Door):** Hinged light-grey satin steel door containing a dark charcoal digital protection IED relay screen with crisp indicator LEDs, a clean single-line mimic diagram plate with breaker symbol, rotary selector switch, amber/red/green pilot lamps, and a brass Castell key interlock cylinder.
> - **Lower Compartment (Breaker & Earthing Door):** Hinged light-grey satin steel door with a recessed rectangular safety-glass inspection window, mechanical racking-in/out shutter aperture with steel sliding flap, rotary earthing switch lever with padlockable hasp, heavy stainless-steel quarter-turn T-handle latch, and crisp yellow/black 6.6 kV HV warning nameplate.
> - **Top Roof:** Flat galvanized steel roof plate with lifting eye-bolts and a top cable gland / busbar riser flange.
>
> **Material & lighting style (critical):**
> - Smooth satin RAL 7035 light-grey powder-coated steel panels (non-metallic painted finish, zero harsh metallic grain, zero noise, zero rust, zero dirt or scratches).
> - Clean brushed stainless steel handles/hinges and subtle machined brass lock cylinder.
> - Soft, even, shadowless studio CAD lighting with crisp chamfered panel seams. No background room, no floor grid clutter, no extra decorative graphics.

---

### 1B. Withdrawable 6.6 kV Vacuum Circuit Breaker (VCB) Cassette
**Save as:** `assets-src/references/ref-02-vcb-cassette.png`

> Create a clean industrial technical turnaround sheet of a **Withdrawable 6.6 kV Marine Vacuum Circuit Breaker (VCB) Cassette Truck** on a completely flat, solid neutral light-grey background (`#DFE3E6`).
>
> Arrange **4 views** neatly on the sheet with minimal black sans-serif labels underneath each view:
> - `FRONT VIEW` (strictly flat orthographic, operator fascia facing camera)
> - `SIDE VIEW` (strictly flat orthographic, right profile showing front mechanism + rear tulip arms)
> - `TOP VIEW` (strictly flat orthographic, looking straight down at the 3 epoxy poles)
> - `3/4 ISOMETRIC VIEW` (clean isometric angle showing both front fascia and rear HV arms)
>
> **Exact design & proportions (0.50 m wide × 0.68 m tall × 0.45 m deep):**
> - **Carriage Base:** Compact heavy-duty satin dark-grey steel wheeled chassis pan with 4 small flanged steel rollers, central brass racking lead-screw, and two front black tubular pull-handles.
> - **Front Operating Fascia:** Clean satin light-grey steel cover plate with mechanical OPEN (green) / CLOSED (red) indicator flags, SPRING CHARGED (yellow) indicator window, manual push-to-close / push-to-trip buttons, mechanical operations counter, and spring-charging socket.
> - **3-Phase HV Poles (behind fascia):** Three parallel vertical dark-reddish-brown smooth cast-epoxy resin pole housings (L1, L2, L3) enclosing vacuum interrupter bottles.
> - **Rear Primary Contacts:** Six horizontal cylindrical copper/silver-plated contact arms extending backward (3 upper, 3 lower), each ending in a multi-finger copper tulip contact cluster with stainless garter springs.
>
> **Material & lighting style (critical):**
> - Smooth satin painted steel chassis, glossy smooth dark-red cast epoxy resin poles, clean bare copper/silver-plated tulip contacts, zero grainy noise texture, zero wear/dirt.
> - Even flat studio lighting, crisp hard-surface edges, no background clutter.

---

### 1C. 440V Marine LV Air Circuit Breaker (ACB) Bay
**Save as:** `assets-src/references/ref-03-lv-acb-bay.png`

> Create a clean industrial technical turnaround sheet of a **440V Marine Low-Voltage Air Circuit Breaker (ACB) Switchgear Bay** on a completely flat, solid neutral light-grey background (`#DFE3E6`).
>
> Arrange **4 views** neatly with minimal black sans-serif labels underneath each view:
> - `FRONT VIEW` (strictly flat orthographic)
> - `SIDE VIEW` (strictly flat orthographic)
> - `TOP VIEW` (strictly flat orthographic)
> - `3/4 ISOMETRIC VIEW` (clean isometric angle)
>
> **Exact design & proportions (0.76 m wide × 2.06 m tall × 1.04 m deep):**
> - Matches the visual family of the 6.6 kV switchgear bay: satin RAL 7035 light-grey marine powder-coated enclosure, navy-blue bottom kickplate, top steel canopy lip with `440V LV` header plate.
> - **Upper Section:** Metering & control panel with digital multifunction power meter, 3 analog ammeter dials, selector switch, and indicator lamps.
> - **Middle Section:** Drawout 440V Air Circuit Breaker (ACB) front escutcheon in dark charcoal casing with manual spring-charging pump lever, digital trip unit LCD, OPEN/CLOSE pushbuttons, racking shutter hole, and lockable lever.
> - **Lower Section:** Clean ventilated cable/feeder access door with stainless T-handle latch and horizontal louver vents.
>
> **Material & lighting style (critical):**
> - Smooth satin painted steel (zero grainy metallic noise), clean dark charcoal molded breaker fascia, smooth stainless latches, flat neutral studio lighting, no clutter.

---

## Phase 2 Reference Prompts — VCB Trolley & Handheld HV Tools

### 2A. VCB Withdrawal & Transport Trolley
**Save as:** `assets-src/references/ref-04-vcb-trolley.png`

> Create a clean industrial technical turnaround sheet of a **Marine Switchgear VCB Withdrawal & Transport Lift Trolley** on a completely flat, solid neutral light-grey background (`#DFE3E6`).
>
> Arrange **4 views** neatly with minimal black sans-serif labels underneath each view:
> - `FRONT VIEW` (strictly flat orthographic, latch-hook end facing camera)
> - `SIDE VIEW` (strictly flat orthographic, right profile)
> - `TOP VIEW` (strictly flat orthographic, looking straight down at transfer rails)
> - `3/4 ISOMETRIC VIEW` (clean isometric angle)
>
> **Exact design & proportions (0.72 m wide × 0.96 m handle height × 0.80 m long):**
> - **Lower Frame & Wheels:** Low-profile satin dark-slate welded steel U-frame chassis resting on 4 industrial swivel/fixed rubber caster wheels with clean steel hubs and two rear red foot-brake pedals.
> - **Lift Mechanism:** Central inclined hydraulic bottle ram with smooth chrome piston rod supporting the upper transfer deck, plus rear crank handle.
> - **Upper Transfer Deck (at 0.50 m height):** Smooth flat dark-grey steel deck plate topped by twin parallel brushed-stainless C-channel VCB guide rails (`0.54 m` apart) with tapered front lead-in tips and two **front safety-yellow mechanical latching hooks** that lock onto switchgear cubicles.
> - **Rear Push-Bar:** Twin vertical safety-yellow tubular uprights rising to `0.96 m` with a horizontal black rubber ergonomic grip bar and a small safety placard crossbar.
>
> **Material & lighting style (critical):**
> - Smooth satin safety-yellow and dark-slate powder-coated steel, clean brushed stainless guide rails, smooth matte black rubber wheels/grips. Zero grainy noise, zero rust, flat studio lighting.

---

### 2B. Handheld HV Safety Tools & LOTO Kit (Collection Sheet)
**Save as:** `assets-src/references/ref-05-handheld-tools.png`

> Create a clean industrial **3/4 Isometric + Front Orthographic** product reference sheet showing **7 marine HV electrical tools** neatly arranged in separated columns on a completely flat, solid neutral light-grey background (`#DFE3E6`), with minimal black sans-serif item labels underneath each tool:
>
> 1. `PROVING WAND` — 6.6 kV capacitive HV proving wand: safety-orange fiberglass pole, black knurled rubber grip, red circular hand-guard disc, green LED status collar, dark sensor head, stainless probe tip.
> 2. `RACKING CRANK` — VCB racking handle: heavy brushed-stainless steel L-crank shaft with 6-point hex drive socket and black knurled rotating handle grip.
> 3. `CASTELL KEY` — Marine trapped-key interlock: machined solid brass key with circular embossed bow and coded bit tip.
> 4. `LOTO PADLOCK` — Safety lockout padlock: satin safety-red insulated body with brushed stainless shackle and white danger tag loop.
> 5. `CME EARTH CLAMP` — Circuit Main Earth (CME) stick & lead: insulated yellow fiberglass operating pole with heavy cast-brass screw-down earth clamp jaw and bright lime-green flexible earth cable tail.
> 6. `MEGGER PROBES` — Pair of 5 kV insulated test probes (one safety-red, one matte-black) with shrouded finger guards and stainless needle tips.
> 7. `PTW CLIPBOARD` — Heavy dark-slate marine clipboard holding crisp cream Permit-to-Work paper with red header band and stainless clip.
>
> **Material & lighting style (critical):**
> - Smooth satin plastics/fiberglass, clean machined brass/stainless, smooth matte rubber grips, zero noisy grain texture, even studio lighting, no cluttered shadows.

---

## Phase 3 Reference Prompts — Room Architecture & Safety Fixtures

### 3A. Marine Watertight Bulkhead Door, CO₂ Extinguisher & 45 kV Rescue Hook
**Save as:** `assets-src/references/ref-06-safety-fixtures.png`

> Create a clean industrial technical turnaround sheet featuring **3 marine switchroom safety fixtures** side-by-side (each shown in `FRONT VIEW`, `SIDE VIEW`, and `3/4 ISOMETRIC VIEW`) on a completely flat, solid neutral light-grey background (`#DFE3E6`), with minimal black sans-serif labels:
>
> 1. `WATERTIGHT DOOR` (1.20 m wide × 2.20 m tall): Heavy dark-slate welded steel bulkhead coaming frame with safety-yellow raised flood sill lip, smooth satin light-grey steel door leaf with pressed stiffening panel, black EPDM perimeter rubber gasket, circular brass inspection porthole at eye level, 3 steel/brass hinges, 6 brass quick-acting dogging handles, and a central 4-spoke steel handwheel.
> 2. `CO2 EXTINGUISHER` (wall-mounted): Satin safety-red wall bracket cradle with stainless quick-release strap, smooth gloss/satin red seamless CO₂ pressure cylinder with black ID band, forged brass squeeze-valve with yellow safety pin, smooth black flexible hose, and black flared frost-free discharge horn.
> 3. `45 kV RESCUE HOOK` (wall-mounted): Satin safety-yellow rectangular wall shadow-board with dark trim border, twin stainless spring clips, smooth yellow 45 kV fiberglass pole with ribbed black rubber grip, red hand-guard flange, and insulated dark-grey shepherd's crook hook.
>
> **Material & lighting style (critical):**
> - Smooth satin painted steel and fiberglass, clean machined brass and brushed stainless, zero noisy grain texture, zero grime/rust, flat studio lighting.

---

## Phase 4 Reference Prompts — PPE Locker & Switchroom Workstations

### 4A. Marine HV PPE Locker & Stored Gear
**Save as:** `assets-src/references/ref-07-ppe-locker.png`

> Create a clean industrial technical turnaround sheet of a **Marine High-Voltage PPE Storage Locker (open-front display configuration)** on a completely flat, solid neutral light-grey background (`#DFE3E6`).
>
> Arrange **4 views** neatly with minimal black sans-serif labels underneath each view:
> - `FRONT VIEW` (strictly flat orthographic, open interior visible)
> - `SIDE VIEW` (strictly flat orthographic)
> - `TOP VIEW` (strictly flat orthographic)
> - `3/4 ISOMETRIC VIEW` (clean isometric angle)
>
> **Exact design & proportions (1.38 m wide × 2.06 m tall × 0.62 m deep):**
> - **Cabinet:** Smooth satin **marine-teal powder-coated steel** cabinet on a dark slate kickplate plinth, with twin hinged doors swung open to the sides (`108°`) showing stainless handles, top/bottom ventilation louvers, central interior vertical divider, galvanized steel shelves, and an overhead interior white LED light strip.
> - **Left Bay (Suit & Boots):** Hanging khaki Nomex 40 cal/cm² arc-flash switching parka on a chrome hanger rod with yellow/silver reflective chest and sleeve stripes; **40 cal/cm² khaki arc-flash hood with curved emerald-green transparent polycarbonate visor** on the top shelf; pair of **bright yellow 20 kV dielectric rubber overboots** on the bottom floor deck.
> - **Right Bay (Gloves & Mat):** Pneumatic glove inflator tester on top shelf; pair of **Class 2 bright orange rubber HV gauntlet gloves with tan leather outer protectors** displayed on the middle shelf; **rolled yellow-and-black 15 kV insulating rubber mat** on the bottom shelf.
>
> **Material & lighting style (critical):**
> - Smooth satin teal painted cabinet (non-metallic paint, zero grainy metal speckles), smooth matte Nomex fabric, clean smooth orange/yellow rubber PPE, crisp visor transparency, even studio lighting.

---

### 4B. Workstations & Diagnostic Instruments (3-Station Sheet)
**Save as:** `assets-src/references/ref-08-workstations-and-instruments.png`

> Create a clean industrial **FRONT VIEW + 3/4 ISOMETRIC VIEW** reference sheet of **4 marine HV switchroom stations/benches** neatly separated on a completely flat, solid neutral light-grey background (`#DFE3E6`), with minimal black sans-serif labels:
>
> 1. `PERMIT DESK` (1.44 m wide × 0.94 m tall): Satin dark-slate steel pedestal desk (3 drawers left, lockable cabinet right, stainless U-handles), smooth laminated oak wood top with rear sea-rail lip, red PTW ring-binder, yellow SFT clipboard, marine intercom phone, and a stainless signal beacon mast with protective wire cage.
> 2. `TEST BENCH` (1.58 m wide × 0.90 m tall): Welded dark-slate tubular steel bench with lower galvanized shelf (hard Pelican case + cable drum), green phenolic ESD tabletop mat, rear power strip, **6.6 kV proving unit** (dark steel + yellow shock bumpers + twin white ceramic sockets), **5 kV digital Megger tester** (safety-yellow rugged case + backlit green LCD + rotary selector + red/blue/black HV leads), and resting proving wand.
> 3. `KEY BOARD` (1.58 m wide × 1.98 m tall): Steel bench with green/black mat and tall framed dark steel pegboard backing; red steel Group LOTO lockbox with clear acrylic window, 6 red/yellow LOTO padlocks, 6 brass Castell keys hanging on hooks, wall-mounted racking crank, fiberglass earth stick, and danger tag tray.
> 4. `VCB WORKBENCH` (1.52 m wide × 1.92 m tall): Heavy steel workbench with under-bench red 3-drawer mechanic's chest, green ESD tabletop mat, perforated steel backboard with overhead LED hood, 4 chrome wrenches, 5 small-parts bins, and on the tabletop: yellow **DLRO 100A micro-ohmmeter**, **1000V VDE red/yellow torque wrench**, **yellow digital multimeter**, and a **12-finger copper VCB tulip cluster**.
>
> **Material & lighting style (critical):**
> - Clean satin painted steel frames (zero grainy speckle), smooth matte ESD mats, crisp instrument LCDs, clean oak wood grain without harsh bump noise, flat neutral studio lighting.

---

## Phase 5 Reference Prompts — Marine ETO Engineer Character & Swappable PPE

### 5A. Marine Electro-Technical Officer (ETO) — Base Uniform & Rig Proportions
**Save as:** `assets-src/references/ref-09-engineer-base.png`

> Create a clean 3D character modeling turnaround sheet of a **Marine Electro-Technical Officer (ETO) Engineer** standing in a neutral **A-pose** on a completely flat, solid neutral light-grey background (`#DFE3E6`).
>
> Arrange **4 views** neatly with minimal black sans-serif labels underneath each view:
> - `FRONT VIEW` (strictly flat orthographic, arms angled ~30° downward in A-pose)
> - `SIDE VIEW` (strictly flat orthographic, right profile)
> - `BACK VIEW` (strictly flat orthographic)
> - `3/4 ISOMETRIC VIEW` (clean 3/4 view)
>
> **Exact design & proportions (~1.76 m tall, realistic industrial simulator proportions):**
> - **Uniform:** Clean navy-blue flame-resistant (FR) marine coveralls with darker navy reinforced elbow/knee patches, bright yellow-and-silver hi-vis reflective strips across chest, upper back, sleeves, and calves, Chief ETO gold-striped shoulder epaulettes, chest VHF radio clipped on left chest, and a clean brass-zipped front placket.
> - **Head & Hands:** Clean-shaven adult marine engineer with short dark hair, clear wraparound polycarbonate safety glasses, natural smooth skin tone, and bare hands in relaxed neutral A-pose.
> - **Footwear:** Matte black leather steel-toe safety boots with dark oil-resistant lug soles.
>
> **Material & lighting style (critical):**
> - Smooth matte FR cotton-twill fabric (subtle clean cloth shading, zero harsh noisy bump grain), natural smooth skin, clean semi-matte leather boots. Even studio lighting, neutral expression, no dramatic shadows or background.

---

### 5B. Swappable HV / Arc-Flash PPE Kit (Overlay Sheet)
**Save as:** `assets-src/references/ref-10-engineer-ppe-kit.png`

> Create a clean 3D character turnaround sheet showing the **same Marine ETO Engineer** wearing the **Full 40 cal/cm² HV Arc-Flash PPE Kit**, in **A-pose** on a completely flat, solid neutral light-grey background (`#DFE3E6`), with 4 views (`FRONT VIEW`, `SIDE VIEW`, `BACK VIEW`, `3/4 ISOMETRIC VIEW`) plus a small inset showing the **White Class E Hard Hat** worn separately:
>
> - **Arc-Flash Coat:** Loose-fitting khaki Nomex 40 cal/cm² switching parka worn over coveralls, with dark-olive cuff trim and hi-vis yellow/silver reflective bands.
> - **Arc-Flash Hood:** Khaki Nomex switching hood covering head and shoulders with a framed **curved transparent emerald-green polycarbonate visor** showing the face silhouette subtly inside.
> - **Class 2 HV Gloves:** Flared bright safety-orange dielectric rubber gauntlet cuffs extending halfway up the forearms, paired with tan leather outer protector palms and articulated fingers.
> - **Dielectric Overboots:** Bright safety-yellow 20 kV dielectric rubber overboots with heavy black lugged soles fitted cleanly over the boots.
> - **Inset — Hard Hat:** Clean white Class E electrical safety hard hat with dark suspension rim and small navy/teal marine ETO front badge.
>
> **Material & lighting style (critical):**
> - Smooth matte Nomex fabric, smooth semi-gloss dielectric rubber gloves and boots, clean transparent emerald visor, zero noisy normal-map grain, flat neutral studio lighting.
