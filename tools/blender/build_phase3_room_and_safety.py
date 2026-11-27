"""
Phase 3 Builder: Switchroom Shell, Industrial Architecture & Safety Fixtures
(Blender 5.3+ -> Godot 4.7 uncompressed GLBs).

Matches reference sheet:
  - assets-src/references/ref-06-safety-fixtures.jpg
  - Room bounds matching switchboard lineup & station coordinates:
      Blender X in [-5.20..5.20], Y in [-6.80..2.80], Z in [0.0..3.45]
      (Exports to Godot X in [-5.20..5.20], Y in [0.0..3.45], Z in [-2.80..6.80])
"""

import math
import os
import sys
import bpy

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(THIS_DIR, '..', '..'))
if THIS_DIR not in sys.path:
    sys.path.insert(0, THIS_DIR)

from common_clean_pbr import (
    CleanHardSurfaceBuilder,
    build_clean_material_library,
    ensure_collection,
    export_collection_uncompressed_glb,
    make_empty,
    reset_clean_scene,
)


def build_room_shell(mats, col):
    """
    Clean non-grainy marine switchroom shell (10.4m W x 9.6m D x 3.45m H)
    with a real aft doorway cutout (X in [-0.58..+0.58], Z in [0..2.18]).
    """
    root = make_empty('RoomShellRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    H = 3.45
    # 1. Walkable Deck Slab (top surface at Z = 0.0, zero Z-fighting)
    b.box((0.0, -2.0, -0.025), (10.56, 9.76, 0.050), 'deck_slate')

    # Crisp 1m anti-slip deck plate seam lines (flush inside top 1mm, clean geometric grid)
    for gx in range(-5, 6):
        b.box((float(gx), -2.0, -0.001), (0.014, 9.54, 0.003), 'deck_tile')
    for gy in range(-6, 3):
        b.box((0.0, float(gy), -0.001), (10.34, 0.014, 0.003), 'deck_tile')

    # Front & Rear HV Arc-Flash Boundary Strips (Godot Z = +1.58 & -1.06 -> Blender Y = -1.58 & +1.06)
    for strip_y in (-1.58, 1.06):
        b.box((0.0, strip_y, 0.0015), (5.10, 0.13, 0.003), 'dark_fascia')
        for si in range(-12, 13):
            b.box((si * 0.20, strip_y, 0.0022), (0.09, 0.11, 0.0025), 'yellow')

    # 2. Bulkhead Walls (Port, Starboard, Forward, and Aft with real doorway cutout)
    b.box((-5.20, -2.0, H * 0.5), (0.14, 9.76, H), 'bulkhead')       # Port wall
    b.box((5.20, -2.0, H * 0.5), (0.14, 9.76, H), 'bulkhead')        # Starboard wall
    b.box((0.0, 2.80, H * 0.5), (10.56, 0.14, H), 'bulkhead')        # Forward wall

    # Aft wall (Y = -6.80) split cleanly around doorway X in [-0.58..+0.58], Z in [0.0..2.18]
    b.box((-2.93, -6.80, H * 0.5), (4.70, 0.14, H), 'bulkhead')      # Aft left
    b.box((2.93, -6.80, H * 0.5), (4.70, 0.14, H), 'bulkhead')       # Aft right
    b.box((0.0, -6.80, 2.815), (1.16, 0.14, 1.27), 'bulkhead')       # Aft doorway header

    # Ceiling Deckhead Slab (top cap)
    b.box((0.0, -2.0, H + 0.04), (10.56, 9.76, 0.08), 'grey_trim')

    # 3. Structural Vertical Bulkhead T-Bar Stiffeners
    for sy in (1.6, -0.4, -2.4, -4.4, -6.0):
        b.box((-5.11, sy, H * 0.5), (0.08, 0.08, H - 0.08), 'slate_skid', bevel=0.004)
        b.box((5.11, sy, H * 0.5), (0.08, 0.08, H - 0.08), 'slate_skid', bevel=0.004)
    for sx in (-3.8, -1.9, 1.9, 3.8):
        b.box((sx, 2.71, H * 0.5), (0.08, 0.08, H - 0.08), 'slate_skid', bevel=0.004)
        b.box((sx, -6.71, H * 0.5), (0.08, 0.08, H - 0.08), 'slate_skid', bevel=0.004)

    # 4. Overhead Transverse Deckhead Steel Beams
    for by in (2.1, 0.3, -1.5, -3.5, -5.5):
        b.box((0.0, by, H - 0.075), (10.26, 0.14, 0.13), 'grey_trim', bevel=0.005)

    # 5. Forward Bulkhead Safety Sign Backplates (Y = +2.71)
    b.box((0.0, 2.71, 2.88), (3.60, 0.024, 0.42), 'red', bevel=0.005)
    b.box((0.0, 2.695, 2.88), (3.46, 0.008, 0.34), 'white_label', bevel=0.002)
    b.box((0.0, 2.71, 2.34), (2.65, 0.024, 0.32), 'yellow', bevel=0.005)
    b.box((0.0, 2.695, 2.34), (2.52, 0.008, 0.25), 'white_label', bevel=0.002)

    b.finish('RoomShellMesh', col, parent=root)
    return root


def build_room_architecture(mats, col):
    """
    Industrial switchroom architecture: baseboards, beam gussets, 9 LED luminaires,
    overhead cable trays + 6.6 kV feeder risers aligned to Phase 1 bays, HVAC ducting,
    bulkhead CO2/air piping, aft first-aid cabinet, and trolley wheel stops.
    """
    root = make_empty('RoomArchitectureRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)
    H = 3.45

    # 1. Perimeter Baseboard Kickplates (split cleanly around aft doorway X in [-0.64..0.64])
    b.box((-5.11, -2.0, 0.055), (0.055, 9.55, 0.11), 'slate_skid', bevel=0.006)
    b.box((5.11, -2.0, 0.055), (0.055, 9.55, 0.11), 'slate_skid', bevel=0.006)
    b.box((0.0, 2.71, 0.055), (10.22, 0.055, 0.11), 'slate_skid', bevel=0.006)
    b.box((-2.92, -6.71, 0.055), (4.48, 0.055, 0.11), 'slate_skid', bevel=0.006)
    b.box((2.92, -6.71, 0.055), (4.48, 0.055, 0.11), 'slate_skid', bevel=0.006)

    # 2. Structural Beam Gusset Knees at Port & Starboard Deckhead
    for by in (2.1, 0.3, -1.5, -3.5, -5.5):
        for sx in (-1.0, 1.0):
            b.box((sx * 4.96, by, H - 0.24), (0.34, 0.09, 0.24), 'grey_trim', bevel=0.005)
            b.box((sx * 5.10, by, H - 0.30), (0.04, 0.16, 0.38), 'slate_skid', bevel=0.004)
            for bz_off in (-0.12, 0.10):
                b.cyl((sx * 5.07, by, H - 0.30 + bz_off), 0.012, 0.012, 0.025, 'stainless', segs=6, axis='x')

    # 3. 9 Overhead Vapor-Tight Marine LED Luminaires
    for lx in (-3.1, 0.0, 3.1):
        for ly in (1.75, -1.45, -4.45):
            b.box((lx, ly, H - 0.165), (1.58, 0.21, 0.068), 'slate_skid', bevel=0.008)
            b.box((lx, ly, H - 0.205), (1.48, 0.135, 0.026), 'led_panel', bevel=0.005)
            for hx in (-0.62, 0.62):
                b.cyl((lx + hx, ly, H - 0.075), 0.010, 0.010, 0.15, 'stainless', segs=8)

    # 4. Overhead Galvanized Cable Ladder Trays + 6.6 kV Red Armored Feeder Cables
    tray_z = 2.78
    for ty in (0.18, 0.58):
        b.box((0.0, ty, tray_z), (4.40, 0.024, 0.055), 'galv', bevel=0.003)
    for rx in (-2.10, -1.82, -1.54, -1.26, -0.98, -0.70, -0.42, -0.14, 0.14, 0.42, 0.70, 0.98, 1.26, 1.54, 1.82, 2.10):
        b.box((rx, 0.38, tray_z - 0.018), (0.022, 0.40, 0.018), 'galv', bevel=0.002)

    # Feeder risers aligned directly over Phase 1 bays (X = -1.68, -0.84, 0.0, +0.84, +1.68)
    bay_specs = [
        (-1.68, 2.15, 0.38),
        (-0.84, 2.15, 0.38),
        (0.00,  2.15, 0.38),
        (0.84,  2.15, 0.38),
        (1.68,  2.06, 0.30),
    ]
    for bx, roof_z, gland_y in bay_specs:
        riser_h = tray_z - roof_z
        b.box((bx, gland_y, roof_z + 0.025), (0.28, 0.14, 0.045), 'slate_skid', bevel=0.004)
        for cx_off in (-0.07, 0.0, 0.07):
            b.cyl((bx + cx_off, gland_y, roof_z + riser_h * 0.5), 0.018, 0.018, riser_h, 'red', segs=12)
            b.cyl((bx + cx_off, 1.55, tray_z + 0.025), 0.018, 0.018, 2.38, 'red', segs=12, axis='y')
        # Forward bulkhead Multi-Cable Transit (MCT) frame
        b.box((bx, 2.72, tray_z + 0.02), (0.36, 0.08, 0.20), 'slate_skid', bevel=0.005)

    for bx in (-1.68, 0.0, 1.68):
        for s_off in (-0.18, 0.18):
            b.box((bx + s_off, 1.58, tray_z), (0.022, 2.32, 0.05), 'galv', bevel=0.003)
        for ry in (0.60, 0.92, 1.24, 1.56, 1.88, 2.20, 2.52):
            b.box((bx, ry, tray_z - 0.018), (0.36, 0.022, 0.016), 'galv', bevel=0.002)

    # 5. Overhead HVAC Ventilation Supply Trunking (Y_blender = -2.55 -> Godot Z = +2.55)
    b.box((0.0, -2.55, 3.06), (9.60, 0.34, 0.24), 'galv', bevel=0.006)
    for fx in (-3.6, -1.8, 0.0, 1.8, 3.6):
        b.box((fx, -2.55, 3.06), (0.03, 0.37, 0.27), 'grey_trim', bevel=0.003)
        b.box((fx + 0.65, -2.55, 2.935), (0.38, 0.22, 0.02), 'slate_skid', bevel=0.002)

    # 6. Bulkhead CO2 Header Pipe + Instrument-Air Pipe + Junction Boxes + Pressure Gauge
    for sx in (-1.0, 1.0):
        px = sx * 5.05
        b.cyl((px, -2.0, 2.92), 0.032, 0.032, 9.20, 'red', segs=14, axis='y')
        b.cyl((px, -2.0, 2.76), 0.024, 0.024, 9.20, 'pipe_grey', segs=14, axis='y')
        for py in (2.0, 0.0, -2.0, -4.0, -6.0):
            b.cyl((px, py, 2.92), 0.052, 0.052, 0.026, 'slate_skid', segs=14, axis='y', bevel_caps=0.003)
            b.cyl((px, py, 2.76), 0.042, 0.042, 0.022, 'grey_trim', segs=14, axis='y', bevel_caps=0.003)
            b.box((sx * 5.09, py, 2.84), (0.08, 0.035, 0.26), 'slate_skid', bevel=0.003)
        for jy in (2.25, -5.15):
            b.box((sx * 5.06, jy, 1.85), (0.11, 0.22, 0.26), 'grey_trim', bevel=0.006)
            b.cyl((sx * 5.07, jy, 2.38), 0.014, 0.014, 0.80, 'stainless', segs=10)
            b.cyl((sx * 5.07, jy - 0.05, 1.70), 0.012, 0.012, 0.032, 'brass', segs=10)
            b.cyl((sx * 5.07, jy + 0.05, 1.70), 0.012, 0.012, 0.032, 'brass', segs=10)
    b.cyl((4.98, -5.45, 2.92), 0.048, 0.048, 0.028, 'brass', segs=16, axis='x')
    b.cyl((4.96, -5.45, 2.92), 0.038, 0.038, 0.010, 'white_label', segs=16, axis='x')

    # 7. Aft Bulkhead First-Aid Cabinet (Godot (1.06, 2.02, 6.66) -> Blender (1.06, -6.66, 2.02), facing +Y into room)
    b.box((1.06, -6.66, 2.02), (0.36, 0.14, 0.40), 'green', bevel=0.008, segs=2)
    b.box((1.06, -6.588, 2.02), (0.32, 0.016, 0.36), 'green', bevel=0.004)
    b.box((1.06, -6.578, 2.02), (0.165, 0.008, 0.048), 'white_label', bevel=0.002)
    b.box((1.06, -6.578, 2.02), (0.048, 0.008, 0.165), 'white_label', bevel=0.002)
    b.box((0.91, -6.582, 2.02), (0.016, 0.018, 0.068), 'stainless', bevel=0.003)

    # 8. Two Trolley Wheel Stops at Park (+3.72) & Maintenance (-3.72) Zones (Godot Z = +0.66 -> Blender Y = -0.66)
    for wx, wy in ((3.72, -0.66), (-3.72, -0.66)):
        b.box((wx, wy, 0.023), (0.82, 0.095, 0.046), 'rubber', bevel=0.010, segs=2)
        for sx_off in (-0.24, 0.0, 0.24):
            b.box((wx + sx_off, wy, 0.047), (0.12, 0.072, 0.006), 'yellow', bevel=0.002)
        for bx_off in (-0.34, 0.34):
            b.cyl((wx + bx_off, wy, 0.048), 0.012, 0.012, 0.014, 'stainless', segs=6)

    b.finish('RoomArchitectureDetails', col, parent=root)
    return root


def build_watertight_door(mats, col):
    """
    Marine Watertight Bulkhead Door matching ref-06-safety-fixtures.jpg.
    Built facing -Y (Godot +Z), with DoorLeafPivot and HandwheelPivot.
    """
    root = make_empty('WatertightDoorRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # Coaming frame (1.20m W x 2.20m H) + yellow raised flood sill + EPDM gasket
    b.box((0.0, 0.0, 0.075), (1.20, 0.13, 0.15), 'slate_skid', bevel=0.008, segs=2)
    b.box((0.0, -0.02, 0.012), (1.24, 0.15, 0.024), 'yellow', bevel=0.004)       # Flood sill lip
    b.box((0.0, 0.0, 2.13), (1.20, 0.13, 0.12), 'slate_skid', bevel=0.008, segs=2)
    for sx in (-0.545, 0.545):
        b.box((sx, 0.0, 1.10), (0.11, 0.13, 2.02), 'slate_skid', bevel=0.008, segs=2)
    b.box((0.0, -0.048, 1.10), (1.02, 0.032, 1.94), 'rubber', bevel=0.005)        # EPDM gasket

    b.finish('WatertightDoorFrame', col, parent=root)

    # Pivoted Door Leaf at left hinge axis (-0.48, -0.08, 1.10)
    door_hinge = (-0.48, -0.08, 1.10)
    door_pivot = make_empty('DoorLeafPivot', door_hinge, col, root)
    db = CleanHardSurfaceBuilder(mats)

    # Main door leaf + central recessed stiffening coffer
    db.box((0.0, -0.078, 1.10), (0.96, 0.056, 1.90), 'grey_panel', bevel=0.014, segs=3)
    db.box((0.0, -0.106, 1.10), (0.76, 0.016, 1.66), 'grey_trim', bevel=0.006, segs=2)
    db.box((0.0, -0.110, 1.10), (0.72, 0.012, 1.62), 'grey_panel', bevel=0.005, segs=2)

    # Circular Brass Inspection Porthole (Z = 1.62) + 8 bolts + clear glass
    db.torus_ring((0.0, -0.120, 1.62), 0.155, 0.022, 'brass', major_segs=28, minor_segs=10, axis='y')
    db.cyl((0.0, -0.112, 1.62), 0.142, 0.142, 0.014, 'glass', segs=24, axis='y')
    for bi in range(8):
        ang = (2.0 * math.pi * bi) / 8.0
        db.cyl((0.155 * math.cos(ang), -0.138, 1.62 + 0.155 * math.sin(ang)), 0.008, 0.008, 0.012, 'stainless', segs=6, axis='y')

    # 3 Heavy Machined Brass Double-Knuckle Pintle Hinges on Left (-X) Edge
    for hz in (0.46, 1.10, 1.74):
        db.cyl((-0.48, -0.095, hz), 0.022, 0.022, 0.14, 'brass', segs=16, bevel_caps=0.003)
        db.box((-0.41, -0.112, hz), (0.14, 0.018, 0.048), 'brass', bevel=0.004)

    # 6 Quick-Acting Brass Dogging Handles (3 left, 3 right matching ref-06)
    for dx, dz, rot_y in (
        (0.41, 0.56, 0.38), (0.41, 1.10, 0.38), (0.41, 1.64, 0.38),
        (-0.40, 0.56, -0.38), (-0.40, 1.10, -0.38), (-0.40, 1.64, -0.38),
    ):
        db.cyl((dx, -0.118, dz), 0.018, 0.016, 0.036, 'slate_skid', segs=12, axis='y')
        db.box((dx, -0.136, dz - 0.045), (0.020, 0.016, 0.145), 'brass', bevel=0.004, rot_euler=(0.0, rot_y, 0.0))
        db.cyl((dx, -0.145, dz - 0.105), 0.010, 0.010, 0.032, 'rubber', segs=10, axis='y')

    db.finish('WatertightDoorLeaf', col, parent=door_pivot, origin=door_hinge, parent_is_at_origin=True)

    # Central 4-Spoke Handwheel Pivot inside DoorLeafPivot
    hw_world = (0.0, -0.155, 1.04)
    hw_local = (hw_world[0] - door_hinge[0], hw_world[1] - door_hinge[1], hw_world[2] - door_hinge[2])
    hw_pivot = make_empty('HandwheelPivot', hw_local, col, door_pivot)
    hb = CleanHardSurfaceBuilder(mats)
    hb.torus_ring(hw_world, 0.135, 0.015, 'stainless', major_segs=28, minor_segs=10, axis='y')
    hb.cyl((0.0, -0.146, 1.04), 0.034, 0.030, 0.048, 'slate_skid', segs=16, axis='y', bevel_caps=0.003)
    hb.cyl((0.0, -0.168, 1.04), 0.018, 0.016, 0.016, 'stainless', segs=14, axis='y', bevel_caps=0.002)
    for si in range(4):
        sang = (math.pi * si) / 2.0
        hb.tube([(0.0, -0.148, 1.04), (0.132 * math.cos(sang), -0.155, 1.04 + 0.132 * math.sin(sang))], 0.009, 'stainless', segs=10)
    hb.finish('WatertightHandwheel', col, parent=hw_pivot, origin=hw_world, parent_is_at_origin=True)

    return root


def build_co2_extinguisher(mats, col):
    """Marine CO2 Extinguisher matching ref-06-safety-fixtures.jpg (facing -Y)."""
    root = make_empty('CO2ExtinguisherRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # Red wall cradle + stainless quick-release strap
    b.box((0.0, -0.008, 0.04), (0.21, 0.018, 0.68), 'red', bevel=0.004)
    b.box((0.0, -0.095, -0.28), (0.19, 0.175, 0.018), 'red', bevel=0.004)
    strap_pts = [(0.090 * math.cos(math.radians(a)), -0.095 - 0.090 * math.sin(math.radians(a)), 0.02) for a in range(-10, 191, 15)]
    b.tube(strap_pts, 0.007, 'stainless', segs=8)

    # Seamless red cylinder + domed top + black rubber base skirt
    b.cyl((0.0, -0.095, -0.005), 0.082, 0.082, 0.52, 'red', segs=26, bevel_caps=0.006)
    b.cyl((0.0, -0.095, 0.275), 0.080, 0.026, 0.065, 'red', segs=26, bevel_caps=0.004)
    b.cyl((0.0, -0.095, -0.262), 0.084, 0.084, 0.024, 'rubber', segs=24)

    # Forged brass valve body + yellow safety pull pin + red carry/squeeze handles
    b.cyl((0.0, -0.095, 0.340), 0.024, 0.022, 0.065, 'brass', segs=18, bevel_caps=0.003)
    b.box((0.0, -0.095, 0.376), (0.036, 0.042, 0.034), 'brass', bevel=0.004)
    b.box((0.0, -0.030, 0.382), (0.018, 0.115, 0.014), 'red', bevel=0.003)
    b.box((0.0, -0.036, 0.415), (0.022, 0.125, 0.014), 'red', bevel=0.003, rot_euler=(0.24, 0, 0))
    b.torus_ring((0.026, -0.095, 0.388), 0.015, 0.003, 'yellow', major_segs=16, minor_segs=6, axis='y')

    # Black curved discharge hose + flared frost-free horn on left side (-X)
    b.tube(
        [
            (-0.018, -0.095, 0.376),
            (-0.075, -0.098, 0.355),
            (-0.115, -0.102, 0.285),
            (-0.122, -0.105, 0.165),
        ],
        0.011,
        'rubber',
        segs=12,
    )
    b.cyl((-0.122, -0.105, 0.145), 0.017, 0.017, 0.068, 'rubber', segs=14, bevel_caps=0.003)
    b.cyl((-0.122, -0.105, 0.015), 0.048, 0.018, 0.22, 'rubber', segs=22, bevel_caps=0.004)

    b.finish('CO2ExtinguisherAssembly', col, parent=root)
    return root


def build_rescue_hook(mats, col):
    """45 kV Insulated HV Rescue Hook matching ref-06-safety-fixtures.jpg (facing -Y)."""
    root = make_empty('HVRescueHookRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # Yellow wall shadow-board with dark trim border
    b.box((0.0, -0.008, 0.0), (0.35, 0.022, 1.78), 'dark_fascia', bevel=0.006, segs=2)
    b.box((0.0, -0.014, 0.0), (0.31, 0.014, 1.73), 'yellow', bevel=0.004)

    # Upper red clamp bracket, middle stainless spring bracket, bottom red foot cup (matches ref-06!)
    b.box((0.0, -0.036, 0.38), (0.14, 0.032, 0.044), 'red', bevel=0.004)
    b.box((0.0, -0.036, -0.06), (0.14, 0.032, 0.040), 'stainless', bevel=0.004)
    b.box((0.0, -0.045, -0.78), (0.095, 0.058, 0.036), 'red', bevel=0.004)

    # 45 kV Yellow fiberglass dielectric pole + ribbed black grip + dark charcoal insulated crook
    b.cyl((0.0, -0.058, -0.06), 0.018, 0.018, 1.46, 'yellow', segs=18, bevel_caps=0.003)
    b.cyl((0.0, -0.058, -0.56), 0.022, 0.022, 0.36, 'rubber', segs=18, bevel_caps=0.004)
    for rz in (-0.68, -0.62, -0.56, -0.50, -0.44):
        b.cyl((0.0, -0.058, rz), 0.024, 0.024, 0.012, 'dark_fascia', segs=18)

    crook_pts = []
    for i in range(20):
        ang = math.radians(-10.0 + i * 12.2)
        cx = -0.105 + 0.105 * math.cos(ang)
        cz = 0.675 + 0.105 * math.sin(ang)
        crook_pts.append((cx, -0.058, cz))
    b.tube(crook_pts, 0.015, 'dark_fascia', segs=14)

    b.finish('HVRescueHookAssembly', col, parent=root)
    return root


def build_all_phase3():
    models_dir = os.path.join(REPO_ROOT, 'godot', 'assets', 'models')
    blend_dir = os.path.join(REPO_ROOT, 'assets-src', 'blender')
    stats = {}

    # 1. Room Shell + Architecture in room_shell_and_arch.blend
    reset_clean_scene()
    mats = build_clean_material_library()

    shell_col = ensure_collection('RoomShell')
    build_room_shell(mats, shell_col)
    s_tris, s_bytes = export_collection_uncompressed_glb(shell_col, os.path.join(models_dir, 'room-shell.glb'))
    stats['room-shell.glb'] = {'tris': s_tris, 'kb': round(s_bytes / 1024.0, 1)}

    arch_col = ensure_collection('RoomArchitecture')
    build_room_architecture(mats, arch_col)
    a_tris, a_bytes = export_collection_uncompressed_glb(arch_col, os.path.join(models_dir, 'room-architecture.glb'))
    stats['room-architecture.glb'] = {'tris': a_tris, 'kb': round(a_bytes / 1024.0, 1)}

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, 'room_shell_and_arch.blend'), compress=True)

    # 2. Safety Fixtures (Watertight Door, CO2 Extinguisher, Rescue Hook)
    safety_specs = [
        ('WatertightDoor', 'watertight-door.glb', build_watertight_door, 0.0),
        ('CO2Extinguisher', 'co2-extinguisher.glb', build_co2_extinguisher, 1.10),
        ('HVRescueHook', 'rescue-hook.glb', build_rescue_hook, -1.10),
    ]
    for col_name, out_glb, fn, _px in safety_specs:
        reset_clean_scene()
        mats = build_clean_material_library()
        col = ensure_collection(col_name)
        fn(mats, col)
        tris, nbytes = export_collection_uncompressed_glb(col, os.path.join(models_dir, out_glb))
        stats[out_glb] = {'tris': tris, 'kb': round(nbytes / 1024.0, 1)}

    # Assemble safety fixtures side-by-side in safety_fixtures.blend for live viewport review
    reset_clean_scene()
    mats = build_clean_material_library()
    for col_name, _out_glb, fn, px in safety_specs:
        col = ensure_collection(col_name)
        r = fn(mats, col)
        if col_name == 'CO2Extinguisher':
            r.location = (px, 0.0, 0.96)
        elif col_name == 'HVRescueHook':
            r.location = (px, 0.0, 1.32)
        else:
            r.location = (px, 0.0, 0.0)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, 'safety_fixtures.blend'), compress=True)

    return stats


if __name__ == '__main__':
    print(build_all_phase3())
