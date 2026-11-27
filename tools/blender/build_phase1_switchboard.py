"""
Phase 1 Switchgear & VCB Cassette Builder (Blender 5.3+ -> Godot 4.7 uncompressed GLBs).
Matches reference sheets:
  - assets-src/references/ref-01-hv-switchboard-bay.jpg
  - assets-src/references/ref-02-vcb-cassette.jpg
  - assets-src/references/ref-03-lv-acb-bay.jpg
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


def _add_lifting_eyebolts_and_gland(b, top_z, positions, gland_pos):
    for ex, ey in positions:
        b.cyl((ex, ey, top_z + 0.008), 0.016, 0.016, 0.014, 'stainless', segs=12, bevel_caps=0.002)
        b.torus_ring((ex, ey, top_z + 0.036), 0.022, 0.0065, 'stainless', major_segs=18, minor_segs=8, axis='y')
    gx, gy = gland_pos
    b.cyl((gx, gy, top_z + 0.016), 0.044, 0.044, 0.030, 'stainless', segs=6, bevel_caps=0.003)
    b.cyl((gx, gy, top_z + 0.045), 0.034, 0.032, 0.032, 'slate_skid', segs=16, bevel_caps=0.003)
    b.cyl((gx, gy, top_z + 0.072), 0.026, 0.022, 0.026, 'rubber', segs=14, bevel_caps=0.002)


def build_hv_bay(mats, col):
    """
    6.6 kV Marine HV Switchgear Bay (0.80m W x 1.16m D x 2.15m H).
    Blender front faces -Y (exports to Godot -Z forward).
    """
    root = make_empty('HvBayRoot', (0, 0, 0), col)

    # 1. Static Cabinet Body + Skid + Internal Compartment + Rear Busbar Chamber
    b = CleanHardSurfaceBuilder(mats)

    # Base C-channel skid + mounting flanges + hex bolts + navy kickplate
    for sx in (-0.365, 0.365):
        b.box((sx, 0.0, 0.036), (0.056, 1.18, 0.048), 'slate_skid', bevel=0.004)
    for sy in (-0.54, 0.0, 0.54):
        b.box((0.0, sy, 0.036), (0.76, 0.052, 0.044), 'slate_skid', bevel=0.004)
    for fx, fy in ((-0.41, -0.50), (0.41, -0.50), (-0.41, 0.50), (0.41, 0.50)):
        b.box((fx, fy, 0.012), (0.075, 0.085, 0.018), 'slate_skid', bevel=0.003)
        b.cyl((fx, fy, 0.026), 0.016, 0.016, 0.006, 'stainless', segs=12)
        b.cyl((fx, fy, 0.033), 0.010, 0.010, 0.012, 'brass', segs=6)
    b.box((0.0, -0.568, 0.045), (0.74, 0.014, 0.068), 'navy_kick', bevel=0.003)

    # Outer shell walls (open front cavity for hinged LV & Breaker doors)
    b.box((-0.390, 0.0, 1.10), (0.020, 1.16, 2.04), 'grey_panel', bevel=0.004)   # Left wall
    b.box((0.390, 0.0, 1.10), (0.020, 1.16, 2.04), 'grey_panel', bevel=0.004)    # Right wall
    b.box((0.0, 0.570, 1.10), (0.80, 0.020, 2.04), 'grey_panel', bevel=0.004)    # Rear wall
    b.box((0.0, 0.0, 0.095), (0.78, 1.14, 0.020), 'slate_skid', bevel=0.003)     # Bottom floor deck
    b.box((0.0, 0.0, 1.075), (0.76, 1.12, 0.024), 'grey_trim', bevel=0.003)      # Horizontal divider shelf
    b.box((0.0, 0.0, 2.135), (0.82, 1.19, 0.032), 'galv', bevel=0.005, segs=2)   # Overhanging galvanized roof

    # Vertical rear partition separating front VCB cell from rear busbar/CT chamber
    b.box((0.0, 0.14, 0.58), (0.76, 0.018, 0.96), 'grey_trim', bevel=0.002)

    # Internal VCB guide rails inside breaker compartment (Z = 0.24, matching trolley deck height)
    for rx in (-0.26, 0.26):
        b.box((rx, -0.22, 0.22), (0.034, 0.68, 0.026), 'stainless', bevel=0.003)

    # Upper & Lower HV Spout Shutters on internal partition (Y = 0.12)
    b.box((0.0, 0.122, 0.72), (0.56, 0.014, 0.15), 'red', bevel=0.003)
    b.box((0.0, 0.122, 0.44), (0.56, 0.014, 0.15), 'yellow', bevel=0.003)

    # Rear 3-phase copper busbars + porcelain standoffs + maroon spout bushings
    for px in (-0.15, 0.0, 0.15):
        b.cyl((px, 0.18, 0.72), 0.052, 0.058, 0.09, 'epoxy', segs=18, axis='y', bevel_caps=0.004)
        b.cyl((px, 0.18, 0.44), 0.052, 0.058, 0.09, 'epoxy', segs=18, axis='y', bevel_caps=0.004)
        b.box((px, 0.34, 0.72), (0.014, 0.26, 0.048), 'copper', bevel=0.002)
        b.box((px, 0.34, 0.44), (0.014, 0.26, 0.048), 'copper', bevel=0.002)
        b.cyl((px, 0.46, 0.58), 0.022, 0.022, 0.12, 'porcelain', segs=14, axis='y')

    # Roof eye-bolts & top cable gland
    _add_lifting_eyebolts_and_gland(
        b,
        2.151,
        ((-0.34, -0.50), (0.34, -0.50), (-0.34, 0.48), (0.34, 0.48)),
        (0.0, 0.38),
    )

    b.finish('HvBayBody', col, parent=root)

    # 2. Upper LV Relay Door Pivot (hinged at left edge X = -0.376, Y = -0.582, Z = 1.60)
    lv_hinge = (-0.376, -0.582, 1.60)
    lv_pivot = make_empty('LvDoorPivot', lv_hinge, col, root)
    lb = CleanHardSurfaceBuilder(mats)

    # Door slab (Z: 1.11..2.09, X: -0.376..+0.376) + 2 barrel hinges
    lb.box((0.0, -0.582, 1.60), (0.752, 0.026, 0.98), 'grey_panel', bevel=0.005, segs=2)
    for hy in (1.26, 1.94):
        lb.cyl((-0.378, -0.590, hy), 0.010, 0.010, 0.055, 'stainless', segs=12)

    # Digital Protection IED Relay (upper center)
    lb.box((0.0, -0.602, 1.84), (0.24, 0.024, 0.24), 'dark_fascia', bevel=0.006, segs=2)
    lb.box((-0.02, -0.615, 1.86), (0.145, 0.006, 0.115), 'relay_screen', bevel=0.002)
    for kx in (-0.06, -0.02, 0.02, 0.06):
        lb.box((kx, -0.615, 1.77), (0.018, 0.006, 0.018), 'grey_trim', bevel=0.001)
    lb.box((0.08, -0.615, 1.75), (0.022, 0.006, 0.022), 'green', bevel=0.001)
    lb.box((-0.08, -0.615, 1.75), (0.022, 0.006, 0.022), 'red', bevel=0.001)

    # Mimic Diagram Plate (middle-left)
    lb.box((-0.15, -0.598, 1.44), (0.26, 0.010, 0.24), 'white_label', bevel=0.002)
    lb.box((-0.15, -0.604, 1.50), (0.010, 0.004, 0.07), 'dark_fascia')
    lb.box((-0.15, -0.604, 1.38), (0.010, 0.004, 0.07), 'dark_fascia')
    lb.box((-0.15, -0.604, 1.44), (0.14, 0.004, 0.010), 'dark_fascia')

    # 3 Pilot Lamps (Amber, Red, Green) + Selector Switch + Castell Key Lock
    for lx, lmat in ((0.06, 'lamp_amber'), (0.14, 'lamp_red'), (0.22, 'lamp_green')):
        lb.cyl((lx, -0.602, 1.53), 0.022, 0.020, 0.014, 'dark_fascia', segs=16, axis='y')
        lb.cyl((lx, -0.610, 1.53), 0.016, 0.014, 0.012, lmat, segs=16, axis='y')
        lb.box((lx, -0.598, 1.57), (0.048, 0.006, 0.022), 'white_label', bevel=0.001)

    # Rotary Selector Switch
    lb.box((0.07, -0.600, 1.38), (0.075, 0.012, 0.075), 'dark_fascia', bevel=0.004)
    lb.cyl((0.07, -0.614, 1.38), 0.018, 0.016, 0.024, 'rubber', segs=14, axis='y')
    lb.box((0.07, -0.625, 1.38), (0.012, 0.014, 0.046), 'rubber', bevel=0.002)

    # Brass Castell Key Interlock Cylinder
    lb.box((0.22, -0.598, 1.43), (0.046, 0.006, 0.022), 'yellow', bevel=0.001)
    lb.cyl((0.22, -0.606, 1.38), 0.026, 0.024, 0.026, 'brass', segs=18, axis='y', bevel_caps=0.003)
    lb.box((0.22, -0.620, 1.38), (0.006, 0.008, 0.024), 'dark_fascia')

    # Stainless U-handle latch on right side
    lb.handle_u((0.31, -0.595, 1.60), 0.13, 0.036, radius=0.007, mat_key='stainless', axis='z')

    lb.finish('HvLvDoor', col, parent=lv_pivot, origin=lv_hinge, parent_is_at_origin=True)

    # 3. Lower Breaker Compartment Door Pivot (hinged at left edge X = -0.376, Y = -0.582, Z = 0.59)
    br_hinge = (-0.376, -0.582, 0.59)
    br_pivot = make_empty('BreakerDoorPivot', br_hinge, col, root)
    bb = CleanHardSurfaceBuilder(mats)

    # Framed door built from 4 stiles/rails around recessed window cutout (window Z: 0.63..0.88, X: -0.15..+0.15)
    bb.box((0.0, -0.582, 0.365), (0.752, 0.026, 0.53), 'grey_panel', bevel=0.005, segs=2)   # Lower panel
    bb.box((0.0, -0.582, 0.975), (0.752, 0.026, 0.19), 'grey_panel', bevel=0.005, segs=2)   # Top rail
    bb.box((-0.263, -0.582, 0.755), (0.226, 0.026, 0.25), 'grey_panel', bevel=0.004)        # Left stile
    bb.box((0.263, -0.582, 0.755), (0.226, 0.026, 0.25), 'grey_panel', bevel=0.004)         # Right stile
    # Window bezel + clear safety glass
    bb.box((0.0, -0.596, 0.885), (0.33, 0.012, 0.022), 'grey_trim', bevel=0.003)
    bb.box((0.0, -0.596, 0.625), (0.33, 0.012, 0.022), 'grey_trim', bevel=0.003)
    bb.box((-0.155, -0.596, 0.755), (0.022, 0.012, 0.28), 'grey_trim', bevel=0.003)
    bb.box((0.155, -0.596, 0.755), (0.022, 0.012, 0.28), 'grey_trim', bevel=0.003)
    bb.box((0.0, -0.584, 0.755), (0.295, 0.008, 0.245), 'glass')

    # Hinges on left edge
    for hy in (0.22, 0.59, 0.96):
        bb.cyl((-0.378, -0.590, hy), 0.010, 0.010, 0.055, 'stainless', segs=12)

    # 6.6 kV HV Hazard Triangle Placard
    bb.box((0.0, -0.597, 0.44), (0.145, 0.008, 0.135), 'yellow', bevel=0.002)
    bb.box((0.0, -0.602, 0.41), (0.110, 0.004, 0.032), 'white_label', bevel=0.001)

    # Stainless L-handle latch + lower lock cylinder
    bb.cyl((0.30, -0.600, 0.36), 0.020, 0.020, 0.020, 'stainless', segs=16, axis='y')
    bb.box((0.24, -0.614, 0.36), (0.12, 0.014, 0.020), 'stainless', bevel=0.004, segs=2)
    bb.cyl((0.30, -0.598, 0.28), 0.011, 0.011, 0.012, 'stainless', segs=12, axis='y')

    bb.finish('HvBreakerDoor', col, parent=br_pivot, origin=br_hinge, parent_is_at_origin=True)

    return root


def build_vcb_cassette(mats, col):
    """
    Withdrawable 6.6 kV VCB Cassette (0.50m W x 0.42m chassis D x 0.68m H, rear arms to Y=+0.52).
    Origin at bottom center (0,0,0) resting flush on bay guide rails / trolley bed.
    """
    root = make_empty('VcbCassetteRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # 1. Wheeled Carriage Chassis + Brass Lead-Screw + Front Curved Tubular Pull-Handle
    b.box((0.0, 0.0, 0.095), (0.48, 0.42, 0.062), 'slate_skid', bevel=0.005, segs=2)
    b.box((0.0, 0.0, 0.055), (0.28, 0.24, 0.040), 'dark_fascia', bevel=0.004)
    # 4 flanged steel wheels + axles
    for wy in (-0.14, 0.14):
        b.cyl((0.0, wy, 0.048), 0.012, 0.012, 0.48, 'slate_skid', segs=12, axis='x')
        for wx in (-0.225, 0.225):
            b.cyl((wx, wy, 0.048), 0.048, 0.048, 0.028, 'stainless', segs=22, axis='x', bevel_caps=0.003)
            b.cyl((wx, wy, 0.048), 0.024, 0.024, 0.032, 'grey_trim', segs=16, axis='x')
    # Central front brass lead-screw & nut
    b.cyl((0.0, -0.04, 0.065), 0.014, 0.014, 0.36, 'brass', segs=16, axis='y')
    b.cyl((0.0, -0.228, 0.088), 0.026, 0.026, 0.024, 'brass', segs=18, axis='y', bevel_caps=0.003)
    # Front curved black tubular pull-handle
    b.tube(
        [
            (-0.18, -0.21, 0.105),
            (-0.18, -0.295, 0.125),
            (0.18, -0.295, 0.125),
            (0.18, -0.21, 0.105),
        ],
        0.012,
        'rubber',
        segs=12,
    )

    # 2. Front Operating Mechanism Housing + Fascia
    b.box((0.0, -0.115, 0.395), (0.46, 0.17, 0.54), 'grey_trim', bevel=0.008, segs=2)
    b.box((0.0, -0.202, 0.395), (0.41, 0.018, 0.48), 'grey_panel', bevel=0.005, segs=2)

    # Mechanical OPEN (green) / CLOSED (red) / SPRING CHARGED (yellow) flags
    b.box((-0.085, -0.214, 0.545), (0.095, 0.008, 0.048), 'green', bevel=0.002, rot_euler=(0, 0.25, 0))
    b.box((0.045, -0.214, 0.545), (0.095, 0.008, 0.048), 'red', bevel=0.002, rot_euler=(0, -0.25, 0))
    b.box((-0.020, -0.214, 0.485), (0.110, 0.008, 0.036), 'yellow', bevel=0.002)

    # Push-to-Close (green) & Push-to-Trip (red) buttons + counter + racking socket
    b.cyl((-0.075, -0.214, 0.420), 0.020, 0.018, 0.018, 'green', segs=16, axis='y', bevel_caps=0.002)
    b.cyl((0.035, -0.214, 0.420), 0.020, 0.018, 0.018, 'red', segs=16, axis='y', bevel_caps=0.002)
    b.box((-0.065, -0.213, 0.355), (0.078, 0.008, 0.024), 'dark_fascia', bevel=0.001)
    b.cyl((-0.020, -0.212, 0.275), 0.028, 0.026, 0.018, 'grey_trim', segs=18, axis='y')
    b.cyl((-0.020, -0.220, 0.275), 0.014, 0.014, 0.014, 'dark_fascia', segs=6, axis='y')

    # Right vertical charging lever slot + lever
    b.box((0.145, -0.214, 0.415), (0.036, 0.014, 0.30), 'dark_fascia', bevel=0.003)
    b.box((0.145, -0.225, 0.425), (0.016, 0.018, 0.22), 'slate_skid', bevel=0.002)

    # 3. Three Cast-Epoxy HV Poles + Six Copper Contact Arms + Silver Tulip Clusters
    for px in (-0.15, 0.0, 0.15):
        # Mounting base flange
        b.box((px, 0.06, 0.142), (0.125, 0.16, 0.024), 'epoxy', bevel=0.004)
        # Main vertical epoxy pole housing
        b.box((px, 0.06, 0.405), (0.105, 0.125, 0.51), 'epoxy', bevel=0.016, segs=3)
        # Upper (Z=0.54) and lower (Z=0.28) copper contact arms extending to Y=+0.45
        for az in (0.28, 0.54):
            b.cyl((px, 0.26, az), 0.022, 0.022, 0.34, 'copper', segs=18, axis='y')
            # Collar step + 8 radial silver-plated tulip fingers + twin garter rings
            b.cyl((px, 0.435, az), 0.028, 0.028, 0.028, 'silver', segs=18, axis='y', bevel_caps=0.003)
            for fi in range(8):
                fang = (2.0 * math.pi * fi) / 8.0
                fx = px + 0.024 * math.cos(fang)
                fz = az + 0.024 * math.sin(fang)
                b.box((fx, 0.485, fz), (0.010, 0.085, 0.010), 'silver', bevel=0.002, rot_euler=(0.0, fang, 0.0))
            b.torus_ring((px, 0.465, az), 0.030, 0.0035, 'stainless', major_segs=16, minor_segs=6, axis='y')
            b.torus_ring((px, 0.505, az), 0.030, 0.0035, 'stainless', major_segs=16, minor_segs=6, axis='y')

    b.finish('VcbCassetteAssembly', col, parent=root)
    return root


def build_lv_bay(mats, col):
    """
    440V Marine LV Air Circuit Breaker (ACB) Bay (0.76m W x 1.04m D x 2.06m H).
    Matches ref-03-lv-acb-bay.jpg.
    """
    root = make_empty('LvBayRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # Base skid + flanges + navy kickplate
    for sx in (-0.345, 0.345):
        b.box((sx, 0.0, 0.035), (0.052, 1.04, 0.044), 'slate_skid', bevel=0.004)
    for fx, fy in ((-0.39, -0.44), (0.39, -0.44), (-0.39, 0.44), (0.39, 0.44)):
        b.box((fx, fy, 0.012), (0.072, 0.080, 0.018), 'slate_skid', bevel=0.003)
        b.cyl((fx, fy, 0.028), 0.010, 0.010, 0.014, 'brass', segs=6)
    b.box((0.0, -0.508, 0.044), (0.70, 0.014, 0.066), 'navy_kick', bevel=0.003)

    # Enclosure walls & roof
    b.box((-0.370, 0.0, 1.055), (0.020, 1.04, 1.95), 'grey_panel', bevel=0.004)
    b.box((0.370, 0.0, 1.055), (0.020, 1.04, 1.95), 'grey_panel', bevel=0.004)
    b.box((0.0, 0.510, 1.055), (0.76, 0.020, 1.95), 'grey_panel', bevel=0.004)
    b.box((0.0, 0.0, 0.092), (0.72, 1.00, 0.020), 'slate_skid', bevel=0.003)
    b.box((0.0, 0.0, 2.045), (0.78, 1.07, 0.032), 'galv', bevel=0.005, segs=2)
    b.box((0.0, -0.525, 2.015), (0.24, 0.012, 0.044), 'white_label', bevel=0.002)  # 440V LV header

    _add_lifting_eyebolts_and_gland(
        b,
        2.061,
        ((-0.32, -0.44), (0.32, -0.44), (-0.32, 0.42), (0.32, 0.42)),
        (0.0, 0.34),
    )

    # Middle Recessed Drawout 440V ACB Unit (Z = 0.72..1.18) with sealed cabinet front surround
    b.box((0.0, -0.506, 0.95), (0.72, 0.020, 0.48), 'grey_trim', bevel=0.004)
    b.box((0.0, -0.505, 0.95), (0.58, 0.075, 0.42), 'dark_fascia', bevel=0.008, segs=2)
    b.box((-0.02, -0.548, 1.06), (0.14, 0.014, 0.095), 'relay_screen', bevel=0.002)
    b.box((-0.065, -0.548, 0.96), (0.042, 0.014, 0.042), 'red', bevel=0.002)
    b.box((0.025, -0.548, 0.96), (0.042, 0.014, 0.042), 'green', bevel=0.002)
    # Charging pump lever
    b.box((0.145, -0.552, 0.94), (0.044, 0.028, 0.24), 'slate_skid', bevel=0.004)
    # Racking socket
    b.cyl((-0.18, -0.548, 0.84), 0.020, 0.020, 0.016, 'stainless', segs=14, axis='y')

    b.finish('LvBayBody', col, parent=root)

    # Upper Metering Door Pivot
    up_hinge = (-0.356, -0.522, 1.60)
    up_pivot = make_empty('LvUpperDoorPivot', up_hinge, col, root)
    ub = CleanHardSurfaceBuilder(mats)
    ub.box((0.0, -0.522, 1.60), (0.712, 0.024, 0.76), 'grey_panel', bevel=0.005, segs=2)
    for hy in (1.32, 1.88):
        ub.cyl((-0.358, -0.530, hy), 0.009, 0.009, 0.050, 'stainless', segs=12)
    # Digital power meter
    ub.box((0.0, -0.540, 1.79), (0.21, 0.020, 0.21), 'dark_fascia', bevel=0.005)
    ub.box((-0.02, -0.551, 1.81), (0.13, 0.006, 0.10), 'relay_screen', bevel=0.002)
    # 3 Analog Ammeter Gauges
    for ax in (-0.21, -0.10, 0.01):
        ub.box((ax, -0.538, 1.54), (0.082, 0.014, 0.082), 'dark_fascia', bevel=0.003)
        ub.box((ax, -0.546, 1.54), (0.068, 0.004, 0.068), 'white_label')
    # Pilot lamps + selector + Castell lock + handle
    for lx, lmat in ((0.14, 'lamp_red'), (0.21, 'lamp_green')):
        ub.cyl((lx, -0.542, 1.54), 0.020, 0.018, 0.014, 'dark_fascia', segs=14, axis='y')
        ub.cyl((lx, -0.550, 1.54), 0.014, 0.012, 0.012, lmat, segs=14, axis='y')
    ub.box((0.08, -0.540, 1.38), (0.070, 0.012, 0.070), 'dark_fascia', bevel=0.003)
    ub.cyl((0.08, -0.552, 1.38), 0.016, 0.015, 0.022, 'rubber', segs=14, axis='y')
    ub.cyl((0.21, -0.544, 1.38), 0.024, 0.022, 0.024, 'brass', segs=16, axis='y')
    ub.handle_u((0.29, -0.535, 1.58), 0.12, 0.034, radius=0.0065, mat_key='stainless', axis='z')
    ub.finish('LvUpperDoor', col, parent=up_pivot, origin=up_hinge, parent_is_at_origin=True)

    # Lower Ventilated Feeder Door Pivot
    lo_hinge = (-0.356, -0.522, 0.40)
    lo_pivot = make_empty('LvLowerDoorPivot', lo_hinge, col, root)
    db = CleanHardSurfaceBuilder(mats)
    db.box((0.0, -0.522, 0.40), (0.712, 0.024, 0.60), 'grey_panel', bevel=0.005, segs=2)
    for hy in (0.18, 0.62):
        db.cyl((-0.358, -0.530, hy), 0.009, 0.009, 0.050, 'stainless', segs=12)
    # 3 columns x 7 louver slats
    for col_x in (-0.18, 0.0, 0.18):
        for r in range(7):
            lz = 0.20 + r * 0.045
            db.box((col_x, -0.536, lz), (0.14, 0.010, 0.018), 'grey_trim', bevel=0.002)
    db.cyl((0.28, -0.538, 0.56), 0.018, 0.018, 0.018, 'stainless', segs=14, axis='y')
    db.box((0.23, -0.550, 0.56), (0.10, 0.012, 0.018), 'stainless', bevel=0.003)
    db.finish('LvLowerDoor', col, parent=lo_pivot, origin=lo_hinge, parent_is_at_origin=True)

    return root


def build_all_phase1():
    models_dir = os.path.join(REPO_ROOT, 'godot', 'assets', 'models')
    blend_dir = os.path.join(REPO_ROOT, 'assets-src', 'blender')

    # 1. Build VCB Cassette in its own clean scene for vcb_cassette.blend + vcb-cassette.glb
    reset_clean_scene()
    mats = build_clean_material_library()
    vcb_col = ensure_collection('VcbCassette')
    build_vcb_cassette(mats, vcb_col)
    vcb_tris, vcb_bytes = export_collection_uncompressed_glb(vcb_col, os.path.join(models_dir, 'vcb-cassette.glb'))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, 'vcb_cassette.blend'), compress=True)

    # 2. Build HV Bay + LV Bay into switchboard_bays.blend and export separate uncompressed GLBs
    reset_clean_scene()
    mats = build_clean_material_library()
    hv_col = ensure_collection('HvSwitchboardBay')
    build_hv_bay(mats, hv_col)
    hv_tris, hv_bytes = export_collection_uncompressed_glb(hv_col, os.path.join(models_dir, 'hv-bay-enclosure.glb'))

    lv_col = ensure_collection('LvAcbBay')
    lv_root = build_lv_bay(mats, lv_col)
    lv_tris, lv_bytes = export_collection_uncompressed_glb(lv_col, os.path.join(models_dir, 'lv-bay-acb.glb'))
    lv_root.location = (1.20, 0.0, 0.0)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, 'switchboard_bays.blend'), compress=True)

    return {
        'hv_bay': {'tris': hv_tris, 'kb': round(hv_bytes / 1024.0, 1)},
        'lv_bay': {'tris': lv_tris, 'kb': round(lv_bytes / 1024.0, 1)},
        'vcb_cassette': {'tris': vcb_tris, 'kb': round(vcb_bytes / 1024.0, 1)},
    }


if __name__ == '__main__':
    print(build_all_phase1())
