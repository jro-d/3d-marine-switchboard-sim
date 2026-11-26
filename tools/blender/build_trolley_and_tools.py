"""
Build and export the PR B4 high-poly, beveled, Draco-compressed Blender 5.2+ `.glb`
assemblies for the VCB Extraction Service Trolley, Diagnostic Workbench Tools, and
Shipboard Safety Equipment:
  - `public/models/vcb-trolley.glb`       (hydraulic scissor-lift VCB trolley with swivel casters,
                                           named rotatable wheels & rail latch hooks, ergonomic push-bar)
  - `public/models/workbench-tools.glb`   (DLRO 100A micro-ohmmeter + Kelvin leads, 1000V VDE torque
                                           wrench, digital multimeter, 12-finger copper tulip contact cluster)
  - `public/models/watertight-door.glb`   (heavy dogged marine bulkhead door with 6 brass dogs, spoked
                                           wheel, bolted porthole, pintle hinges, EPDM gasket)
  - `public/models/co2-extinguisher.glb`  (high-pressure CO2 cylinder, forged brass valve, safety pin,
                                           braided hose, frost-free discharge horn, marine wall cradle)
  - `public/models/rescue-hook.glb`       (45 kV insulated fiberglass rescue hook on bolted shadow-board)
  - Editable combined scene: `assets-src/blender/trolley_and_tools.blend`
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import bpy
from mathutils import Vector
from common_pbr import clear_scene, ensure_collection, link_object, save_blend
from build_room_props import (
    HardSurfaceBuilder,
    build_materials,
    build_prop_textures,
    export_collection_glb,
    g2b,
    _make_empty,
)


def _make_pivot(name, pos_gltf, col, parent):
    """Create a named Empty pivot at exact Three.js local coordinates for runtime animation."""
    obj = bpy.data.objects.new(name, None)
    obj.location = g2b(*pos_gltf)
    link_object(obj, col)
    obj.parent = parent
    return obj


# ---------------------------------------------------------------------------
# 1. High-Poly 6.6 kV VCB Extraction Service Trolley (`public/models/vcb-trolley.glb`)
#    Orientation: +Z = front rail hooks (faces switchboard), -Z = rear push-bar
#    Exact matches with `src/switchboard/trolley.js`:
#      - Rail top y = 0.506, x = +/-0.27
#      - Latch hook pivots: TrolleyLatchHook_L (-0.27, 0.506, 0.41), TrolleyLatchHook_R (+0.27, 0.506, 0.41)
#      - Wheels: TrolleyWheel_0..3 at (+/-0.27, 0.056, +/-0.28)
#      - Push bar: y = 0.96, z = -0.37
#      - Brake pedals: TrolleyBrakePedals (recolored dynamically by brakeLocked)
# ---------------------------------------------------------------------------
def build_vcb_trolley(mats, col):
    root = _make_empty('VcbTrolleyRoot', col)
    b = HardSurfaceBuilder(mats)

    # Lower welded heavy-gauge steel base chassis plate + recessed skid framing (y = 0.145)
    b.box((0, 0.145, 0), (0.66, 0.042, 0.70), 'steel_dark', bevel=0.006, segs=2)
    b.box((0, 0.170, 0), (0.58, 0.012, 0.62), 'steel_mid', bevel=0.003)

    # Heavy wrap-around safety-yellow perimeter steel/elastomer bumpers + bolted corner guards
    for sx in (-0.342, 0.342):
        b.box((sx, 0.148, 0), (0.026, 0.062, 0.72), 'safety_yellow', bevel=0.007, segs=2)
    b.box((0, 0.148, 0.362), (0.70, 0.062, 0.028), 'safety_yellow', bevel=0.007, segs=2)
    b.box((0, 0.148, -0.355), (0.68, 0.058, 0.024), 'safety_yellow', bevel=0.006, segs=2)
    for cx in (-0.348, 0.348):
        for cz in (-0.358, 0.364):
            b.box((cx, 0.148, cz), (0.036, 0.068, 0.036), 'rubber_black', bevel=0.009)

    # 4 Industrial Swivel Caster Mounting Plates + Fork Yokes (wheels built as rotatable pivots below)
    wheel_coords = [(-0.27, -0.28), (0.27, -0.28), (-0.27, 0.28), (0.27, 0.28)]
    for cx, cz in wheel_coords:
        # Top swivel mounting plate with 4 stainless hex bolts
        b.box((cx, 0.120, cz), (0.092, 0.014, 0.092), 'steel_light', bevel=0.003)
        for bx in (-0.032, 0.032):
            for bz in (-0.032, 0.032):
                b.cyl((cx + bx, 0.111, cz + bz), 0.006, 0.006, 0.008, 'chrome', segs=6)
        # Swivel raceway collar + twin fork cheeks straddling wheel
        b.cyl((cx, 0.104, cz), 0.028, 0.032, 0.022, 'chrome', segs=16)
        for fx_off in (-0.026, 0.026):
            b.box((cx + fx_off, 0.078, cz), (0.010, 0.066, 0.044), 'steel_light', bevel=0.003)
        # Horizontal axle bolt + brass locknut
        b.cyl((cx, 0.056, cz), 0.009, 0.009, 0.072, 'brass', segs=10, axis='x')

    # Hydraulic Scissor-Lift Subframe & Twin Crossed X-Arms (y = 0.16..0.48)
    for ux in (-0.285, 0.285):
        # Corner vertical guide stanchions with bolted clevis brackets
        for uz in (-0.24, 0.24):
            b.box((ux, 0.325, uz), (0.038, 0.33, 0.038), 'safety_yellow', bevel=0.006, segs=2)
            b.box((ux, 0.185, uz), (0.056, 0.038, 0.056), 'steel_dark', bevel=0.004)
            b.box((ux, 0.465, uz), (0.056, 0.038, 0.056), 'steel_dark', bevel=0.004)
        # Crossed scissor-lift steel beams + central brass pivot boss
        b.box((ux, 0.325, 0), (0.018, 0.036, 0.56), 'steel_dark', bevel=0.004, rot_gltf=(0.54, 0, 0))
        b.box((ux, 0.325, 0), (0.018, 0.036, 0.56), 'steel_mid', bevel=0.004, rot_gltf=(-0.54, 0, 0))
        b.cyl((ux, 0.325, 0), 0.018, 0.018, 0.042, 'brass', segs=14, axis='x', bevel_caps=0.003)

    # Central Horizontal Cross-Shaft + Inclined Hydraulic Lift Ram & Chrome Piston Rod
    b.cyl((0, 0.325, 0), 0.014, 0.014, 0.58, 'steel_light', segs=14, axis='x')
    b.cyl((0, 0.24, -0.06), 0.032, 0.032, 0.24, 'steel_dark', segs=18, axis='z', rot_gltf=(-0.55, 0, 0), bevel_caps=0.004)
    b.cyl((0, 0.36, 0.08), 0.018, 0.018, 0.24, 'chrome', segs=16, axis='z', rot_gltf=(-0.55, 0, 0))
    # Rear screw-jack fine-leveling crank handle under bed
    b.cyl((0, 0.28, -0.32), 0.011, 0.011, 0.14, 'chrome', segs=12, axis='z')
    b.cyl((0, 0.28, -0.395), 0.048, 0.048, 0.014, 'rubber_black', segs=18, axis='z', bevel_caps=0.004)

    # Upper Precision VCB Carriage Transfer Bed (y = 0.486) + Twin Machined Stainless Guide Rails (x = +/-0.27, y = 0.506)
    b.box((0, 0.484, 0.01), (0.66, 0.026, 0.72), 'steel_dark', bevel=0.005, segs=2)
    b.box((0, 0.496, 0.01), (0.46, 0.008, 0.64), 'steel_mid', bevel=0.002)
    # Recessed longitudinal drainage / weight-relief slots on bed plate
    for sx in (-0.12, 0.0, 0.12):
        b.box((sx, 0.501, 0.01), (0.045, 0.006, 0.52), 'rubber_black', bevel=0.002)

    for rx in (-0.27, 0.27):
        # Precision C-channel guide rail with side flange lip & front tapered alignment lead-in
        b.box((rx, 0.506, 0.03), (0.052, 0.026, 0.78), 'steel_light', bevel=0.004, segs=2)
        b.box((rx + math.copysign(0.024, rx), 0.520, 0.03), (0.012, 0.020, 0.76), 'chrome', bevel=0.003)
        # Rear mechanical cassette end-stop rubber bumper
        b.box((rx, 0.528, -0.345), (0.048, 0.034, 0.024), 'rubber_black', bevel=0.004)

    # Alignment status beacon collar mount at (0, 0.515, 0.36) right beneath trolley.js dynamic beacon
    b.box((0, 0.496, 0.36), (0.14, 0.022, 0.065), 'steel_dark', bevel=0.004)
    b.cyl((0, 0.518, 0.36), 0.026, 0.022, 0.022, 'chrome', segs=16)

    # Ergonomic Swept Tubular Rear Push-Bar (-Z = -0.37, top y = 0.96) + Diagonal Gussets + Safety Placard
    for px in (-0.30, 0.30):
        b.tube_gltf([
            (px, 0.16, -0.35), (px, 0.50, -0.37), (px, 0.88, -0.37),
            (px, 0.945, -0.37), (px * 0.88, 0.96, -0.37)
        ], 0.018, 'safety_yellow', segs=14)
        # Diagonal reinforcement struts down to chassis
        b.tube_gltf([(px, 0.48, -0.18), (px, 0.74, -0.37)], 0.012, 'steel_dark', segs=10)
    # Center ergonomic knurled rubber push grip bar + secondary safety release bail
    b.cyl((0, 0.96, -0.37), 0.020, 0.020, 0.54, 'rubber_black', segs=18, axis='x', bevel_caps=0.005)
    b.tube_gltf([
        (-0.24, 0.92, -0.37), (-0.24, 0.88, -0.415), (0.24, 0.88, -0.415), (0.24, 0.92, -0.37)
    ], 0.007, 'chrome', segs=8)
    # Crossbar placard plate between uprights
    b.box((0, 0.70, -0.37), (0.56, 0.14, 0.016), 'steel_dark', bevel=0.004)
    b.box((0, 0.70, -0.380), (0.48, 0.085, 0.006), 'safety_yellow', bevel=0.002)

    b.finish('VcbTrolleyFrame', col, parent=root)

    # Named Rotatable Caster Wheels (TrolleyWheel_0..3) centered at local (0,0,0) inside each pivot
    for idx, (cx, cz) in enumerate(wheel_coords):
        wp = _make_pivot(f'TrolleyWheel_{idx}', (cx, 0.056, cz), col, root)
        wb = HardSurfaceBuilder(mats)
        wb.cyl((0, 0, 0), 0.056, 0.056, 0.036, 'rubber_black', segs=22, axis='x', bevel_caps=0.005)
        wb.cyl((0, 0, 0), 0.032, 0.032, 0.039, 'steel_light', segs=18, axis='x', bevel_caps=0.003)
        wb.cyl((0, 0, 0), 0.014, 0.014, 0.043, 'safety_red', segs=12, axis='x')
        # Tread notches so wheel rotation is visibly crisp while rolling!
        for ti in range(8):
            ang = (2.0 * math.pi * ti) / 8.0
            wb.box((0, 0.055 * math.cos(ang), 0.055 * math.sin(ang)), (0.034, 0.006, 0.006), 'steel_dark', bevel=0.001)
        wb.finish(f'TrolleyWheelMesh_{idx}', col, parent=wp)

    # Named Front Rail-Latching Hook Pivots (TrolleyLatchHook_L, TrolleyLatchHook_R)
    for label, hx in (('L', -0.27), ('R', 0.27)):
        hp = _make_pivot(f'TrolleyLatchHook_{label}', (hx, 0.506, 0.41), col, root)
        hb = HardSurfaceBuilder(mats)
        hb.cyl((0, 0, 0), 0.014, 0.014, 0.044, 'brass', segs=12, axis='x')
        hb.box((0, 0, 0.038), (0.028, 0.028, 0.088), 'safety_yellow', bevel=0.005)
        hb.box((0, -0.024, 0.072), (0.028, 0.046, 0.026), 'steel_dark', bevel=0.005)
        hb.box((0, -0.042, 0.058), (0.026, 0.016, 0.028), 'steel_dark', bevel=0.004)  # Hook catch tooth
        hb.finish(f'TrolleyLatchHookMesh_{label}', col, parent=hp)

    # Named Foot-Brake Pedals Group (TrolleyBrakePedals)
    bp = HardSurfaceBuilder(mats)
    for bx in (-0.22, 0.22):
        bp.box((bx, 0.102, -0.365), (0.090, 0.022, 0.058), 'safety_red', bevel=0.005)
        bp.cyl((bx, 0.118, -0.33), 0.008, 0.008, 0.045, 'chrome', segs=10, axis='z')
    bp.finish('TrolleyBrakePedals', col, parent=root)

    return root


# ---------------------------------------------------------------------------
# 2. High-Poly Diagnostic Workbench Tools (`public/models/workbench-tools.glb`)
#    Origin sits flush on ESD mat at (0, 0.946, 0.04) of VCB Diagnostic Workbench
# ---------------------------------------------------------------------------
def build_workbench_tools(mats, col):
    root = _make_empty('WorkbenchTools', col)
    b = HardSurfaceBuilder(mats)

    # 1. DLRO 100A Micro-Ohmmeter (VCB Contact Resistance Tester) at (-0.28, 0, 0)
    ox = -0.28
    b.box((ox, 0.082, 0), (0.34, 0.162, 0.26), 'safety_yellow', bevel=0.014, segs=3)
    for cx in (ox - 0.162, ox + 0.162):
        for cz in (-0.122, 0.122):
            b.box((cx, 0.082, cz), (0.028, 0.170, 0.028), 'rubber_black', bevel=0.007)
    # Recessed dark instrument faceplate + glowing green backlit digital readout + rotary current dial
    b.box((ox, 0.164, 0), (0.295, 0.014, 0.215), 'steel_dark', bevel=0.004)
    b.box((ox - 0.048, 0.173, -0.032), (0.148, 0.008, 0.078), 'lcd_green', bevel=0.002)
    b.cyl((ox + 0.082, 0.180, -0.028), 0.028, 0.024, 0.022, 'rubber_black', segs=18, bevel_caps=0.003)
    b.box((ox + 0.082, 0.192, -0.028), (0.006, 0.006, 0.040), 'white_enamel', bevel=0.001)
    # 4 Kelvin 100A copper/brass binding posts (C1, P1, P2, C2) with red/black collars + coiled Kelvin leads
    for tx, tmat in ((-0.105, 'safety_red'), (-0.035, 'safety_red'), (0.035, 'rubber_black'), (0.105, 'rubber_black')):
        b.cyl((ox + tx, 0.178, 0.068), 0.014, 0.013, 0.020, tmat, segs=14, bevel_caps=0.003)
        b.cyl((ox + tx, 0.192, 0.068), 0.009, 0.009, 0.014, 'copper', segs=12)
    b.handle_u((ox, 0.085, 0.135), 0.14, 0.032, mat_key='rubber_black', r=0.008, horizontal=True)
    # Heavy Kelvin red & black leads coiled cleanly beside DLRO
    b.tube_gltf([
        (ox - 0.105, 0.188, 0.068), (ox - 0.16, 0.18, 0.12), (ox - 0.19, 0.02, 0.15),
        (ox - 0.10, 0.012, 0.18), (ox + 0.02, 0.012, 0.165),
    ], 0.006, 'safety_red', segs=8)
    b.tube_gltf([
        (ox + 0.105, 0.188, 0.068), (ox + 0.17, 0.17, 0.11), (ox + 0.21, 0.02, 0.14),
        (ox + 0.14, 0.012, 0.175),
    ], 0.006, 'rubber_black', segs=8)

    # 2. Calibrated 1000V VDE Insulated Torque Wrench at (0.18, 0.022, 0.05) rotated slightly
    # Built along a gentle diagonal angle for natural workbench placement
    ang = 0.22
    ca, sa = math.cos(ang), math.sin(ang)
    def tw(lx, ly, lz):
        return (0.18 + lx * ca + lz * sa, 0.024 + ly, 0.05 - lx * sa + lz * ca)

    b.tube_gltf([tw(-0.20, 0, 0), tw(0.06, 0, 0)], 0.0115, 'chrome', segs=14)                      # Torque barrel
    b.tube_gltf([tw(0.04, 0, 0), tw(0.085, 0, 0)], 0.0155, 'brass', segs=14)                      # Micrometer lock ring
    b.tube_gltf([tw(0.085, 0, 0), tw(0.11, 0, 0)], 0.022, 'safety_yellow', segs=14)               # VDE finger guard
    b.tube_gltf([tw(0.11, 0, 0), tw(0.24, 0, 0)], [0.018, 0.019], 'safety_red', segs=16)          # 1000V insulated grip
    b.cyl(tw(-0.215, 0, 0), 0.026, 0.024, 0.026, 'chrome', segs=18, bevel_caps=0.004)             # Pear ratchet head
    b.cyl(tw(-0.215, 0.024, 0), 0.017, 0.017, 0.036, 'steel_dark', segs=6, bevel_caps=0.002)      # 24mm hex socket

    # 3. Ruggedized Fluke-Style Digital Multimeter at (0.22, 0, -0.13)
    b.box((0.22, 0.024, -0.13), (0.115, 0.046, 0.185), 'safety_yellow', bevel=0.009, segs=2, rot_gltf=(0, -0.18, 0))
    b.box((0.22, 0.046, -0.13), (0.092, 0.010, 0.155), 'steel_dark', bevel=0.003, rot_gltf=(0, -0.18, 0))
    b.box((0.225, 0.052, -0.165), (0.072, 0.006, 0.052), 'lcd_green', bevel=0.001, rot_gltf=(0, -0.18, 0))
    b.cyl((0.218, 0.056, -0.112), 0.022, 0.020, 0.012, 'rubber_black', segs=16, bevel_caps=0.002)
    for jx, jmat in ((-0.026, 'safety_red'), (0.0, 'rubber_black'), (0.026, 'safety_red')):
        b.cyl((0.212 + jx, 0.052, -0.068), 0.007, 0.007, 0.008, jmat, segs=10)

    # 4. Precision 6.6 kV VCB Copper Tulip Contact Cluster (12 radial fingers + dual garter springs) at (0.04, 0, -0.12)
    tx, tz = 0.04, -0.12
    b.cyl((tx, 0.010, tz), 0.040, 0.038, 0.018, 'copper', segs=20, bevel_caps=0.003)              # Base mounting flange
    b.cyl((tx, 0.036, tz), 0.022, 0.022, 0.044, 'copper', segs=16)                                # Central contact hub
    for fi in range(12):
        fang = (2.0 * math.pi * fi) / 12.0
        fx = tx + 0.030 * math.cos(fang)
        fz = tz + 0.030 * math.sin(fang)
        b.box((fx, 0.046, fz), (0.010, 0.058, 0.010), 'chrome', bevel=0.002, rot_gltf=(0, fang, 0))  # Silver-plated finger
    # Twin stainless circumferential garter tension springs
    for sy in (0.036, 0.060):
        spring_pts = [(tx + 0.036 * math.cos(2 * math.pi * i / 24), sy, tz + 0.036 * math.sin(2 * math.pi * i / 24)) for i in range(25)]
        b.tube_gltf(spring_pts, 0.0042, 'steel_light', segs=8, cap_start=False, cap_end=False)

    b.finish('WorkbenchToolsAssembly', col, parent=root)
    return root


# ---------------------------------------------------------------------------
# 3. High-Poly Marine Watertight Bulkhead Door (`public/models/watertight-door.glb`)
#    Origin at sill floor center (0, 0, 0), facing +Z into switchroom (aftDoorMount rotates PI)
# ---------------------------------------------------------------------------
def build_watertight_door(mats, col):
    root = _make_empty('WatertightBulkheadDoor', col)
    b = HardSurfaceBuilder(mats)

    # Heavy welded shipboard coaming frame with raised flood sill + 20 perimeter hex bulkhead bolts
    b.box((0, 0.075, 0), (1.20, 0.15, 0.13), 'steel_dark', bevel=0.010, segs=2)       # Raised sill coaming
    b.box((0, 0.152, 0.01), (1.14, 0.014, 0.11), 'safety_yellow', bevel=0.003)        # High-vis trip-hazard sill lip
    b.box((0, 2.13, 0), (1.20, 0.11, 0.13), 'steel_dark', bevel=0.009, segs=2)        # Header lintel
    for sx in (-0.545, 0.545):
        b.box((sx, 1.10, 0), (0.11, 2.02, 0.13), 'steel_dark', bevel=0.009, segs=2)   # Side jambs
        for by in (0.28, 0.62, 0.96, 1.30, 1.64, 1.98):
            b.cyl((sx, by, 0.070), 0.010, 0.010, 0.012, 'chrome', segs=6, axis='z')

    # Thick EPDM compression rubber gasket + beveled grey steel watertight door leaf + stiffening ribs
    b.box((0, 1.10, 0.048), (1.01, 1.94, 0.036), 'rubber_black', bevel=0.006)
    b.box((0, 1.10, 0.078), (0.96, 1.90, 0.056), 'steel_light', bevel=0.014, segs=3)
    # Recessed stiffening coffer ribs on lower & mid leaf + red HV hazard stripe
    b.box((0, 0.62, 0.110), (0.76, 0.62, 0.014), 'steel_mid', bevel=0.005)
    b.box((0, 1.32, 0.109), (0.86, 0.092, 0.012), 'safety_red', bevel=0.003)

    # Armored Circular Brass Inspection Porthole (y = 1.64) with 8 perimeter brass clamp bolts & glass
    p_ring = [(0.155 * math.cos(2 * math.pi * i / 28), 1.64 + 0.155 * math.sin(2 * math.pi * i / 28), 0.115) for i in range(29)]
    b.tube_gltf(p_ring, 0.022, 'brass', segs=12, cap_start=False, cap_end=False)
    b.cyl((0, 1.64, 0.108), 0.142, 0.142, 0.016, 'glass_clear', segs=24, axis='z')
    for bi in range(8):
        ang = (2.0 * math.pi * bi) / 8.0
        b.cyl((0.155 * math.cos(ang), 1.64 + 0.155 * math.sin(ang), 0.136), 0.009, 0.009, 0.014, 'chrome', segs=6, axis='z')

    # 3 Heavy Cast-Steel Double-Knuckle Pintle Hinges on Port (-X) Edge
    for hy in (0.48, 1.10, 1.72):
        b.cyl((-0.495, hy, 0.088), 0.026, 0.026, 0.15, 'steel_dark', segs=16, bevel_caps=0.004)
        b.cyl((-0.495, hy, 0.088), 0.014, 0.014, 0.18, 'brass', segs=12)
        b.box((-0.41, hy, 0.108), (0.16, 0.048, 0.016), 'steel_dark', bevel=0.004)

    # 6 Quick-Acting Brass Watertight Dogging Handles + Frame Striker Wedges
    for dx, dy, rot_z in (
        (0.45, 0.44, 0.35), (0.45, 1.10, 0.35), (0.45, 1.74, 0.35),
        (-0.43, 0.44, -0.35), (-0.43, 1.74, -0.35), (0.0, 2.02, 1.57),
    ):
        b.cyl((dx, dy, 0.116), 0.024, 0.022, 0.040, 'steel_dark', segs=14, axis='z', bevel_caps=0.003)
        b.box((dx, dy - 0.048, 0.136), (0.024, 0.155, 0.018), 'brass', bevel=0.004, rot_gltf=(0, 0, rot_z * 0.5))
        b.cyl((dx, dy - 0.112, 0.145), 0.012, 0.012, 0.036, 'rubber_black', segs=10, axis='z')

    # Central Quick-Acting 4-Spoke Watertight Handwheel (x = 0.22, y = 1.04)
    wx, wy, wz = 0.22, 1.04, 0.145
    wheel_pts = [(wx + 0.135 * math.cos(2 * math.pi * i / 28), wy + 0.135 * math.sin(2 * math.pi * i / 28), wz) for i in range(29)]
    b.tube_gltf(wheel_pts, 0.015, 'steel_dark', segs=12, cap_start=False, cap_end=False)
    b.cyl((wx, wy, wz - 0.018), 0.032, 0.028, 0.056, 'brass', segs=16, axis='z', bevel_caps=0.004)
    for si in range(4):
        sang = (math.pi * si) / 2.0
        b.tube_gltf([
            (wx, wy, wz - 0.006),
            (wx + 0.132 * math.cos(sang), wy + 0.132 * math.sin(sang), wz),
        ], 0.009, 'steel_dark', segs=10)

    b.finish('WatertightDoorAssembly', col, parent=root)
    return root


# ---------------------------------------------------------------------------
# 4. High-Poly Marine CO2 Fire Extinguisher (`public/models/co2-extinguisher.glb`)
#    Matches co2Mount origin at (1.06, 0.96, 6.71) facing +Z
# ---------------------------------------------------------------------------
def build_co2_extinguisher(mats, col):
    root = _make_empty('CO2Extinguisher', col)
    b = HardSurfaceBuilder(mats)

    # Heavy red steel marine wall cradle + stainless quick-release clamp band + bolts
    b.box((0, 0.04, 0.008), (0.21, 0.68, 0.018), 'safety_red', bevel=0.004)
    b.box((0, -0.28, 0.095), (0.19, 0.018, 0.175), 'safety_red', bevel=0.004)         # Base support lip
    for by in (-0.22, 0.30):
        for bx in (-0.072, 0.072):
            b.cyl((bx, by, 0.020), 0.007, 0.007, 0.010, 'chrome', segs=6, axis='z')
    strap_pts = [(0.088 * math.cos(math.radians(a)), 0.02, 0.095 + 0.088 * math.sin(math.radians(a))) for a in range(-15, 196, 15)]
    b.tube_gltf(strap_pts, [(0.005, 0.014)] * len(strap_pts), 'chrome', segs=8)

    # Seamless Spun Red High-Pressure CO2 Cylinder + Smooth Dome + Black CO2 Band + Base Foot Ring
    b.cyl((0, -0.005, 0.095), 0.082, 0.082, 0.53, 'safety_red', segs=26, bevel_caps=0.006)
    b.sphere((0, 0.258, 0.095), (0.082, 0.072, 0.082), 'safety_red', u_segs=26, v_segs=14)
    b.cyl((0, 0.125, 0.095), 0.0835, 0.0835, 0.115, 'rubber_black', segs=26)           # Black CO2 ID band
    b.cyl((0, -0.262, 0.095), 0.084, 0.084, 0.024, 'rubber_black', segs=24)            # Protective foot skirt

    # Forged Brass Valve Body + Safety Ring Pin + Squeeze Trigger & Carry Lever
    b.cyl((0, 0.348, 0.095), 0.026, 0.022, 0.068, 'brass', segs=18, bevel_caps=0.003)
    b.box((0, 0.382, 0.095), (0.036, 0.034, 0.044), 'brass', bevel=0.004)
    b.box((0, 0.388, 0.032), (0.018, 0.014, 0.115), 'steel_dark', bevel=0.003)         # Lower carry lever
    b.box((0, 0.422, 0.038), (0.022, 0.014, 0.125), 'brass', bevel=0.003, rot_gltf=(-0.24, 0, 0))  # Squeeze handle
    pin_pts = [(0.026 + 0.016 * math.cos(2 * math.pi * i / 16), 0.395 + 0.016 * math.sin(2 * math.pi * i / 16), 0.095) for i in range(17)]
    b.tube_gltf(pin_pts, 0.0028, 'safety_yellow', segs=6, cap_start=False, cap_end=False)

    # Braided High-Pressure Discharge Hose + Insulated Grip + Flared Frost-Free Horn
    b.tube_gltf([
        (0.018, 0.382, 0.095), (0.068, 0.365, 0.095), (0.105, 0.310, 0.098),
        (0.118, 0.225, 0.102), (0.122, 0.165, 0.102),
    ], 0.011, 'rubber_black', segs=12)
    b.cyl((0.122, 0.155, 0.102), 0.017, 0.017, 0.068, 'rubber_black', segs=14, bevel_caps=0.003)   # Frost-free grip
    b.cyl((0.122, 0.025, 0.102), 0.048, 0.018, 0.22, 'rubber_black', segs=22, bevel_caps=0.004)    # Flared CO2 horn

    b.finish('CO2ExtinguisherAssembly', col, parent=root)
    return root


# ---------------------------------------------------------------------------
# 5. High-Poly 45 kV Insulated HV Rescue Hook (`public/models/rescue-hook.glb`)
#    Matches rescueHookMount origin at (-1.12, 1.32, 6.71) facing +Z
# ---------------------------------------------------------------------------
def build_rescue_hook(mats, col):
    root = _make_empty('HVRescueHook', col)
    b = HardSurfaceBuilder(mats)

    # Beveled yellow emergency wall shadow-board with dark trim border & 4 stainless mounting bolts
    b.box((0, 0, 0.008), (0.35, 1.78, 0.022), 'safety_yellow', bevel=0.006, segs=2)
    b.box((0, 0, 0.020), (0.31, 1.73, 0.005), 'steel_dark', bevel=0.002)
    b.box((0, 0, 0.023), (0.29, 1.70, 0.005), 'safety_yellow', bevel=0.002)
    for bx in (-0.135, 0.135):
        for by in (-0.82, 0.82):
            b.cyl((bx, by, 0.028), 0.008, 0.008, 0.010, 'chrome', segs=6, axis='z')

    # Twin stainless spring-clip wall brackets
    for by in (-0.52, 0.38):
        b.box((0, by, 0.036), (0.088, 0.044, 0.032), 'steel_light', bevel=0.004)
        clip_pts = [(-0.024, by, 0.048), (-0.022, by, 0.072), (0, by, 0.080), (0.022, by, 0.072), (0.024, by, 0.048)]
        b.tube_gltf(clip_pts, 0.005, 'chrome', segs=8)

    # 45 kV Fiberglass Dielectric Pole + Non-Slip Ribbed Grip + Hand-Guard Flange + Crook
    b.cyl((0, -0.06, 0.058), 0.017, 0.019, 1.46, 'safety_yellow', segs=18, bevel_caps=0.003)
    b.cyl((0, -0.58, 0.058), 0.022, 0.022, 0.34, 'rubber_black', segs=18, bevel_caps=0.004)
    for ry in (-0.70, -0.64, -0.58, -0.52, -0.46):
        b.cyl((0, ry, 0.058), 0.024, 0.024, 0.012, 'steel_dark', segs=18)
    b.cyl((0, -0.39, 0.058), 0.048, 0.046, 0.018, 'safety_red', segs=22, bevel_caps=0.004)
    b.cyl((0, 0.67, 0.058), 0.022, 0.020, 0.065, 'chrome', segs=16, bevel_caps=0.003)              # Ferrule collar

    # Smooth Insulated Shepherd's Rescue Crook
    crook_pts = []
    for i in range(20):
        ang = math.radians(-10.0 + i * 12.2)
        cx = -0.115 + 0.115 * math.cos(ang)
        cy = 0.695 + 0.115 * math.sin(ang)
        crook_pts.append((cx, cy, 0.058))
    b.tube_gltf(crook_pts, 0.016, 'steel_dark', segs=14)
    b.sphere(crook_pts[-1], (0.024, 0.024, 0.024), 'safety_red', u_segs=14, v_segs=10)

    b.finish('HVRescueHookAssembly', col, parent=root)
    return root


def main():
    clear_scene()
    tex = build_prop_textures()
    mats = build_materials(tex)

    builders = [
        ('VcbTrolley', 'vcb-trolley.glb', build_vcb_trolley),
        ('WorkbenchTools', 'workbench-tools.glb', build_workbench_tools),
        ('WatertightDoor', 'watertight-door.glb', build_watertight_door),
        ('CO2Extinguisher', 'co2-extinguisher.glb', build_co2_extinguisher),
        ('HVRescueHook', 'rescue-hook.glb', build_rescue_hook),
    ]

    grand_tris = 0
    for col_name, out_glb, fn in builders:
        col = ensure_collection(col_name)
        fn(mats, col)
        tris, _ = export_collection_glb(col_name, out_glb, use_draco=True)
        grand_tris += tris

    blend_out = os.path.join(REPO_ROOT, 'assets-src', 'blender', 'trolley_and_tools.blend')
    save_blend(blend_out)
    print(f'[build_trolley_and_tools] Total trolley + tools + safety triangles: {grand_tris}')
    print(f'[build_trolley_and_tools] Saved editable scene: {blend_out}')


if __name__ == '__main__':
    main()
