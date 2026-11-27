"""
Phase 2 Builder: VCB Withdrawal Trolley, 7 Handheld HV/LOTO Tools, and 15 kV Dielectric Mat
(Blender 5.3+ -> Godot 4.7 uncompressed GLBs).

Matches reference sheets:
  - assets-src/references/ref-04-vcb-trolley.jpg
  - assets-src/references/ref-05-handheld-tools.jpg
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


def build_vcb_trolley(mats, col):
    """
    VCB Withdrawal & Transport Lift Trolley (~0.72m W x 0.82m D x 0.96m H).
    Front latch hooks face -Y (Godot -Z). Deck sits at Z=0.48m default matching ref-04,
    with TrolleyDeckLift pivot so Godot can raise/lower cleanly to HvBay rail height (0.233m).
    """
    root = make_empty('VcbTrolleyRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # 1. Lower U-Frame Chassis (Z = 0.14..0.19) + Caster Fork Brackets + Hydraulic Pump Base
    for sx in (-0.31, 0.31):
        b.box((sx, 0.0, 0.175), (0.056, 0.72, 0.048), 'slate_skid', bevel=0.005)
    b.box((0.0, 0.33, 0.175), (0.676, 0.062, 0.048), 'slate_skid', bevel=0.005)    # Rear crossmember
    b.box((0.0, -0.33, 0.175), (0.676, 0.056, 0.048), 'slate_skid', bevel=0.005)   # Front tie bar
    b.box((0.0, 0.16, 0.172), (0.62, 0.072, 0.042), 'slate_skid', bevel=0.004)     # Pump mount cross-beam

    # Caster fork housings above wheels (wheel radius = 0.070, axle at Z = 0.070)
    wheel_coords = [
        (-0.27, -0.28),
        (0.27, -0.28),
        (-0.27, 0.28),
        (0.27, 0.28),
    ]
    for wx, wy in wheel_coords:
        b.cyl((wx, wy, 0.145), 0.036, 0.036, 0.014, 'stainless', segs=16)
        b.box((wx - 0.024, wy, 0.108), (0.008, 0.048, 0.076), 'stainless', bevel=0.002)
        b.box((wx + 0.024, wy, 0.108), (0.008, 0.048, 0.076), 'stainless', bevel=0.002)

    # Central Inclined Hydraulic Bottle Ram + Foot Pump Lever
    b.box((0.0, 0.16, 0.205), (0.12, 0.11, 0.032), 'slate_skid', bevel=0.004)
    b.cyl((0.0, 0.085, 0.285), 0.044, 0.044, 0.22, 'slate_skid', segs=20, rot_euler=(0.56, 0.0, 0.0), bevel_caps=0.004)
    # Rear pump pedal lever sticking back toward operator (+Y)
    b.tube([(0.05, 0.19, 0.21), (0.05, 0.34, 0.28), (0.05, 0.39, 0.31)], 0.009, 'stainless', segs=10)
    b.box((0.05, 0.39, 0.31), (0.046, 0.052, 0.016), 'rubber', bevel=0.003, rot_euler=(-0.45, 0.0, 0.0))

    # Twin Rear Safety-Yellow Uprights + Angled Ergonomic Push-Bar + Warning Crossbar
    for px in (-0.31, 0.31):
        sx = math.copysign(0.05, px)
        b.tube(
            [
                (px, 0.34, 0.18),
                (px, 0.34, 0.78),
                (px, 0.40, 0.91),
                (px, 0.42, 0.95),
                (px - sx, 0.42, 0.96),
            ],
            0.018,
            'yellow',
            segs=16,
        )
    # Center black rubber push grip
    b.cyl((0.0, 0.42, 0.96), 0.022, 0.022, 0.54, 'rubber', segs=18, axis='x', bevel_caps=0.005)
    # Yellow crossbar placard plate
    b.box((0.0, 0.34, 0.74), (0.60, 0.016, 0.115), 'yellow', bevel=0.004)
    b.box((0.0, 0.350, 0.74), (0.20, 0.004, 0.072), 'white_label', bevel=0.001)
    b.box((0.0, 0.352, 0.770), (0.20, 0.004, 0.012), 'red')

    b.finish('VcbTrolleyFrame', col, parent=root)

    # Separate Hydraulic Chrome Piston Rod terminating cleanly under the deck clevis (below Z=0.455)
    pb = CleanHardSurfaceBuilder(mats)
    pb.cyl((0.0, 0.008, 0.375), 0.022, 0.022, 0.18, 'stainless', segs=18, rot_euler=(0.56, 0.0, 0.0))
    pb.finish('TrolleyPistonRod', col, parent=root, origin=(0.0, 0.085, 0.285))

    # 2. Articulated Caster Wheels (TrolleyWheel_0..3) centered at axle origin
    for idx, (wx, wy) in enumerate(wheel_coords):
        w_origin = (wx, wy, 0.070)
        wp = make_empty(f'TrolleyWheel_{idx}', w_origin, col, root)
        wb = CleanHardSurfaceBuilder(mats)
        wb.cyl(w_origin, 0.070, 0.070, 0.036, 'rubber', segs=24, axis='x', bevel_caps=0.005)
        wb.cyl(w_origin, 0.036, 0.036, 0.040, 'stainless', segs=18, axis='x', bevel_caps=0.003)
        wb.cyl(w_origin, 0.014, 0.014, 0.046, 'slate_skid', segs=12, axis='x')
        wb.finish(f'TrolleyWheelMesh_{idx}', col, parent=wp, origin=w_origin, parent_is_at_origin=True)

    # 3. Rear Caster Foot-Brake Pedals (TrolleyBrakePedals)
    bp = CleanHardSurfaceBuilder(mats)
    for bx in (-0.21, 0.21):
        bp.box((bx, 0.30, 0.082), (0.075, 0.046, 0.016), 'red', bevel=0.004)
        bp.cyl((bx, 0.28, 0.095), 0.008, 0.008, 0.040, 'stainless', segs=10, axis='y')
    bp.finish('TrolleyBrakePedals', col, parent=root)

    # 4. Articulated Transfer Deck Assembly (TrolleyDeckLift at Z=0.48 default)
    deck_z = 0.480
    deck_origin = (0.0, 0.0, deck_z)
    deck_pivot = make_empty('TrolleyDeckLift', deck_origin, col, root)
    db = CleanHardSurfaceBuilder(mats)
    # Main flat steel deck plate
    db.box((0.0, -0.02, deck_z), (0.68, 0.68, 0.044), 'slate_skid', bevel=0.006, segs=2)
    # Twin C-channel brushed stainless VCB guide rails at X = +/-0.225 (matches VcbCassette wheels!)
    for rx in (-0.225, 0.225):
        # Bottom rail tread (top surface at deck_z + 0.024 -> VcbBedAnchor at +0.024 local Z)
        db.box((rx, -0.04, deck_z + 0.023), (0.056, 0.74, 0.008), 'stainless', bevel=0.002)
        # Outer & inner guide lips
        db.box((rx + math.copysign(0.026, rx), -0.04, deck_z + 0.042), (0.010, 0.74, 0.038), 'stainless', bevel=0.002)
        db.box((rx - math.copysign(0.024, rx), -0.04, deck_z + 0.036), (0.008, 0.72, 0.024), 'grey_trim', bevel=0.002)
        # Rear rubber bumper stop
        db.box((rx, 0.305, deck_z + 0.042), (0.046, 0.024, 0.034), 'rubber', bevel=0.004)
    db.finish('TrolleyDeckPlate', col, parent=deck_pivot, origin=deck_origin, parent_is_at_origin=True)

    # Bed Anchor Empty directly at top surface of C-channel rail tread (0, -0.02, +0.027 local Z)
    make_empty('VcbBedAnchor', (0.0, -0.02, 0.027), col, deck_pivot)

    # Twin Front Safety-Yellow Latch Hooks (TrolleyLatchHook_L / _R) inside TrolleyDeckLift
    for label, hx in (('L', -0.225), ('R', 0.225)):
        h_local = (hx, -0.375, -0.006)
        h_world = (hx, -0.375, deck_z - 0.006)
        hp = make_empty(f'TrolleyLatchHook_{label}', h_local, col, deck_pivot)
        hb = CleanHardSurfaceBuilder(mats)
        hb.cyl(h_world, 0.012, 0.012, 0.052, 'stainless', segs=12, axis='x')
        hb.box((hx, -0.395, deck_z - 0.035), (0.026, 0.028, 0.088), 'yellow', bevel=0.005)
        hb.box((hx, -0.418, deck_z - 0.072), (0.026, 0.046, 0.026), 'yellow', bevel=0.004)
        hb.box((hx, -0.432, deck_z - 0.055), (0.024, 0.016, 0.028), 'yellow', bevel=0.003)
        hb.finish(f'TrolleyLatchHookMesh_{label}', col, parent=hp, origin=h_world, parent_is_at_origin=True)

    return root


# ---------------------------------------------------------------------------
# 7 Handheld HV / LOTO Tools (GripOrigin at (0,0,0), pointing forward along -Y)
# ---------------------------------------------------------------------------
def build_proving_wand(mats, col):
    root = make_empty('ProvingWandRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)
    # Black knurled grip centered around Y=0..-0.10, shaft forward along -Y
    b.cyl((0.0, -0.03, 0.0), 0.020, 0.020, 0.22, 'rubber', segs=18, axis='y', bevel_caps=0.004)
    # Orange fiberglass shaft
    b.cyl((0.0, -0.35, 0.0), 0.014, 0.015, 0.44, 'orange_fg', segs=16, axis='y')
    # Red circular hand-guard disc
    b.cyl((0.0, -0.56, 0.0), 0.052, 0.052, 0.014, 'red', segs=24, axis='y', bevel_caps=0.003)
    # Green LED collar + dark sensor head + stepped probe tip
    b.cyl((0.0, -0.582, 0.0), 0.024, 0.024, 0.026, 'lamp_green', segs=18, axis='y', bevel_caps=0.002)
    b.cyl((0.0, -0.630, 0.0), 0.022, 0.018, 0.072, 'dark_fascia', segs=18, axis='y', bevel_caps=0.003)
    b.cyl((0.0, -0.680, 0.0), 0.014, 0.011, 0.034, 'green', segs=14, axis='y')
    b.cyl((0.0, -0.735, 0.0), 0.006, 0.0045, 0.085, 'silver', segs=12, axis='y', bevel_caps=0.002)
    b.finish('ProvingWandMesh', col, parent=root)
    make_empty('TipAnchor', (0.0, -0.778, 0.0), col, root)
    return root


def build_racking_crank(mats, col):
    root = make_empty('RackingCrankRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)
    # Black grip at (0,0,0) pointing forward (-Y), crank sweeps up (+Z) and forward (-Y) to hex socket
    b.cyl((0.0, -0.02, 0.0), 0.020, 0.020, 0.14, 'rubber', segs=18, axis='y', bevel_caps=0.004)
    b.tube(
        [
            (0.0, 0.04, 0.0),
            (0.0, 0.07, 0.01),
            (0.0, 0.07, 0.24),
            (0.0, 0.04, 0.27),
            (0.0, -0.07, 0.27),
        ],
        0.011,
        'stainless',
        segs=14,
    )
    # 6-point hex drive socket head at top front
    b.cyl((0.0, -0.10, 0.27), 0.022, 0.022, 0.065, 'stainless', segs=18, axis='y', bevel_caps=0.003)
    b.cyl((0.0, -0.125, 0.27), 0.012, 0.012, 0.024, 'dark_fascia', segs=6, axis='y')
    b.finish('RackingCrankMesh', col, parent=root)
    make_empty('TipAnchor', (0.0, -0.135, 0.27), col, root)
    return root


def build_castell_key(mats, col):
    root = make_empty('CastellKeyRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)
    # Circular brass bow centered at origin, shaft extending forward along -Y
    b.cyl((0.0, 0.0, 0.0), 0.028, 0.028, 0.007, 'brass', segs=22, bevel_caps=0.002)
    b.torus_ring((0.0, 0.0, 0.0), 0.026, 0.004, 'brass', major_segs=22, minor_segs=8, axis='z')
    b.cyl((0.0, -0.062, 0.0), 0.0065, 0.0065, 0.088, 'brass', segs=14, axis='y')
    # Coded stepped key bit
    b.box((0.011, -0.094, 0.0), (0.016, 0.024, 0.006), 'brass', bevel=0.001)
    b.box((0.015, -0.088, 0.0), (0.008, 0.007, 0.006), 'brass', bevel=0.001)
    b.box((0.015, -0.100, 0.0), (0.008, 0.007, 0.006), 'brass', bevel=0.001)
    b.finish('CastellKeyMesh', col, parent=root)
    make_empty('TipAnchor', (0.0, -0.108, 0.0), col, root)
    return root


def build_loto_padlock(mats, col):
    root = make_empty('LotoPadlockRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)
    # Red insulated padlock body + stainless U-shackle pointing forward (-Y) + white danger tag loop
    b.box((0.0, -0.01, 0.0), (0.048, 0.058, 0.024), 'red', bevel=0.005, segs=2)
    b.tube(
        [
            (-0.015, -0.036, 0.0),
            (-0.015, -0.072, 0.0),
            (-0.008, -0.084, 0.0),
            (0.008, -0.084, 0.0),
            (0.015, -0.072, 0.0),
            (0.015, -0.036, 0.0),
        ],
        0.0045,
        'stainless',
        segs=10,
    )
    # White flexible tag loop at bottom (+Y)
    b.tube(
        [
            (-0.008, 0.018, 0.0),
            (-0.012, 0.056, 0.0),
            (0.0, 0.068, 0.0),
            (0.012, 0.056, 0.0),
            (0.008, 0.018, 0.0),
        ],
        0.0032,
        'white_label',
        segs=8,
    )
    b.finish('LotoPadlockMesh', col, parent=root)
    make_empty('TipAnchor', (0.0, -0.086, 0.0), col, root)
    return root


def build_cme_earth_lead(mats, col):
    root = make_empty('CmeEarthLeadRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)
    # Black rubber grip at origin, yellow pole forward (-Y), brass C-clamp jaw, lime green cable tail
    b.cyl((0.0, -0.02, 0.0), 0.018, 0.018, 0.16, 'rubber', segs=16, axis='y', bevel_caps=0.003)
    b.cyl((0.0, -0.38, 0.0), 0.013, 0.013, 0.56, 'yellow', segs=16, axis='y')
    # Brass clamp body & screw jaw
    b.box((0.0, -0.68, 0.0), (0.032, 0.048, 0.022), 'brass', bevel=0.004)
    b.box((0.022, -0.71, 0.0), (0.038, 0.018, 0.020), 'brass', bevel=0.003)
    b.box((0.022, -0.66, 0.0), (0.034, 0.014, 0.018), 'brass', bevel=0.003)
    b.cyl((0.022, -0.68, 0.020), 0.006, 0.006, 0.055, 'brass', segs=12)
    b.cyl((0.022, -0.68, 0.048), 0.004, 0.004, 0.032, 'brass', segs=10, axis='x')
    # Lime-green earth cable looping smoothly from base of pole
    b.tube(
        [
            (0.0, 0.055, 0.0),
            (0.0, 0.095, -0.005),
            (0.015, 0.125, -0.022),
            (0.036, 0.125, -0.045),
            (0.052, 0.085, -0.072),
            (0.060, 0.010, -0.098),
            (0.052, -0.160, -0.115),
        ],
        0.0055,
        'lime_cable',
        segs=10,
    )
    b.finish('CmeEarthLeadMesh', col, parent=root)
    make_empty('TipAnchor', (0.022, -0.695, 0.0), col, root)
    return root


def build_megger_probes(mats, col):
    root = make_empty('MeggerProbesRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)
    for px, pmat in ((-0.026, 'red'), (0.026, 'dark_fascia')):
        b.cyl((px, -0.03, 0.0), 0.011, 0.010, 0.14, pmat, segs=14, axis='y', bevel_caps=0.002)
        b.cyl((px, -0.102, 0.0), 0.020, 0.019, 0.010, pmat, segs=16, axis='y', bevel_caps=0.002)
        b.cyl((px, -0.135, 0.0), 0.010, 0.007, 0.056, pmat, segs=14, axis='y')
        b.cyl((px, -0.185, 0.0), 0.0025, 0.0018, 0.052, 'silver', segs=10, axis='y')
        b.tube([(px, 0.04, 0.0), (px * 1.2, 0.11, -0.02), (px * 1.4, 0.18, -0.05)], 0.0042, pmat, segs=8)
    b.finish('MeggerProbesMesh', col, parent=root)
    make_empty('TipAnchor', (-0.026, -0.212, 0.0), col, root)
    return root


def build_ptw_clipboard(mats, col):
    root = make_empty('PtwClipboardRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)
    # Dark slate clipboard held cleanly flat along -Y
    b.box((0.0, -0.12, 0.0), (0.23, 0.31, 0.010), 'slate_skid', bevel=0.004, segs=2)
    b.box((0.0, -0.125, 0.006), (0.195, 0.265, 0.003), 'cream_paper', bevel=0.001)
    b.box((0.0, -0.228, 0.008), (0.185, 0.028, 0.002), 'red', bevel=0.001)
    # Stainless clip mechanism at top edge (-Y)
    b.box((0.0, -0.262, 0.010), (0.095, 0.032, 0.012), 'stainless', bevel=0.003)
    b.cyl((0.0, -0.278, 0.012), 0.014, 0.014, 0.006, 'stainless', segs=16)
    b.finish('PtwClipboardMesh', col, parent=root)
    make_empty('TipAnchor', (0.0, -0.12, 0.010), col, root)
    return root


def build_dielectric_mat(mats, col):
    """15 kV Switchboard Roll-Out Dielectric Floor Mat (4.42m x 0.92m x 0.012m)."""
    root = make_empty('DielectricMatRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)
    # Yellow safety beveled outer border
    b.box((0.0, 0.0, 0.004), (4.42, 0.92, 0.008), 'yellow', bevel=0.004)
    # Smooth dark rubber dielectric slab
    b.box((0.0, 0.0, 0.007), (4.34, 0.84, 0.010), 'mat_rubber', bevel=0.003)
    # Subtle longitudinal non-slip ribs (clean geometry instead of noisy 128px bump)
    for ry in (-0.34, -0.24, -0.14, -0.04, 0.06, 0.16, 0.26, 0.36):
        b.box((0.0, ry, 0.013), (4.26, 0.016, 0.003), 'rubber', bevel=0.001)
    b.finish('DielectricMatMesh', col, parent=root)
    return root


def build_all_phase2():
    models_dir = os.path.join(REPO_ROOT, 'godot', 'assets', 'models')
    blend_dir = os.path.join(REPO_ROOT, 'assets-src', 'blender')
    stats = {}

    tool_specs = [
        ('ProvingWand', 'proving-wand.glb', build_proving_wand, -1.20),
        ('RackingCrank', 'racking-crank.glb', build_racking_crank, -0.80),
        ('CastellKey', 'castell-key.glb', build_castell_key, -0.45),
        ('LotoPadlock', 'loto-padlock.glb', build_loto_padlock, -0.15),
        ('CmeEarthLead', 'cme-earth-lead.glb', build_cme_earth_lead, 0.25),
        ('MeggerProbes', 'megger-probes.glb', build_megger_probes, 0.65),
        ('PtwClipboard', 'ptw-clipboard.glb', build_ptw_clipboard, 1.05),
    ]

    # Export each standalone tool GLB in its own clean scene so every tool has exact `TipAnchor` (no .001 rename!)
    for col_name, out_glb, fn, _preview_x in tool_specs:
        reset_clean_scene()
        mats = build_clean_material_library()
        col = ensure_collection(col_name)
        fn(mats, col)
        tris, nbytes = export_collection_uncompressed_glb(col, os.path.join(models_dir, out_glb))
        stats[out_glb] = {'tris': tris, 'kb': round(nbytes / 1024.0, 1)}

    # Build Trolley + Dielectric Mat + combined scene in trolley_and_tools.blend
    reset_clean_scene()
    mats = build_clean_material_library()

    trolley_col = ensure_collection('VcbTrolley')
    build_vcb_trolley(mats, trolley_col)
    t_tris, t_bytes = export_collection_uncompressed_glb(trolley_col, os.path.join(models_dir, 'vcb-trolley.glb'))
    stats['vcb_trolley'] = {'tris': t_tris, 'kb': round(t_bytes / 1024.0, 1)}

    mat_col = ensure_collection('DielectricMat')
    mat_root = build_dielectric_mat(mats, mat_col)
    m_tris, m_bytes = export_collection_uncompressed_glb(mat_col, os.path.join(models_dir, 'dielectric-mat.glb'))
    stats['dielectric_mat'] = {'tris': m_tris, 'kb': round(m_bytes / 1024.0, 1)}
    mat_root.location = (0.0, -1.25, 0.0)

    for col_name, _out_glb, fn, preview_x in tool_specs:
        col = ensure_collection(col_name)
        t_root = fn(mats, col)
        t_root.location = (preview_x, 0.90, 0.25)

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, 'trolley_and_tools.blend'), compress=True)
    return stats


if __name__ == '__main__':
    print(build_all_phase2())
