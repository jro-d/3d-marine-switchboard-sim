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


def _rot_xy(px, py, cx, cy, deg):
    """Rotate 2D point (px, py) around (cx, cy) by *deg* degrees."""
    rad = math.radians(deg)
    ca, sa = math.cos(rad), math.sin(rad)
    dx, dy = px - cx, py - cy
    return cx + dx * ca - dy * sa, cy + dx * sa + dy * ca


def _ellipse_ring(cx, cy, z, rx, ry, segs=32, front_extra=0.0, fold_amp=0.0, fold_freq=4.0, y_shift=0.0, yaw_deg=0.0, pivot_y=None):
    """Build a smooth closed 3D anatomical/fabric loop around (cx, cy, z)."""
    pts = []
    py_piv = cy if pivot_y is None else pivot_y
    for i in range(segs):
        a = (2.0 * math.pi * i) / segs
        ca, sa = math.cos(a), math.sin(a)
        # Front is -Y (sa < 0)
        ry_here = ry + (front_extra * max(0.0, -sa))
        fold = fold_amp * math.sin(a * fold_freq)
        px = cx + (rx + fold) * ca
        py = cy + y_shift + (ry_here + fold * 0.6) * sa
        if abs(yaw_deg) > 1e-4:
            px, py = _rot_xy(px, py, cx, py_piv, yaw_deg)
        pts.append((px, py, z))
    return pts


def _boot_footprint_ring(cx, cy, z, scale_x=1.0, scale_y=1.0, segs=30, toe_z_lift=0.0, yaw_deg=0.0, pivot_y=-0.02):
    """Smooth C1-continuous convex boot footprint oriented toward -Y (toe) and +Y (heel)."""
    pts = []
    for i in range(segs):
        a = (2.0 * math.pi * i) / segs
        ca, sa = math.cos(a), math.sin(a)
        t_front = max(0.0, -sa)
        t_back = max(0.0, sa)
        # Continuous lateral profile: smooth gentle ball-of-foot swell -> rounded toe & rounded heel
        rx = (0.0535 + 0.0045 * t_front - 0.009 * (t_front ** 2.4) - 0.0045 * (t_back ** 2.0)) * scale_x
        ry = (0.162 if sa < 0.0 else 0.108) * scale_y
        z_off = toe_z_lift * (max(0.0, (t_front - 0.50) / 0.50) ** 1.4)
        px, py = cx + rx * ca, cy + ry * sa
        if abs(yaw_deg) > 1e-4:
            px, py = _rot_xy(px, py, cx, pivot_y, yaw_deg)
        pts.append((px, py, z + z_off))
    return pts


def _interp_torso_params(z, stations):
    """Linearly interpolate (rx, ry, front_extra, fold_amp) at height *z* across sorted stations."""
    if z <= stations[0][0]:
        return stations[0][1:]
    if z >= stations[-1][0]:
        return stations[-1][1:]
    for i in range(len(stations) - 1):
        z0, rx0, ry0, fe0, fa0 = stations[i]
        z1, rx1, ry1, fe1, fa1 = stations[i + 1]
        if z0 <= z <= z1:
            t = (z - z0) / max(1e-6, z1 - z0)
            return (
                rx0 + (rx1 - rx0) * t,
                ry0 + (ry1 - ry0) * t,
                fe0 + (fe1 - fe0) * t,
                fa0 + (fa1 - fa0) * t,
            )
    return stations[-1][1:]


def _spiral_mat_ribbon(b, cx, cy_center_z, y_pos, width_x=0.45, r_inner=0.024, r_outer=0.088, turns=3.72, thick=0.0065):
    """Build a coiled multi-layer 15 kV rubber mat roll showing crisp yellow outer & spiral end layers."""
    steps = 88
    half_x = width_x * 0.5
    slot_y = b._slot('yellow')
    slot_d = b._slot('mat_rubber')

    outer_L, outer_R, inner_L, inner_R = [], [], [], []
    for i in range(steps + 1):
        t = i / steps
        ang = t * turns * 2.0 * math.pi
        r = r_inner + (r_outer - r_inner) * t
        ny = math.cos(ang)
        nz = math.sin(ang)
        py = y_pos + r * ny
        pz = cy_center_z + r * nz
        outer_L.append(b.bm.verts.new((cx - half_x, py + thick * ny, pz + thick * nz)))
        outer_R.append(b.bm.verts.new((cx + half_x, py + thick * ny, pz + thick * nz)))
        inner_L.append(b.bm.verts.new((cx - half_x, py, pz)))
        inner_R.append(b.bm.verts.new((cx + half_x, py, pz)))

    for i in range(steps):
        f1 = b.bm.faces.new((outer_L[i], outer_L[i + 1], outer_R[i + 1], outer_R[i]))
        f1.material_index = slot_y
        f2 = b.bm.faces.new((inner_R[i], inner_R[i + 1], inner_L[i + 1], inner_L[i]))
        f2.material_index = slot_d
        f3 = b.bm.faces.new((inner_L[i], inner_L[i + 1], outer_L[i + 1], outer_L[i]))
        f3.material_index = slot_y
        f4 = b.bm.faces.new((outer_R[i], outer_R[i + 1], inner_R[i + 1], inner_R[i]))
        f4.material_index = slot_y

    b.bm.faces.new((inner_L[0], outer_L[0], outer_R[0], inner_R[0])).material_index = slot_y
    b.bm.faces.new((outer_L[-1], inner_L[-1], inner_R[-1], outer_R[-1])).material_index = slot_y

    # Snug black rubber retaining straps + silver clasp buckles
    strap_maj = r_outer + thick * 0.72
    strap_min = 0.0048
    for sx in (cx - width_x * 0.30, cx + width_x * 0.30):
        b.torus_ring((sx, y_pos, cy_center_z), strap_maj, strap_min, 'rubber', major_segs=32, minor_segs=8, axis='x')
        b.box((sx, y_pos - strap_maj - 0.002, cy_center_z), (0.016, 0.008, 0.022), 'slate_skid', bevel=0.002)


def _build_glove_mesh(b, gx, is_right, mats_mode='leather_protector'):
    """
    Build an organic sculpted Class 2 HV gauntlet glove resting upright on Z=1.138
    with natural yaw angle, relaxed curled fingers, and seamless cuff-to-palm loft.
    """
    palm_mat = 'leather_tan' if mats_mode == 'leather_protector' else 'glove_orange'
    yaw = -12.0 if is_right else 12.0
    cy0 = -0.045

    def rp(x, y, z):
        px, py = _rot_xy(x, y, gx, cy0, yaw)
        return (px, py, z)

    # 1. Conformal elliptical rolled bottom cuff rim + continuous cuff-to-palm loft (zero circular ring!)
    cuff_specs = [
        (1.136, 0.0680, 0.0360, 0.0),
        (1.138, 0.0725, 0.0405, 0.0),   # Rolled cuff lip bottom curve
        (1.143, 0.0730, 0.0410, 0.0),   # Rolled cuff outer crest
        (1.147, 0.0695, 0.0375, 0.0),   # Rolled cuff tuck
        (1.150, 0.0655, 0.0345, 0.0),
        (1.168, 0.0620, 0.0330, 0.0),
        (1.194, 0.0565, 0.0305, 0.0),
        (1.224, 0.0515, 0.0280, 0.0),
        (1.258, 0.0460, 0.0260, 0.0),
        (1.288, 0.0440, 0.0250, 0.0),
    ]
    cuff_rings = [_ellipse_ring(gx, cy0, z, rx, ry, segs=28, fold_amp=0.0008, fold_freq=3.0, yaw_deg=yaw) for z, rx, ry, _ in cuff_specs]
    b.loft_rings(cuff_rings, 'glove_orange', cap_start=True, cap_end=False)

    # Front vent/grommet detail rotated cleanly with cuff surface
    ex, ey, ez = rp(gx + (0.013 if is_right else -0.013), cy0 - 0.028, 1.208)
    b.cyl((ex, ey, ez), 0.0045, 0.0045, 0.006, 'dark_fascia', segs=12, axis='y', rot_euler=(0, 0, math.radians(yaw)))

    # 2. Contoured palm/knuckle body (seam collar only on leather protector)
    if mats_mode == 'leather_protector':
        # Elliptical trim ring matching cuff waist
        trim_rings = [
            _ellipse_ring(gx, cy0, 1.286, 0.0455, 0.0265, segs=28, yaw_deg=yaw),
            _ellipse_ring(gx, cy0, 1.294, 0.0455, 0.0265, segs=28, yaw_deg=yaw),
        ]
        b.loft_rings(trim_rings, 'dark_fascia', cap_start=False, cap_end=False)

    palm_specs = [
        (1.288, 0.044, 0.025, 0.0),
        (1.312, 0.048, 0.025, -0.002),
        (1.342, 0.051, 0.023, -0.003),
        (1.370, 0.050, 0.020, -0.003),
        (1.390, 0.047, 0.017, -0.002),
    ]
    palm_rings = [_ellipse_ring(gx, cy0, z, rx, ry, segs=28, y_shift=yoff, yaw_deg=yaw) for z, rx, ry, yoff in palm_specs]
    b.loft_rings(palm_rings, palm_mat, cap_start=False, cap_end=True)

    # 3. 4 Relaxed Naturally Curled Tapered Fingers + Curved Opposable Thumb
    x_dir = -1.0 if is_right else 1.0
    finger_specs = [
        # (x_base, splay_dx, z_base, length, r_base, r_tip)
        (x_dir * 0.031,  x_dir * 0.006, 1.378, 0.072, 0.0108, 0.0045),   # Index
        (x_dir * 0.010,  x_dir * 0.002, 1.382, 0.082, 0.0112, 0.0046),   # Middle
        (-x_dir * 0.012, -x_dir * 0.003, 1.380, 0.076, 0.0106, 0.0044),  # Ring
        (-x_dir * 0.034, -x_dir * 0.009, 1.370, 0.060, 0.0095, 0.0040),  # Pinky
    ]
    for fx0, sdx, fz0, flen, rb, rt in finger_specs:
        pts = [
            rp(gx + fx0,              cy0 - 0.002, fz0),
            rp(gx + fx0 + sdx * 0.35, cy0 - 0.006, fz0 + flen * 0.34),
            rp(gx + fx0 + sdx * 0.68, cy0 - 0.013, fz0 + flen * 0.68),
            rp(gx + fx0 + sdx * 0.88, cy0 - 0.022, fz0 + flen * 0.90),
            rp(gx + fx0 + sdx * 0.96, cy0 - 0.027, fz0 + flen * 0.97),
            rp(gx + fx0 + sdx,        cy0 - 0.029, fz0 + flen),
        ]
        radii = [rb, rb * 0.92, rb * 0.82, rb * 0.68, rt, rt * 0.45]
        b.tube(pts, radii, palm_mat, segs=14, cap_ends=True)

    # Gently curved opposable thumb curling slightly inward toward palm
    t_pts = [
        rp(gx + x_dir * 0.034, cy0 - 0.004, 1.314),
        rp(gx + x_dir * 0.050, cy0 - 0.012, 1.338),
        rp(gx + x_dir * 0.058, cy0 - 0.022, 1.362),
        rp(gx + x_dir * 0.056, cy0 - 0.031, 1.382),
        rp(gx + x_dir * 0.053, cy0 - 0.035, 1.391),
        rp(gx + x_dir * 0.052, cy0 - 0.036, 1.394),
    ]
    b.tube(t_pts, [0.0125, 0.0112, 0.0098, 0.0084, 0.0056, 0.0026], palm_mat, segs=14, cap_ends=True)


def build_ppe_locker(mats, col):
    """
    High-Detail Marine HV PPE Storage Locker (1.38m W x 2.06m H x 0.62m D, facing -Y).
    Closely matches ref-07-ppe-locker.jpg:
      - Recessed framed double-sided louvered doors + lifting eyebolts + detailed glove pump
      - Tailored multi-station 40 cal/cm² Nomex coat (seamless raglan sleeves, cuffs, proud trim) + domed hood
      - Sculpted 5-finger Class 2 leather/orange gauntlets with natural curl
      - Molded contoured 20 kV yellow overboots with lug soles & ankle straps + spiral rolled 15 kV mats
    """
    root = make_empty('PpeLockerRoot', (0, 0, 0), col)
    b = CleanHardSurfaceBuilder(mats)

    # 1. Plinth base + side mounting flanges + navy kickplate
    b.box((0.0, 0.01, 0.055), (1.36, 0.60, 0.11), 'slate_skid', bevel=0.005)
    b.box((0.0, -0.295, 0.055), (1.16, 0.012, 0.068), 'navy_kick', bevel=0.003)
    for fx, fy in ((-0.70, -0.22), (0.70, -0.22), (-0.70, 0.22), (0.70, 0.22)):
        b.box((fx, fy, 0.010), (0.065, 0.075, 0.018), 'slate_skid', bevel=0.003)
        b.cyl((fx, fy, 0.024), 0.009, 0.009, 0.010, 'stainless', segs=6)

    # 2. Satin marine-teal cabinet shell + 4 top lifting eye-bolts
    b.box((0.0, 0.27, 1.08), (1.38, 0.07, 1.95), 'teal_cabinet', bevel=0.008)      # Back wall
    b.box((-0.655, 0.0, 1.08), (0.07, 0.62, 1.95), 'teal_cabinet', bevel=0.008)    # Left wall
    b.box((0.655, 0.0, 1.08), (0.07, 0.62, 1.95), 'teal_cabinet', bevel=0.008)     # Right wall
    b.box((0.0, 0.0, 2.025), (1.40, 0.65, 0.075), 'teal_cabinet', bevel=0.008)     # Top canopy
    b.box((0.0, 0.0, 0.135), (1.34, 0.60, 0.055), 'teal_cabinet', bevel=0.006)     # Floor deck

    for ex in (-0.54, 0.54):
        for ey in (-0.18, 0.18):
            b.cyl((ex, ey, 2.068), 0.015, 0.015, 0.014, 'stainless', segs=12)
            b.torus_ring((ex, ey, 2.094), 0.021, 0.006, 'stainless', major_segs=18, minor_segs=8, axis='y')

    # Interior backing + vertical divider + shelves + LED bar + hanger rod
    b.box((0.0, 0.225, 1.08), (1.24, 0.02, 1.84), 'slate_skid')
    b.box((0.05, 0.0, 1.08), (0.032, 0.54, 1.84), 'teal_cabinet', bevel=0.004)
    b.box((-0.30, -0.01, 1.58), (0.64, 0.52, 0.030), 'galv', bevel=0.004)
    b.box((0.36, -0.01, 1.58), (0.56, 0.52, 0.030), 'galv', bevel=0.004)
    b.box((0.36, -0.01, 1.12), (0.56, 0.52, 0.030), 'galv', bevel=0.004)
    b.box((0.36, -0.01, 0.64), (0.56, 0.52, 0.030), 'galv', bevel=0.004)

    b.box((0.0, -0.10, 1.975), (1.06, 0.050, 0.022), 'slate_skid', bevel=0.004)
    b.box((0.0, -0.10, 1.960), (0.98, 0.030, 0.012), 'led_panel', bevel=0.002)
    b.cyl((-0.30, -0.05, 1.50), 0.012, 0.012, 0.62, 'stainless', segs=14, axis='x')

    # 3. Unified Pneumatic Class-2 Glove Air-Tester Device on top-right shelf (Z = 1.595)
    # Shared instrument base chassis tray anchoring both control box and inflation bellows pedestal
    b.box((0.35, -0.01, 1.602), (0.46, 0.25, 0.014), 'slate_skid', bevel=0.004)
    for bx_bolt in (0.14, 0.56):
        for by_bolt in (-0.115, 0.095):
            b.cyl((bx_bolt, by_bolt, 1.611), 0.005, 0.005, 0.005, 'stainless', segs=6)

    # Control Box & Regulator Enclosure (left on tray: X = 0.23, Y = -0.01, Z = 1.609 .. 1.735)
    b.box((0.23, -0.01, 1.672), (0.21, 0.165, 0.126), 'grey_panel', bevel=0.008, segs=3)
    b.box((0.23, -0.093, 1.676), (0.185, 0.008, 0.102), 'dark_fascia', bevel=0.003)
    b.box((0.23, -0.095, 1.676), (0.175, 0.005, 0.094), 'grey_trim', bevel=0.002)

    # Analog Pressure Gauge (chrome bezel, white dial, safe/overpressure arc, needle & glass lens)
    gx_g, gy_g, gz_g = 0.185, -0.100, 1.682
    b.cyl((gx_g, gy_g + 0.002, gz_g), 0.032, 0.032, 0.010, 'slate_skid', segs=24, axis='y')
    b.torus_ring((gx_g, gy_g - 0.003, gz_g), 0.031, 0.0035, 'stainless', major_segs=24, minor_segs=8, axis='y')
    b.cyl((gx_g, gy_g, gz_g), 0.027, 0.027, 0.004, 'white_label', segs=24, axis='y')
    b.torus_ring((gx_g, gy_g - 0.002, gz_g), 0.021, 0.0022, 'green', major_segs=14, minor_segs=6, axis='y', rot_euler=(0, 0.9, 0), arc=math.pi * 0.85)
    b.torus_ring((gx_g, gy_g - 0.002, gz_g), 0.021, 0.0022, 'red', major_segs=8, minor_segs=6, axis='y', rot_euler=(0, -0.35, 0), arc=math.pi * 0.40)
    b.cyl((gx_g, gy_g - 0.003, gz_g), 0.0045, 0.0045, 0.005, 'brass', segs=12, axis='y')
    b.box((gx_g + 0.006, gy_g - 0.004, gz_g + 0.006), (0.020, 0.0025, 0.003), 'red', rot_euler=(0, 0.65, 0))
    b.cyl((gx_g, gy_g - 0.005, gz_g), 0.027, 0.027, 0.002, 'glass', segs=24, axis='y')

    # Regulator Knob, Guarded Power Rocker, Status LED, Spec Nameplate & Brass Barb Fittings
    b.box((0.292, -0.099, 1.706), (0.022, 0.010, 0.014), 'red', bevel=0.002)
    b.cyl((0.256, -0.099, 1.706), 0.006, 0.006, 0.008, 'green', segs=12, axis='y')
    b.cyl((0.276, -0.102, 1.670), 0.014, 0.012, 0.016, 'dark_fascia', segs=16, axis='y', bevel_caps=0.002)
    b.cyl((0.276, -0.097, 1.670), 0.016, 0.016, 0.006, 'brass', segs=6, axis='y')
    b.box((0.230, -0.097, 1.622), (0.110, 0.004, 0.012), 'white_label', bevel=0.001)
    # Front brass hose barb (connects to squeeze bulb hose) + right-side brass bulkhead (connects to bellows)
    b.cyl((0.285, -0.105, 1.640), 0.0085, 0.0085, 0.018, 'brass', segs=12, axis='y')
    b.cyl((0.342, -0.010, 1.642), 0.0095, 0.0095, 0.020, 'brass', segs=12, axis='x')

    # Right Bellows / Glove Clamping Pedestal (X = 0.48, Y = -0.01, Z = 1.609 .. 1.825)
    b.cyl((0.48, -0.01, 1.622), 0.070, 0.068, 0.026, 'slate_skid', segs=26, bevel_caps=0.003)
    b.cyl((0.48, -0.01, 1.613), 0.078, 0.078, 0.008, 'stainless', segs=26, bevel_caps=0.002)
    # Left manifold brass inlet elbow + front brass check-valve barb on bellows base
    b.cyl((0.410, -0.010, 1.630), 0.0095, 0.0095, 0.022, 'brass', segs=12, axis='x')
    b.cyl((0.480, -0.084, 1.626), 0.0085, 0.0085, 0.022, 'brass', segs=12, axis='y')

    # Hard/braided air manifold connecting control box right side straight into bellows base!
    b.tube([
        (0.350, -0.010, 1.642),
        (0.372, -0.010, 1.648),
        (0.392, -0.010, 1.642),
        (0.412, -0.010, 1.630),
    ], 0.0065, 'rubber', segs=12)

    # 7-pleat black rubber accordion bellows + top stainless glove-clamping dome & O-ring seal
    bellow_rings = []
    for bi in range(15):
        bz = 1.635 + bi * 0.0110
        br = 0.058 if bi % 2 == 1 else 0.043
        bellow_rings.append(_ellipse_ring(0.48, -0.01, bz, br, br, segs=26))
    b.loft_rings(bellow_rings, 'rubber', cap_start=True, cap_end=True)
    b.cyl((0.48, -0.01, 1.792), 0.066, 0.066, 0.016, 'stainless', segs=26, bevel_caps=0.003)
    b.torus_ring((0.48, -0.01, 1.802), 0.062, 0.0045, 'rubber', major_segs=26, minor_segs=8, axis='z')
    b.cyl((0.48, -0.01, 1.812), 0.056, 0.046, 0.016, 'grey_trim', segs=26, bevel_caps=0.004)
    for lx_c in (0.412, 0.548):
        b.box((lx_c, -0.01, 1.796), (0.012, 0.022, 0.026), 'stainless', bevel=0.002)

    # Fully plumbed front squeeze-bulb pump line: ControlBox Barb -> Squeeze Bulb (brass ferrules) -> Bellows Valve!
    b.tube([
        (0.285, -0.112, 1.640),
        (0.295, -0.155, 1.622),
        (0.320, -0.178, 1.616),
        (0.352, -0.182, 1.618),
    ], 0.0055, 'rubber', segs=12)
    b.cyl((0.352, -0.182, 1.618), 0.010, 0.010, 0.012, 'brass', segs=12, axis='x')
    b.tube([
        (0.356, -0.182, 1.618),
        (0.372, -0.182, 1.618),
        (0.388, -0.182, 1.618),
        (0.404, -0.182, 1.618),
        (0.416, -0.182, 1.618),
    ], [0.012, 0.022, 0.024, 0.018, 0.011], 'rubber', segs=16)
    b.cyl((0.416, -0.182, 1.618), 0.010, 0.010, 0.012, 'brass', segs=12, axis='x')
    b.tube([
        (0.420, -0.182, 1.618),
        (0.452, -0.170, 1.616),
        (0.475, -0.135, 1.620),
        (0.480, -0.092, 1.626),
    ], 0.0055, 'rubber', segs=12)

    b.finish('PpeLockerCabinet', col, parent=root)

    # 4. Left & Right Recessed Double-Sided Louvered Doors (swung open at -115 / +115 deg)
    for label, sx, open_deg in (('Left', -1.0, -115.0), ('Right', 1.0, 115.0)):
        hinge = (sx * 0.655, -0.310, 1.08)
        dpivot = make_empty(f'Ppe{label}DoorPivot', hinge, col, root)
        db = CleanHardSurfaceBuilder(mats)
        door_cx = sx * 0.325
        db.box((door_cx, -0.310, 1.08), (0.62, 0.014, 1.88), 'teal_cabinet', bevel=0.003)
        db.box((sx * 0.625, -0.310, 1.08), (0.06, 0.032, 1.92), 'teal_cabinet', bevel=0.005)
        db.box((sx * 0.030, -0.310, 1.08), (0.06, 0.032, 1.92), 'teal_cabinet', bevel=0.005)
        db.box((door_cx, -0.310, 2.01), (0.64, 0.032, 0.06), 'teal_cabinet', bevel=0.005)
        db.box((door_cx, -0.310, 0.15), (0.64, 0.032, 0.06), 'teal_cabinet', bevel=0.005)

        for hz in (0.34, 1.08, 1.82):
            db.cyl((sx * 0.655, -0.316, hz), 0.010, 0.010, 0.065, 'stainless', segs=12)

        for lz in (1.68, 1.725, 1.77, 1.815, 1.86, 1.905, 0.24, 0.285, 0.33, 0.375, 0.42, 0.465):
            db.box((door_cx, -0.310, lz), (0.36, 0.022, 0.018), 'slate_skid', bevel=0.002)

        hx = sx * 0.075
        db.handle_u((hx, -0.324, 1.08), 0.14, 0.036, radius=0.0065, mat_key='stainless', axis='z', face_normal=(0, -1, 0))
        if label == 'Right':
            db.box((hx, -0.290, 1.08), (0.032, 0.020, 0.068), 'stainless', bevel=0.003)
        db.finish(f'Ppe{label}DoorMesh', col, parent=dpivot, origin=hinge, parent_is_at_origin=True)
        dpivot.rotation_euler = (0.0, 0.0, math.radians(open_deg))

    # 5. Dynamic Group 1: PpeLockerSuit (Dense Smooth Lofted Coat, Seamless Sleeves, Proud Trim & Domed Hood)
    sb = CleanHardSurfaceBuilder(mats)
    cx_s, cy_s = -0.30, -0.05

    # Visible bent stainless hanger hook looping over closet rail (Z = 1.50) + concealed internal yoke
    sb.tube([
        (cx_s, cy_s, 1.445),
        (cx_s, cy_s, 1.498),
        (cx_s, cy_s - 0.014, 1.520),
        (cx_s, cy_s - 0.025, 1.502),
        (cx_s, cy_s - 0.016, 1.483),
    ], 0.006, 'stainless', segs=12)
    sb.tube([
        (cx_s - 0.155, cy_s, 1.345),
        (cx_s - 0.075, cy_s, 1.385),
        (cx_s,         cy_s, 1.410),
        (cx_s + 0.075, cy_s, 1.385),
        (cx_s + 0.155, cy_s, 1.345),
    ], 0.007, 'grey_trim', segs=10)

    # Dense 14-station smooth contoured coat torso (zero Subsurf needed -> zero trim clipping!)
    torso_stations = [
        (0.720, 0.198, 0.104, 0.010, 0.0052),   # Lower hem flare
        (0.770, 0.195, 0.102, 0.010, 0.0046),
        (0.840, 0.190, 0.100, 0.011, 0.0040),
        (0.920, 0.186, 0.098, 0.012, 0.0034),   # Waist taper
        (1.000, 0.188, 0.100, 0.013, 0.0030),
        (1.080, 0.195, 0.105, 0.015, 0.0026),
        (1.160, 0.205, 0.110, 0.017, 0.0022),   # Chest fullness
        (1.235, 0.212, 0.110, 0.016, 0.0018),   # Upper chest
        (1.295, 0.210, 0.106, 0.014, 0.0014),   # Shoulder base
        (1.340, 0.194, 0.096, 0.010, 0.0010),   # Shoulder slope
        (1.375, 0.165, 0.088, 0.007, 0.0006),
        (1.405, 0.128, 0.082, 0.005, 0.0),
        (1.425, 0.098, 0.078, 0.003, 0.0),
        (1.438, 0.086, 0.075, 0.002, 0.0),      # Collar base
    ]
    torso_rings = [_ellipse_ring(cx_s, cy_s, z, rx, ry, segs=36, front_extra=fe, fold_amp=fa, fold_freq=6.0) for z, rx, ry, fe, fa in torso_stations]
    sb.loft_rings(torso_rings, 'khaki_nomex', cap_start=True, cap_end=True)

    # Stand-up contoured collar + conformal elliptical olive collar trim + recessed hollow neck lining
    collar_rings = [
        _ellipse_ring(cx_s, cy_s, 1.432, 0.088, 0.077, segs=32),
        _ellipse_ring(cx_s, cy_s, 1.456, 0.091, 0.080, segs=32),
        _ellipse_ring(cx_s, cy_s, 1.478, 0.094, 0.083, segs=32),
        _ellipse_ring(cx_s, cy_s, 1.490, 0.095, 0.084, segs=32),
    ]
    sb.loft_rings(collar_rings, 'khaki_nomex', cap_start=False, cap_end=False)
    # Conformal rolled collar lip & recessed hollow neck interior
    sb.loft_rings([
        _ellipse_ring(cx_s, cy_s, 1.488, 0.095, 0.084, segs=32),
        _ellipse_ring(cx_s, cy_s, 1.495, 0.092, 0.081, segs=32),
        _ellipse_ring(cx_s, cy_s, 1.494, 0.082, 0.071, segs=32),
        _ellipse_ring(cx_s, cy_s, 1.460, 0.078, 0.067, segs=32),
    ], ['olive_trim', 'olive_trim', 'dark_fascia'], cap_start=False, cap_end=True)

    # Contoured Front Storm-Flap Placket curving cleanly proud of the chest/waist front curve!
    placket_front, placket_back = [], []
    for pz in (0.74, 0.84, 0.94, 1.04, 1.14, 1.24, 1.33, 1.41):
        _, ry, fe, _ = _interp_torso_params(pz, torso_stations)
        yf = cy_s - (ry + fe) - 0.005
        # Small quad cross-section around front placket
        placket_front.append([
            (cx_s - 0.025, yf + 0.008, pz),
            (cx_s + 0.025, yf + 0.008, pz),
            (cx_s + 0.024, yf - 0.004, pz),
            (cx_s - 0.024, yf - 0.004, pz),
        ])
    sb.loft_rings(placket_front, 'khaki_nomex', cap_start=True, cap_end=True)

    for sz in (0.80, 0.96, 1.13, 1.29, 1.39):
        _, ry, fe, _ = _interp_torso_params(sz, torso_stations)
        yf = cy_s - (ry + fe) - 0.011
        sb.cyl((cx_s, yf, sz), 0.0055, 0.0055, 0.004, 'stainless', segs=12, axis='y')

    # Right-chest pocket & angled olive flap proud of front torso surface
    _, ry_pk, fe_pk, _ = _interp_torso_params(1.22, torso_stations)
    pk_y = cy_s - (ry_pk + fe_pk) * 0.90 - 0.004
    sb.box((cx_s + 0.105, pk_y, 1.225), (0.072, 0.016, 0.090), 'khaki_nomex', bevel=0.004, rot_euler=(0, 0, 0.24))
    sb.box((cx_s + 0.105, pk_y - 0.002, 1.268), (0.076, 0.018, 0.024), 'olive_trim', bevel=0.003, rot_euler=(0, 0, 0.24))

    # Zero-clip 3-part Torso Reflective Bands (flush beveled collars directly matching interpolated coat profile!)
    for bz in (1.025, 1.125, 0.765):
        rx_b, ry_b, fe_b, fa_b = _interp_torso_params(bz, torso_stations)
        rx_b += 0.0035
        ry_b += 0.0035
        band_rings = [
            _ellipse_ring(cx_s, cy_s, bz - 0.021, rx_b - 0.003, ry_b - 0.003, segs=36, front_extra=fe_b, fold_amp=fa_b, fold_freq=6.0),
            _ellipse_ring(cx_s, cy_s, bz - 0.019, rx_b,         ry_b,         segs=36, front_extra=fe_b, fold_amp=fa_b, fold_freq=6.0),
            _ellipse_ring(cx_s, cy_s, bz + 0.019, rx_b,         ry_b,         segs=36, front_extra=fe_b, fold_amp=fa_b, fold_freq=6.0),
            _ellipse_ring(cx_s, cy_s, bz + 0.021, rx_b - 0.003, ry_b - 0.003, segs=36, front_extra=fe_b, fold_amp=fa_b, fold_freq=6.0),
        ]
        sb.loft_rings(band_rings, 'yellow', cap_start=False, cap_end=False)
        silv_rings = [
            _ellipse_ring(cx_s, cy_s, bz - 0.008, rx_b + 0.001, ry_b + 0.001, segs=36, front_extra=fe_b, fold_amp=fa_b, fold_freq=6.0),
            _ellipse_ring(cx_s, cy_s, bz - 0.006, rx_b + 0.003, ry_b + 0.003, segs=36, front_extra=fe_b, fold_amp=fa_b, fold_freq=6.0),
            _ellipse_ring(cx_s, cy_s, bz + 0.006, rx_b + 0.003, ry_b + 0.003, segs=36, front_extra=fe_b, fold_amp=fa_b, fold_freq=6.0),
            _ellipse_ring(cx_s, cy_s, bz + 0.008, rx_b + 0.001, ry_b + 0.001, segs=36, front_extra=fe_b, fold_amp=fa_b, fold_freq=6.0),
        ]
        sb.loft_rings(silv_rings, 'stainless', cap_start=False, cap_end=False)

    # Seamless Tailored Sleeves (smooth curved deltoid arc -> elbow bend -> cuff + attached inner cuff!)
    for sgn in (-1.0, 1.0):
        # (dx_from_cx, dy_from_cy, z, rx, ry)
        sleeve_stations = [
            (0.130,  0.000, 1.355, 0.056, 0.072),   # Tucked inside upper shoulder slope
            (0.172, -0.001, 1.330, 0.061, 0.070),
            (0.206, -0.003, 1.292, 0.063, 0.068),   # Smooth deltoid curve
            (0.228, -0.005, 1.245, 0.062, 0.066),
            (0.238, -0.007, 1.192, 0.061, 0.063),   # Upper bicep
            (0.248, -0.012, 1.115, 0.059, 0.060),
            (0.256, -0.018, 1.015, 0.057, 0.058),   # Elbow
            (0.262, -0.022, 0.915, 0.055, 0.056),   # Forearm
            (0.265, -0.024, 0.818, 0.054, 0.055),   # Cuff rim
        ]
        sl_rings = [
            _ellipse_ring(cx_s + sgn * dx, cy_s + dy, z, rx, ry, segs=22)
            for dx, dy, z, rx, ry in sleeve_stations
        ]
        sb.loft_rings(sl_rings, 'khaki_nomex', cap_start=True, cap_end=True)

        # Dual Sleeve Cuff Reflective Stripes flush on forearm surface (zero clipping!)
        for bz in (0.892, 0.842):
            bx_s = cx_s + sgn * (0.262 + (0.915 - bz) * 0.030)
            by_s = cy_s - 0.022 - (0.915 - bz) * 0.020
            sr = 0.0585
            sb.loft_rings([
                _ellipse_ring(bx_s, by_s, bz - 0.014, sr - 0.003, sr - 0.003, segs=22),
                _ellipse_ring(bx_s, by_s, bz - 0.012, sr,         sr,         segs=22),
                _ellipse_ring(bx_s, by_s, bz + 0.012, sr,         sr,         segs=22),
                _ellipse_ring(bx_s, by_s, bz + 0.014, sr - 0.003, sr - 0.003, segs=22),
            ], 'yellow', cap_start=False, cap_end=False)
            sb.loft_rings([
                _ellipse_ring(bx_s, by_s, bz - 0.005, sr + 0.001, sr + 0.001, segs=22),
                _ellipse_ring(bx_s, by_s, bz + 0.005, sr + 0.001, sr + 0.001, segs=22),
            ], 'stainless', cap_start=False, cap_end=False)

        # Attached Dark Olive Rib-Knit Inner Cuff protruding straight out of Z=0.818 sleeve mouth (zero gap!)
        cuff_x, cuff_y = cx_s + sgn * 0.265, cy_s - 0.024
        sb.loft_rings([
            _ellipse_ring(cuff_x, cuff_y, 0.822, 0.047, 0.047, segs=20),
            _ellipse_ring(cuff_x, cuff_y, 0.804, 0.045, 0.045, segs=20),
            _ellipse_ring(cuff_x, cuff_y, 0.788, 0.042, 0.042, segs=20),
        ], 'olive_trim', cap_start=False, cap_end=True)

    # Sculpted Domed 40 cal/cm² Arc-Flash Helmet Hood on upper-left shelf (Z = 1.595 .. 1.950)
    hood_stations = [
        (1.596, 0.168, 0.160, 0.0045),  # Flared shoulder bib
        (1.622, 0.146, 0.144, 0.0035),
        (1.658, 0.128, 0.132, 0.0020),  # Neck tuck
        (1.702, 0.132, 0.138, 0.0),
        (1.745, 0.136, 0.143, 0.0),     # Visor lower
        (1.790, 0.137, 0.145, 0.0),     # Mid face
        (1.835, 0.136, 0.144, 0.0),     # Brow
        (1.872, 0.128, 0.136, 0.0),
        (1.902, 0.112, 0.120, 0.0),     # Hard-hat crown taper
        (1.926, 0.086, 0.092, 0.0),
        (1.942, 0.052, 0.056, 0.0),
        (1.950, 0.020, 0.022, 0.0),     # Dome crest
    ]
    hood_rings = [_ellipse_ring(-0.30, -0.035, z, rx, ry, segs=36, fold_amp=fa, fold_freq=5.0) for z, rx, ry, fa in hood_stations]
    sb.loft_rings(hood_rings, 'khaki_nomex', cap_start=True, cap_end=True)

    # Curved Wraparound Olive Visor Gasket Bezel + Curved Emerald Visor (crisp & flush!)
    sb.curved_shell_arc((-0.30, -0.035), 0.150, 0.157, 1.696, 1.858, -46.0, 46.0, 0.020, 'olive_trim', segs=22, v_segs=4)
    sb.curved_shell_arc((-0.30, -0.035), 0.154, 0.161, 1.712, 1.842, -41.0, 41.0, 0.010, 'emerald_visor', segs=22, v_segs=4)

    sb.finish('PpeLockerSuit', col, parent=root, subsurf_levels=0)

    # 6. Dynamic Group 2: PpeLockerGloves (Sculpted 5-Finger Class 2 Dielectric Gauntlets)
    gb = CleanHardSurfaceBuilder(mats)
    _build_glove_mesh(gb, 0.23, is_right=False, mats_mode='rubber_orange')
    _build_glove_mesh(gb, 0.47, is_right=True, mats_mode='leather_protector')
    gb.finish('PpeLockerGloves', col, parent=root, subsurf_levels=0)

    # 7. Dynamic Group 3: PpeLockerBoots (Sculpted 20 kV Overboots + Multi-Layer Spiral 15 kV Mats)
    bt = CleanHardSurfaceBuilder(mats)
    # Natural slight toe-out stance (-6.0° left foot, +6.0° right foot around Z!)
    for bx, b_yaw in ((-0.41, -6.0), (-0.19, 6.0)):
        # Sleek contoured foot-shaped black outsole without clunky overhanging ledge (Z = 0.163 .. 0.196)
        sole_rings = [
            _boot_footprint_ring(bx, -0.02, 0.163, 1.01, 1.01, segs=30, toe_z_lift=0.004, yaw_deg=b_yaw),
            _boot_footprint_ring(bx, -0.02, 0.178, 1.01, 1.01, segs=30, toe_z_lift=0.005, yaw_deg=b_yaw),
            _boot_footprint_ring(bx, -0.02, 0.194, 0.99, 0.99, segs=30, toe_z_lift=0.006, yaw_deg=b_yaw),
        ]
        bt.loft_rings(sole_rings, 'rubber', cap_start=True, cap_end=True)

        # Molded Yellow Overboot with CONVEX outward heel counter curve -> smooth tapered shaft (zero heel cave-in!)
        boot_rings = [
            _boot_footprint_ring(bx, -0.02, 0.193, 0.985, 0.985, segs=30, toe_z_lift=0.006, yaw_deg=b_yaw),
            _boot_footprint_ring(bx, -0.016, 0.214, 0.965, 0.965, segs=30, toe_z_lift=0.007, yaw_deg=b_yaw),
            _boot_footprint_ring(bx, -0.005, 0.238, 0.935, 0.890, segs=30, toe_z_lift=0.004, yaw_deg=b_yaw),
            _boot_footprint_ring(bx, 0.008,  0.264, 0.900, 0.770, segs=30, yaw_deg=b_yaw),
            _ellipse_ring(bx, 0.020, 0.292, 0.053, 0.068, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),   # Full convex heel & ankle
            _ellipse_ring(bx, 0.022, 0.328, 0.055, 0.067, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),   # Lower calf
            _ellipse_ring(bx, 0.022, 0.368, 0.057, 0.069, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),
            _ellipse_ring(bx, 0.022, 0.410, 0.060, 0.071, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),   # Mid calf
            _ellipse_ring(bx, 0.022, 0.446, 0.062, 0.073, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),   # Top collar
        ]
        bt.loft_rings(boot_rings, 'yellow', cap_start=True, cap_end=False)

        # Top conformal elliptical rolled black cuff rim + recessed dark interior bore (flush 360 deg!)
        bt.loft_rings([
            _ellipse_ring(bx, 0.022, 0.443, 0.062, 0.073, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),
            _ellipse_ring(bx, 0.022, 0.448, 0.066, 0.077, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),
            _ellipse_ring(bx, 0.022, 0.453, 0.064, 0.075, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),
            _ellipse_ring(bx, 0.022, 0.452, 0.055, 0.066, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),
            _ellipse_ring(bx, 0.022, 0.422, 0.049, 0.060, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),
        ], ['rubber', 'rubber', 'rubber', 'dark_fascia'], cap_start=False, cap_end=True)

        # Conformal black ankle strap collar & low-profile outer metallic buckle clasp
        bt.loft_rings([
            _ellipse_ring(bx, 0.020, 0.292, 0.0545, 0.0695, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),
            _ellipse_ring(bx, 0.020, 0.294, 0.0565, 0.0715, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),
            _ellipse_ring(bx, 0.020, 0.308, 0.0565, 0.0715, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),
            _ellipse_ring(bx, 0.020, 0.310, 0.0545, 0.0695, segs=30, yaw_deg=b_yaw, pivot_y=-0.02),
        ], 'rubber', cap_start=False, cap_end=False)
        side_sgn = -1.0 if bx < -0.30 else 1.0
        bx_cl, by_cl = _rot_xy(bx + side_sgn * 0.057, 0.020, bx, -0.02, b_yaw)
        bt.box((bx_cl, by_cl, 0.301), (0.006, 0.018, 0.018), 'stainless', bevel=0.002, rot_euler=(0, 0, math.radians(b_yaw)))

    # Real spiral-layered rolled 15 kV dielectric mats sitting flush on floor & shelf (zero strap penetration!)
    _spiral_mat_ribbon(bt, 0.36, 0.261, -0.02, width_x=0.45, r_inner=0.024, r_outer=0.088, turns=3.72, thick=0.0065)
    _spiral_mat_ribbon(bt, 0.36, 0.753, -0.02, width_x=0.45, r_inner=0.024, r_outer=0.088, turns=3.72, thick=0.0065)

    bt.finish('PpeLockerBoots', col, parent=root, subsurf_levels=0)

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
