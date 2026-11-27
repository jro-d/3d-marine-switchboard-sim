"""
Phase 4 Builder: PPE Locker, Permit Desk, Test Bench, Key Board, VCB Workbench & Workbench Tools
(Blender 5.3+ -> Godot 4.7 uncompressed GLBs).

Matches reference sheets:
  - assets-src/references/ref-07-ppe-locker.jpg
  - assets-src/references/ref-08-workstations-and-instruments.jpg
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


def build_ppe_locker(mats, col):
    """
    Marine HV PPE Storage Locker (1.38m W x 2.06m H x 0.62m D, facing -Y).
    Matches ref-07-ppe-locker.jpg with smooth satin teal cabinet and toggleable
    PpeLockerSuit, PpeLockerGloves, PpeLockerBoots child assemblies.
    """
    root = make_empty('PpeLockerRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # 1. Plinth base + side flanges + navy kickplate (matching ref-07)
    b.box((0.0, 0.01, 0.055), (1.36, 0.60, 0.11), 'slate_skid', bevel=0.005)
    b.box((0.0, -0.295, 0.055), (1.16, 0.012, 0.068), 'navy_kick', bevel=0.003)
    for fx, fy in ((-0.70, -0.22), (0.70, -0.22), (-0.70, 0.22), (0.70, 0.22)):
        b.box((fx, fy, 0.010), (0.065, 0.075, 0.018), 'slate_skid', bevel=0.003)
        b.cyl((fx, fy, 0.024), 0.009, 0.009, 0.010, 'stainless', segs=6)

    # 2. Satin marine-teal cabinet shell (open front recess) + top lifting eye-bolts
    b.box((0.0, 0.27, 1.08), (1.38, 0.07, 1.95), 'teal_cabinet', bevel=0.008)      # Back wall
    b.box((-0.655, 0.0, 1.08), (0.07, 0.62, 1.95), 'teal_cabinet', bevel=0.008)    # Left wall
    b.box((0.655, 0.0, 1.08), (0.07, 0.62, 1.95), 'teal_cabinet', bevel=0.008)     # Right wall
    b.box((0.0, 0.0, 2.025), (1.40, 0.65, 0.075), 'teal_cabinet', bevel=0.008)     # Top canopy
    b.box((0.0, 0.0, 0.135), (1.34, 0.60, 0.055), 'teal_cabinet', bevel=0.006)     # Floor deck

    for ex in (-0.52, 0.52):
        b.cyl((ex, 0.0, 2.068), 0.016, 0.016, 0.014, 'stainless', segs=12)
        b.torus_ring((ex, 0.0, 2.095), 0.022, 0.0065, 'stainless', major_segs=18, minor_segs=8, axis='y')

    # Dark interior backing + central vertical divider + galvanized shelves
    b.box((0.0, 0.225, 1.08), (1.24, 0.02, 1.84), 'slate_skid')
    b.box((0.05, 0.0, 1.08), (0.032, 0.54, 1.84), 'teal_cabinet', bevel=0.004)
    b.box((-0.30, -0.01, 1.58), (0.64, 0.52, 0.030), 'galv', bevel=0.004)          # Hood shelf
    b.box((0.36, -0.01, 1.58), (0.56, 0.52, 0.030), 'galv', bevel=0.004)           # Pump shelf
    b.box((0.36, -0.01, 1.12), (0.56, 0.52, 0.030), 'galv', bevel=0.004)           # Gloves shelf
    b.box((0.36, -0.01, 0.64), (0.56, 0.52, 0.030), 'galv', bevel=0.004)           # Mat shelf

    # Overhead interior LED light bar + coat hanger rod
    b.box((0.0, -0.10, 1.975), (1.06, 0.050, 0.022), 'slate_skid', bevel=0.004)
    b.box((0.0, -0.10, 1.960), (0.98, 0.030, 0.012), 'led_panel', bevel=0.002)
    b.cyl((-0.30, -0.05, 1.50), 0.012, 0.012, 0.62, 'stainless', segs=14, axis='x')

    # Pneumatic Class-2 glove air-inflator pump on upper-right shelf (permanent cabinet fixture)
    b.box((0.28, -0.02, 1.66), (0.20, 0.16, 0.13), 'grey_panel', bevel=0.006)
    b.cyl((0.24, -0.105, 1.67), 0.028, 0.028, 0.014, 'white_label', segs=16, axis='y')
    b.cyl((0.46, -0.02, 1.69), 0.055, 0.055, 0.16, 'rubber', segs=18, bevel_caps=0.005)
    b.cyl((0.46, -0.02, 1.78), 0.062, 0.062, 0.018, 'slate_skid', segs=18)

    b.finish('PpeLockerCabinet', col, parent=root)

    # 3. Left & Right Pivoted Louvered Doors (swung outward cleanly at -115 / +115 deg matching ref-07!)
    for label, sx, open_deg in (('Left', -1.0, -115.0), ('Right', 1.0, 115.0)):
        hinge = (sx * 0.655, -0.310, 1.08)
        dpivot = make_empty(f'Ppe{label}DoorPivot', hinge, col, root)
        db = CleanHardSurfaceBuilder(mats)
        door_cx = sx * 0.325
        db.box((door_cx, -0.310, 1.08), (0.64, 0.028, 1.90), 'teal_cabinet', bevel=0.006, segs=2)
        for hz in (0.34, 1.08, 1.82):
            db.cyl((sx * 0.655, -0.316, hz), 0.010, 0.010, 0.065, 'stainless', segs=12)
        # Upper and lower ventilation louvers
        for lz in (1.70, 1.75, 1.80, 1.85, 1.90, 0.24, 0.29, 0.34, 0.39, 0.44):
            db.box((door_cx, -0.326, lz), (0.38, 0.008, 0.020), 'slate_skid', bevel=0.002)
        # Pull handle on front & inside latch
        hx = sx * 0.07
        db.handle_u((hx, -0.322, 1.08), 0.14, 0.036, radius=0.0065, mat_key='stainless', axis='z')
        db.finish(f'Ppe{label}DoorMesh', col, parent=dpivot, origin=hinge, parent_is_at_origin=True)
        dpivot.rotation_euler = (0.0, 0.0, math.radians(open_deg))

    # 4. Dynamic Group 1: PpeLockerSuit (Hanging 40 cal/cm² Arc Coat + Hood with Emerald Visor)
    sb = CleanHardSurfaceBuilder(mats)
    # Coat hanger hook & shoulder frame
    sb.tube([(-0.30, -0.05, 1.50), (-0.30, -0.05, 1.46), (-0.49, -0.05, 1.40)], 0.005, 'stainless', segs=8)
    sb.tube([(-0.30, -0.05, 1.46), (-0.11, -0.05, 1.40)], 0.005, 'stainless', segs=8)
    # Sculpted hanging khaki Nomex parka + sleeves + collar + hi-vis bands
    sb.box((-0.30, -0.05, 1.08), (0.42, 0.16, 0.68), 'khaki_nomex', bevel=0.032, segs=3)
    sb.cyl((-0.30, -0.05, 1.44), 0.095, 0.090, 0.08, 'khaki_nomex', segs=18, bevel_caps=0.008)
    sb.box((-0.30, -0.132, 1.08), (0.065, 0.018, 0.62), 'olive_trim', bevel=0.004)
    for rz in (0.86, 1.12):
        sb.box((-0.30, -0.05, rz), (0.435, 0.172, 0.044), 'yellow', bevel=0.005)
        sb.box((-0.30, -0.05, rz), (0.440, 0.176, 0.016), 'stainless', bevel=0.003)
    for ax in (-0.53, -0.07):
        sb.cyl((ax, -0.05, 1.08), 0.058, 0.064, 0.56, 'khaki_nomex', segs=16, bevel_caps=0.010)
        sb.cyl((ax, -0.05, 0.86), 0.062, 0.062, 0.042, 'yellow', segs=16)
        sb.cyl((ax, -0.05, 0.81), 0.056, 0.056, 0.040, 'olive_trim', segs=16)
    # Sculpted 40 cal/cm² Switching Hood + curved emerald visor on top shelf (Z=1.60)
    sb.cyl((-0.30, -0.04, 1.75), 0.125, 0.155, 0.28, 'khaki_nomex', segs=22, bevel_caps=0.018)
    sb.cyl((-0.30, -0.04, 1.88), 0.065, 0.120, 0.065, 'khaki_nomex', segs=20, bevel_caps=0.012)
    sb.box((-0.30, -0.165, 1.76), (0.21, 0.035, 0.155), 'olive_trim', bevel=0.010)
    sb.box((-0.30, -0.176, 1.76), (0.185, 0.020, 0.128), 'emerald_visor', bevel=0.006)
    sb.finish('PpeLockerSuit', col, parent=root)

    # 5. Dynamic Group 2: PpeLockerGloves (Pair of Class 2 Orange/Leather HV Gauntlets)
    gb = CleanHardSurfaceBuilder(mats)
    for gx, palm_mat in ((0.24, 'glove_orange'), (0.46, 'leather_tan')):
        gb.cyl((gx, -0.05, 1.24), 0.058, 0.048, 0.20, 'glove_orange', segs=18, bevel_caps=0.006)
        gb.box((gx, -0.05, 1.37), (0.092, 0.042, 0.095), palm_mat, bevel=0.012, segs=2)
        for fx_off, flen in ((-0.034, 0.065), (-0.012, 0.075), (0.012, 0.072), (0.034, 0.055)):
            gb.cyl((gx + fx_off, -0.052, 1.41 + flen * 0.45), 0.009, 0.007, flen, palm_mat, segs=8, bevel_caps=0.003)
        gb.cyl((gx - 0.052, -0.062, 1.38), 0.011, 0.008, 0.052, palm_mat, segs=8, rot_euler=(0.0, -0.52, 0.0), bevel_caps=0.003)
    gb.finish('PpeLockerGloves', col, parent=root)

    # 6. Dynamic Group 3: PpeLockerBoots (Pair of 20 kV Yellow Overboots + Rolled 15 kV Mat)
    bt = CleanHardSurfaceBuilder(mats)
    for bx in (-0.40, -0.18):
        bt.box((bx, -0.04, 0.19), (0.12, 0.27, 0.048), 'rubber', bevel=0.010)
        bt.box((bx, -0.05, 0.24), (0.115, 0.25, 0.080), 'yellow', bevel=0.016)
        bt.cyl((bx, 0.01, 0.36), 0.060, 0.065, 0.22, 'yellow', segs=18, bevel_caps=0.008)
    # Rolled ribbed 15 kV dielectric mat on lower right shelf (Z = 0.66) & floor (Z = 0.26)
    for mz in (0.26, 0.75):
        bt.cyl((0.36, -0.02, mz), 0.095, 0.095, 0.48, 'yellow', segs=22, axis='x', bevel_caps=0.008)
        bt.cyl((0.36, -0.02, mz), 0.050, 0.050, 0.49, 'rubber', segs=16, axis='x')
        for sx in (0.22, 0.50):
            bt.cyl((sx, -0.02, mz), 0.099, 0.099, 0.026, 'rubber', segs=22, axis='x')
    bt.finish('PpeLockerBoots', col, parent=root)

    return root


def build_permit_desk(mats, col):
    """Permit-to-Work (PTW) & ETO Desk (1.44m W x 0.94m H x 0.68m D, facing -Y) matching ref-08."""
    root = make_empty('PermitDeskRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # Left 3-drawer pedestal + right lockable cabinet + center kneehole drawer
    b.box((-0.46, 0.02, 0.46), (0.44, 0.58, 0.84), 'slate_skid', bevel=0.007)
    for dz in (0.18, 0.45, 0.72):
        b.box((-0.46, -0.278, dz), (0.39, 0.022, 0.23), 'grey_trim', bevel=0.004)
        b.handle_u((-0.46, -0.290, dz + 0.03), 0.14, 0.026, radius=0.0055, mat_key='stainless', axis='x')

    b.box((0.46, 0.02, 0.46), (0.44, 0.58, 0.84), 'slate_skid', bevel=0.007)
    b.box((0.46, -0.278, 0.46), (0.39, 0.022, 0.77), 'grey_trim', bevel=0.004)
    b.handle_u((0.32, -0.290, 0.56), 0.14, 0.026, radius=0.0055, mat_key='stainless', axis='z')

    b.box((0.0, 0.02, 0.80), (0.50, 0.54, 0.14), 'slate_skid', bevel=0.004)
    b.box((0.0, 0.27, 0.48), (0.56, 0.04, 0.74), 'slate_skid', bevel=0.004)
    b.cyl((0.0, -0.258, 0.80), 0.012, 0.012, 0.012, 'brass', segs=12, axis='y')

    # Clean laminated oak wood countertop + rear sea-rail lip
    b.box((0.0, 0.0, 0.925), (1.44, 0.68, 0.056), 'oak_wood', bevel=0.008, segs=3)
    b.box((0.0, 0.325, 0.985), (1.44, 0.026, 0.072), 'slate_skid', bevel=0.004)

    # Red PTW Ring-Binder (left), Yellow SFT Clipboard (center), Intercom Phone (right)
    b.box((-0.44, -0.02, 0.968), (0.30, 0.36, 0.030), 'red', bevel=0.004, rot_euler=(0, 0, -0.08))
    b.box((-0.435, -0.02, 0.982), (0.275, 0.335, 0.018), 'cream_paper', bevel=0.002, rot_euler=(0, 0, -0.08))
    b.box((-0.44, -0.02, 0.992), (0.30, 0.36, 0.008), 'red', bevel=0.003, rot_euler=(0, 0, -0.08))

    b.box((0.0, -0.04, 0.964), (0.26, 0.34, 0.012), 'yellow', bevel=0.003, rot_euler=(0, 0, 0.08))
    b.box((0.0, -0.045, 0.974), (0.23, 0.30, 0.008), 'cream_paper', bevel=0.001, rot_euler=(0, 0, 0.08))
    b.box((-0.01, 0.10, 0.984), (0.10, 0.034, 0.016), 'stainless', bevel=0.003, rot_euler=(0, 0, 0.08))

    # Marine desk intercom phone
    b.box((0.40, 0.02, 0.995), (0.20, 0.22, 0.082), 'dark_fascia', bevel=0.010, rot_euler=(0, 0, 0.18))
    b.cyl((0.34, 0.02, 1.052), 0.022, 0.022, 0.19, 'rubber', segs=14, axis='y', rot_euler=(0, 0, 0.18))
    b.box((0.44, 0.04, 1.042), (0.075, 0.085, 0.014), 'relay_screen', bevel=0.002, rot_euler=(-0.22, 0, 0.18))

    # Industrial Signal Beacon Mast with wire cage (right rear at X=0.46, Y=0.22)
    bx, by = 0.46, 0.22
    b.cyl((bx, by, 0.968), 0.068, 0.056, 0.032, 'slate_skid', segs=20, bevel_caps=0.004)
    b.cyl((bx, by, 1.12), 0.018, 0.022, 0.28, 'stainless', segs=16)
    b.cyl((bx, by, 1.26), 0.052, 0.056, 0.036, 'slate_skid', segs=20, bevel_caps=0.004)
    for ang_deg in (0, 60, 120):
        rad = math.radians(ang_deg)
        ca, sa = math.cos(rad), math.sin(rad)
        pts = [
            (bx + 0.060 * ca, by + 0.060 * sa, 1.27),
            (bx + 0.072 * ca, by + 0.072 * sa, 1.34),
            (bx + 0.048 * ca, by + 0.048 * sa, 1.40),
            (bx, by, 1.415),
            (bx - 0.048 * ca, by - 0.048 * sa, 1.40),
            (bx - 0.072 * ca, by - 0.072 * sa, 1.34),
            (bx - 0.060 * ca, by - 0.060 * sa, 1.27),
        ]
        b.tube(pts, 0.004, 'stainless', segs=6)

    b.finish('PermitDeskAssembly', col, parent=root)
    make_empty('PermitBeaconSocket', (bx, by, 1.335), col, root)
    return root


def build_test_bench(mats, col):
    """Proving Unit & 5 kV Megger Bench (1.58m W x 0.90m H x 0.68m D, facing -Y) matching ref-08."""
    root = make_empty('TestBenchRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # Welded steel workbench frame + lower galvanized shelf + Pelican case + cable drum
    for lx in (-0.70, 0.70):
        for ly in (-0.26, 0.26):
            b.box((lx, ly, 0.44), (0.056, 0.056, 0.86), 'slate_skid', bevel=0.005)
        b.box((lx, 0.0, 0.22), (0.042, 0.52, 0.042), 'slate_skid', bevel=0.004)
    b.box((0.0, 0.26, 0.22), (1.40, 0.042, 0.042), 'slate_skid', bevel=0.004)
    b.box((0.0, 0.0, 0.25), (1.36, 0.50, 0.032), 'galv', bevel=0.004)

    b.box((-0.34, 0.0, 0.37), (0.46, 0.34, 0.20), 'dark_fascia', bevel=0.012, segs=2)  # Pelican case
    b.cyl((0.34, 0.0, 0.41), 0.145, 0.145, 0.095, 'rubber', segs=22, axis='y', bevel_caps=0.006)  # Lead drum
    b.cyl((0.34, 0.0, 0.41), 0.055, 0.055, 0.105, 'slate_skid', segs=16, axis='y')

    # Benchtop + green ESD mat + rear power rail
    b.box((0.0, 0.0, 0.90), (1.58, 0.68, 0.064), 'grey_trim', bevel=0.007, segs=2)
    b.box((0.0, -0.02, 0.938), (1.44, 0.54, 0.014), 'esd_green', bevel=0.004)
    b.box((0.0, 0.29, 0.975), (1.52, 0.065, 0.085), 'slate_skid', bevel=0.004)
    for sx in (-0.52, -0.38, 0.38, 0.52):
        b.box((sx, 0.255, 0.980), (0.064, 0.012, 0.064), 'white_label', bevel=0.002)

    # 1. 6.6 kV Proving Unit (-0.18, 0.04, 1.052) with yellow corner shock bumpers & ceramic sockets
    b.box((-0.18, 0.04, 1.052), (0.31, 0.22, 0.21), 'slate_skid', bevel=0.012, segs=3)
    for bx in (-0.328, -0.032):
        b.box((bx, 0.04, 1.052), (0.028, 0.232, 0.222), 'yellow', bevel=0.007)
    b.box((-0.18, -0.072, 1.052), (0.25, 0.012, 0.165), 'grey_panel', bevel=0.003)
    for px in (-0.24, -0.12):
        b.cyl((px, -0.084, 1.075), 0.020, 0.016, 0.028, 'porcelain', segs=16, axis='y', bevel_caps=0.003)
        b.cyl((px, -0.092, 1.075), 0.008, 0.008, 0.018, 'brass', segs=12, axis='y')

    # 2. 5 kV Digital Megger Tester (0.44, 0.02, 1.06)
    b.box((0.44, 0.02, 1.06), (0.39, 0.30, 0.225), 'yellow', bevel=0.016, segs=3)
    for bx in (0.252, 0.628):
        for by in (-0.122, 0.162):
            b.box((bx, by, 1.06), (0.036, 0.036, 0.236), 'rubber', bevel=0.007)
    b.box((0.44, -0.132, 1.088), (0.26, 0.016, 0.135), 'dark_fascia', bevel=0.004)
    b.box((0.44, -0.141, 1.092), (0.22, 0.008, 0.102), 'relay_screen', bevel=0.002)
    b.cyl((0.36, -0.01, 1.196), 0.034, 0.028, 0.026, 'rubber', segs=18, bevel_caps=0.004)
    for tx, tmat in ((0.33, 'red'), (0.44, 'cable_blue'), (0.55, 'rubber')):
        b.cyl((tx, 0.095, 1.196), 0.016, 0.014, 0.028, tmat, segs=14, bevel_caps=0.003)

    # 3. Resting 6.6 kV Proving Wand along front of bench
    b.cyl((-0.34, -0.20, 0.968), 0.020, 0.020, 0.20, 'rubber', segs=16, axis='x', bevel_caps=0.004)
    b.cyl((-0.02, -0.20, 0.968), 0.015, 0.013, 0.68, 'orange_fg', segs=16, axis='x')
    b.cyl((-0.23, -0.20, 0.968), 0.036, 0.036, 0.016, 'red', segs=18, axis='x', bevel_caps=0.003)
    b.cyl((0.38, -0.20, 0.968), 0.007, 0.004, 0.095, 'silver', segs=12, axis='x')

    b.finish('TestBenchAssembly', col, parent=root)
    make_empty('ProvingLedSocket', (-0.18, -0.07, 1.168), col, root)
    return root


def build_key_board(mats, col):
    """LOTO Key Box & Tool Board (1.58m W x 1.98m H x 0.68m D, facing -Y) matching ref-08."""
    root = make_empty('KeyBoardRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # Frame + benchtop + dark pegboard backing
    for lx in (-0.70, 0.70):
        for ly in (-0.26, 0.26):
            b.box((lx, ly, 0.44), (0.056, 0.056, 0.86), 'slate_skid', bevel=0.005)
    b.box((0.0, 0.0, 0.90), (1.58, 0.68, 0.068), 'grey_trim', bevel=0.007, segs=2)
    b.box((0.0, -0.03, 0.938), (1.42, 0.52, 0.012), 'rubber', bevel=0.004)

    b.box((0.0, 0.295, 1.48), (1.54, 0.044, 1.08), 'slate_skid', bevel=0.006)
    b.box((0.0, 0.272, 2.01), (1.56, 0.056, 0.042), 'grey_trim', bevel=0.005)
    for sx in (-0.76, 0.76):
        b.box((sx, 0.272, 1.48), (0.042, 0.056, 1.09), 'grey_trim', bevel=0.005)

    # Group LOTO Red Steel Key Lockbox (mounted on pegboard left matching ref-08!)
    b.box((-0.44, 0.16, 1.56), (0.34, 0.22, 0.36), 'red', bevel=0.010, segs=2)
    b.box((-0.44, 0.048, 1.56), (0.24, 0.012, 0.26), 'slate_skid', bevel=0.003)
    b.box((-0.44, 0.042, 1.56), (0.21, 0.006, 0.23), 'glass')

    # 6 LOTO Padlocks + 6 Brass Castell Keys on shadow board
    for i in range(6):
        px = -0.14 + i * 0.11
        pmat = 'red' if i < 4 else 'yellow'
        b.cyl((px, 0.245, 1.76), 0.005, 0.005, 0.05, 'stainless', segs=8, axis='y')
        b.box((px, 0.225, 1.705), (0.044, 0.022, 0.052), pmat, bevel=0.004)
        b.cyl((px, 0.225, 1.745), 0.014, 0.014, 0.010, 'stainless', segs=12, axis='y')
        b.cyl((px, 0.225, 1.52), 0.018, 0.018, 0.008, 'brass', segs=14, axis='y')
        b.box((px, 0.225, 1.475), (0.012, 0.008, 0.058), 'brass', bevel=0.002)

    # Horizontal Yellow Fiberglass Earth Stick + Wall-Mounted Racking Crank + Danger Tags Tray
    b.cyl((-0.12, 0.215, 1.15), 0.016, 0.016, 0.96, 'yellow', segs=16, axis='x', bevel_caps=0.003)
    b.cyl((0.26, 0.215, 1.15), 0.022, 0.022, 0.16, 'rubber', segs=14, axis='x')
    b.cyl((0.52, 0.225, 1.44), 0.013, 0.013, 0.42, 'stainless', segs=14)
    b.box((0.58, 0.225, 1.65), (0.14, 0.022, 0.026), 'stainless', bevel=0.004)
    b.cyl((0.64, 0.175, 1.65), 0.016, 0.016, 0.10, 'rubber', segs=14, axis='y')

    b.box((0.46, -0.04, 0.968), (0.28, 0.22, 0.045), 'slate_skid', bevel=0.005)
    b.box((0.46, -0.04, 0.992), (0.24, 0.18, 0.010), 'white_label', bevel=0.002)

    b.finish('KeyBoardAssembly', col, parent=root)
    make_empty('KeyBoxLedSocket', (-0.44, 0.05, 1.76), col, root)
    return root


def build_vcb_workbench(mats, col):
    """VCB Diagnostic Workbench (1.52m W x 1.92m H x 0.68m D, facing -Y) matching ref-08."""
    root = make_empty('VcbWorkbenchRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # Frame + Red 3-Drawer Under-Bench Tool Chest under right half (matching ref-08!)
    for lx in (-0.68, 0.68):
        for ly in (-0.27, 0.27):
            b.box((lx, ly, 0.44), (0.058, 0.058, 0.86), 'slate_skid', bevel=0.005)
        b.box((lx, 0.0, 0.22), (0.044, 0.54, 0.044), 'slate_skid', bevel=0.004)
    b.box((0.0, 0.27, 0.22), (1.36, 0.044, 0.044), 'slate_skid', bevel=0.004)

    b.box((0.34, 0.0, 0.45), (0.58, 0.52, 0.78), 'red', bevel=0.008)
    for dz in (0.22, 0.45, 0.68):
        b.box((0.34, -0.268, dz), (0.52, 0.022, 0.18), 'red', bevel=0.005)
        b.box((0.34, -0.284, dz + 0.05), (0.44, 0.016, 0.022), 'stainless', bevel=0.003)

    # Benchtop + Green ESD Mat + Overhead Task Light Hood + Pegboard
    b.box((0.0, 0.0, 0.90), (1.52, 0.68, 0.068), 'grey_trim', bevel=0.007, segs=2)
    b.box((0.0, -0.02, 0.938), (1.36, 0.54, 0.014), 'esd_green', bevel=0.004)

    b.box((0.0, 0.305, 1.42), (1.48, 0.042, 0.94), 'slate_skid', bevel=0.006)
    b.box((0.0, 0.20, 1.90), (1.50, 0.24, 0.046), 'grey_trim', bevel=0.006)
    b.box((0.0, 0.15, 1.872), (1.28, 0.065, 0.014), 'led_panel', bevel=0.002)

    # 4 Hanging Wrenches (left) + 2 rows of 4 Blue Parts Bins (right, matching ref-08!)
    for i in range(4):
        wx = -0.54 + i * 0.11
        wlen = 0.26 - i * 0.025
        b.box((wx, 0.268, 1.54), (0.022, 0.009, wlen), 'stainless', bevel=0.003)
        b.cyl((wx, 0.268, 1.54 + wlen * 0.5), 0.020, 0.020, 0.012, 'stainless', segs=12, axis='y')
        b.cyl((wx, 0.268, 1.54 - wlen * 0.5), 0.018, 0.018, 0.012, 'stainless', segs=12, axis='y')

    for rz in (1.36, 1.56):
        for ci in range(4):
            bx = 0.14 + ci * 0.165
            b.box((bx, 0.22, rz), (0.14, 0.13, 0.10), 'bin_blue', bevel=0.005)

    b.finish('VcbWorkbenchAssembly', col, parent=root)
    make_empty('WorkbenchToolsSocket', (0.0, -0.02, 0.946), col, root)
    return root


def build_workbench_tools(mats, col):
    """Diagnostic tools resting at (0,0,0) on VCB Workbench ESD mat (DLRO, Torque Wrench, Multimeter, Tulip Cluster)."""
    root = make_empty('WorkbenchToolsRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # 1. DLRO 100A Micro-Ohmmeter (left)
    ox = -0.34
    b.box((ox, 0.0, 0.082), (0.32, 0.26, 0.162), 'yellow', bevel=0.014, segs=3)
    b.box((ox, 0.0, 0.164), (0.28, 0.21, 0.014), 'dark_fascia', bevel=0.004)
    b.box((ox - 0.04, 0.03, 0.173), (0.14, 0.08, 0.008), 'relay_screen', bevel=0.002)
    b.cyl((ox + 0.08, 0.03, 0.180), 0.026, 0.022, 0.022, 'rubber', segs=18, bevel_caps=0.003)

    # 2. 1000V VDE Insulated Torque Wrench (center-front)
    b.cyl((-0.10, -0.14, 0.024), 0.012, 0.012, 0.26, 'stainless', segs=14, axis='x')
    b.cyl((0.05, -0.14, 0.024), 0.016, 0.016, 0.04, 'yellow', segs=14, axis='x')
    b.cyl((0.14, -0.14, 0.024), 0.018, 0.018, 0.15, 'red', segs=16, axis='x', bevel_caps=0.004)
    b.cyl((-0.24, -0.14, 0.024), 0.024, 0.024, 0.026, 'stainless', segs=18, bevel_caps=0.004)

    # 3. Digital Multimeter (right-front)
    b.box((0.40, -0.10, 0.024), (0.115, 0.185, 0.046), 'yellow', bevel=0.009, segs=2, rot_euler=(0, 0, 0.18))
    b.box((0.40, -0.10, 0.046), (0.092, 0.155, 0.010), 'dark_fascia', bevel=0.003, rot_euler=(0, 0, 0.18))
    b.box((0.40, -0.06, 0.052), (0.072, 0.052, 0.006), 'relay_screen', bevel=0.001, rot_euler=(0, 0, 0.18))

    # 4. Spare 12-Finger Copper Tulip Contact Cluster (right-rear)
    tx, ty = 0.36, 0.10
    b.cyl((tx, ty, 0.010), 0.042, 0.040, 0.018, 'copper', segs=20, bevel_caps=0.003)
    b.cyl((tx, ty, 0.036), 0.022, 0.022, 0.044, 'copper', segs=16)
    for fi in range(12):
        fang = (2.0 * math.pi * fi) / 12.0
        b.box((tx + 0.030 * math.cos(fang), ty + 0.030 * math.sin(fang), 0.048), (0.010, 0.010, 0.058), 'silver', bevel=0.002, rot_euler=(0, 0, fang))
    b.torus_ring((tx, ty, 0.038), 0.036, 0.004, 'stainless', major_segs=20, minor_segs=6, axis='z')
    b.torus_ring((tx, ty, 0.062), 0.036, 0.004, 'stainless', major_segs=20, minor_segs=6, axis='z')

    b.finish('WorkbenchToolsAssembly', col, parent=root)
    return root


def build_all_phase4():
    models_dir = os.path.join(REPO_ROOT, 'godot', 'assets', 'models')
    blend_dir = os.path.join(REPO_ROOT, 'assets-src', 'blender')
    stats = {}

    station_specs = [
        ('PpeLocker',      'ppe-locker.glb',      build_ppe_locker,      (-3.20, 0.0, 0.0)),
        ('PermitDesk',     'permit-desk.glb',     build_permit_desk,     (-1.50, 0.0, 0.0)),
        ('TestBench',      'test-bench.glb',      build_test_bench,      (0.25,  0.0, 0.0)),
        ('KeyBoard',       'key-board.glb',       build_key_board,       (2.00,  0.0, 0.0)),
        ('VcbWorkbench',   'vcb-workbench.glb',   build_vcb_workbench,   (3.75,  0.0, 0.0)),
        ('WorkbenchTools', 'workbench-tools.glb', build_workbench_tools, (3.75, -0.02, 0.946)),
    ]

    # Export each station GLB cleanly from origin in its own isolated scene
    for col_name, out_glb, fn, _pos in station_specs:
        reset_clean_scene()
        mats = build_clean_material_library()
        col = ensure_collection(col_name)
        fn(mats, col)
        tris, nbytes = export_collection_uncompressed_glb(col, os.path.join(models_dir, out_glb))
        stats[out_glb] = {'tris': tris, 'kb': round(nbytes / 1024.0, 1)}

    # Assemble all stations side-by-side in room_props.blend for visual inspection
    reset_clean_scene()
    mats = build_clean_material_library()
    for col_name, _out_glb, fn, pos in station_specs:
        col = ensure_collection(col_name)
        r = fn(mats, col)
        r.location = pos
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, 'room_props.blend'), compress=True)

    return stats


if __name__ == '__main__':
    print(build_all_phase4())
