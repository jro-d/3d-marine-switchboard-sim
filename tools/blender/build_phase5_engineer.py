"""
Phase 5 Builder: High-Detail Marine ETO Engineer, Swappable PPE & Looping Animations
(Blender 5.3+ -> Godot 4.7 uncompressed rigged GLB).

Matches reference sheets:
  - assets-src/references/ref-09-engineer-base.jpg
  - assets-src/references/ref-10-engineer-ppe-kit.jpg

Preserves the 19-bone humanoid skeleton (`Hips`, `Spine`, `Chest`, `Neck`, `Head`,
`Left/Right UpperArm/ForeArm/Hand`, `Left/Right Thigh/Shin/Foot`,
`RightHandIKTarget`, `LeftHandIKTarget`) and exports clean looping NLA clips
(`Idle`, `Walk`, `Sprint`, `Interact`, `PushTrolley`).

Zero 128x128 grainy noise normal maps; all paint, FR fabric, rubber, leather,
and skin materials come from `common_clean_pbr.build_clean_material_library()`.
"""

import math
import os
import sys
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(THIS_DIR, '..', '..'))
if THIS_DIR not in sys.path:
    sys.path.insert(0, THIS_DIR)

from common_clean_pbr import (
    build_clean_material_library,
    ensure_collection,
    export_rigged_collection_uncompressed_glb,
    reset_clean_scene,
)

# ---------------------------------------------------------------------------
# Skeleton Specification (glTF Y-up, +Z forward -> natural ~14 deg A-pose)
# ---------------------------------------------------------------------------
BONE_SPECS_GLTF = [
    ('Hips', None, (0.0, 0.90, 0.0)),
    ('Spine', 'Hips', (0.0, 0.10, 0.0)),
    ('Chest', 'Spine', (0.0, 0.18, 0.0)),
    ('Neck', 'Chest', (0.0, 0.24, 0.0)),
    ('Head', 'Neck', (0.0, 0.07, 0.0)),
    # Natural relaxed A-pose arms (clears parka torso & hip pockets cleanly)
    ('LeftUpperArm', 'Chest', (0.205, 0.18, 0.0)),
    ('LeftForeArm', 'LeftUpperArm', (0.055, -0.285, 0.0)),
    ('LeftHand', 'LeftForeArm', (0.050, -0.265, 0.015)),
    ('RightUpperArm', 'Chest', (-0.205, 0.18, 0.0)),
    ('RightForeArm', 'RightUpperArm', (-0.055, -0.285, 0.0)),
    ('RightHand', 'RightForeArm', (-0.050, -0.265, 0.015)),
    # Athletic hip/leg alignment
    ('LeftThigh', 'Hips', (0.105, -0.04, 0.0)),
    ('LeftShin', 'LeftThigh', (0.008, -0.40, 0.0)),
    ('LeftFoot', 'LeftShin', (0.004, -0.37, 0.02)),
    ('RightThigh', 'Hips', (-0.105, -0.04, 0.0)),
    ('RightShin', 'RightThigh', (-0.008, -0.40, 0.0)),
    ('RightFoot', 'RightShin', (-0.004, -0.37, 0.02)),
    # IK effector targets
    ('RightHandIKTarget', None, (-0.310, 1.02, 0.36)),
    ('LeftHandIKTarget', None, (0.310, 1.02, 0.36)),
]

REG_TORSO = 1
REG_HEAD = 2
REG_LEFT_ARM = 3
REG_RIGHT_ARM = 4
REG_LEFT_LEG = 5
REG_RIGHT_LEG = 6
REG_LEFT_HAND = 7
REG_RIGHT_HAND = 8
REG_LEFT_FOOT = 9
REG_RIGHT_FOOT = 10
REG_ARC_HOOD = 11


def gltf_to_blender(x, y, z):
    """Convert glTF (+X left, +Y up, +Z forward) to Blender (+X left, -Y forward, +Z up)."""
    return Vector((x, -z, y))


def compute_bone_world_positions_blender():
    world_gltf = {}
    for name, parent, offset in BONE_SPECS_GLTF:
        if parent is None:
            world_gltf[name] = Vector(offset)
        else:
            world_gltf[name] = world_gltf[parent] + Vector(offset)
    return {name: gltf_to_blender(v.x, v.y, v.z) for name, v in world_gltf.items()}


def _arm_center(sx, z):
    """Exact A-pose arm centerline `(x, y, z)` in Blender space along UpperArm -> ForeArm -> Hand."""
    if z >= 1.075:
        t = max(0.0, min(1.0, (1.360 - z) / (1.360 - 1.075)))
        return Vector((sx * (0.205 + 0.055 * t), 0.0, z))
    t = max(0.0, min(1.0, (1.075 - z) / (1.075 - 0.810)))
    return Vector((sx * (0.260 + 0.050 * t), -0.015 * t, z))


def _leg_center(sx, z):
    """Exact leg centerline `(x, y, z)` in Blender space along Thigh -> Shin -> Foot."""
    if z >= 0.460:
        t = max(0.0, min(1.0, (0.860 - z) / (0.860 - 0.460)))
        return Vector((sx * (0.105 + 0.008 * t), 0.0, z))
    t = max(0.0, min(1.0, (0.460 - z) / (0.460 - 0.090)))
    return Vector((sx * (0.113 + 0.004 * t), -0.020 * t, z))


def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / max(1e-6, edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


# ---------------------------------------------------------------------------
# Clean Multi-Material BMesh Skinned Builder (Zero Grainy Noise Maps)
# ---------------------------------------------------------------------------
class SkinnedCharBuilder:
    """BMesh builder preserving skin_region integer attribute per vertex and clean box/loft UVs."""

    def __init__(self, mats):
        self.mats = mats
        self.bm = bmesh.new()
        self.uv_layer = self.bm.loops.layers.uv.new('UVMap')
        self.region_layer = self.bm.verts.layers.int.new('skin_region')
        self.mat_keys = []
        self.mat_idx = {}

    def _slot(self, mat_key):
        if mat_key not in self.mat_idx:
            self.mat_idx[mat_key] = len(self.mat_keys)
            self.mat_keys.append(mat_key)
        return self.mat_idx[mat_key]

    def _assign_uv_box(self, faces, scale=2.2):
        for f in faces:
            n = f.normal
            ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
            for loop in f.loops:
                co = loop.vert.co
                if az >= ax and az >= ay:
                    u, v = co.x * scale, co.y * scale
                elif ax >= ay:
                    u, v = co.y * scale, co.z * scale
                else:
                    u, v = co.x * scale, co.z * scale
                loop[self.uv_layer].uv = (u, v)

    def add_loft(self, rings, mat_per_band, region_id, cap_start=True, cap_end=True, face_mat_fn=None):
        """
        Stitch equal-length Vector rings. Optional `face_mat_fn(ring_idx, seg_idx, v0_pos)`
        allows crisp per-quad patterning (e.g. coverall back stripes vs front).
        """
        n_rings = len(rings)
        segs = len(rings[0])
        bm_rings = []
        for ring in rings:
            vr = []
            for p in ring:
                v = self.bm.verts.new(p)
                v[self.region_layer] = region_id
                vr.append(v)
            bm_rings.append(vr)

        created = []
        for ri in range(n_rings - 1):
            base_mk = mat_per_band if isinstance(mat_per_band, str) else mat_per_band[ri]
            v0 = ri / max(1, n_rings - 1) * 2.4
            v1 = (ri + 1) / max(1, n_rings - 1) * 2.4
            for si in range(segs):
                sn = (si + 1) % segs
                u0 = si / segs * 2.0
                u1 = (si + 1) / segs * 2.0
                mk = face_mat_fn(ri, si, segs, base_mk) if face_mat_fn else base_mk
                slot = self._slot(mk)
                try:
                    f = self.bm.faces.new((
                        bm_rings[ri][si],
                        bm_rings[ri][sn],
                        bm_rings[ri + 1][sn],
                        bm_rings[ri + 1][si],
                    ))
                    f.smooth = True
                    f.material_index = slot
                    for loop, uv in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
                        loop[self.uv_layer].uv = uv
                    created.append(f)
                except ValueError:
                    pass

        if cap_start:
            mk = mat_per_band if isinstance(mat_per_band, str) else mat_per_band[0]
            slot = self._slot(mk)
            center = sum(rings[0], Vector()) / segs
            vc = self.bm.verts.new(center)
            vc[self.region_layer] = region_id
            for si in range(segs):
                sn = (si + 1) % segs
                try:
                    f = self.bm.faces.new((bm_rings[0][sn], bm_rings[0][si], vc))
                    f.smooth = True
                    f.material_index = slot
                    created.append(f)
                except ValueError:
                    pass

        if cap_end:
            mk = mat_per_band if isinstance(mat_per_band, str) else mat_per_band[-1]
            slot = self._slot(mk)
            center = sum(rings[-1], Vector()) / segs
            vc = self.bm.verts.new(center)
            vc[self.region_layer] = region_id
            for si in range(segs):
                sn = (si + 1) % segs
                try:
                    f = self.bm.faces.new((bm_rings[-1][si], bm_rings[-1][sn], vc))
                    f.smooth = True
                    f.material_index = slot
                    created.append(f)
                except ValueError:
                    pass

        return created

    def add_tube(self, path_pts, radii, mat_key, region_id, segs=12, cap_start=True, cap_end=True, oval_ratio=1.0):
        n = len(path_pts)
        tangents = []
        for i in range(n):
            if i == 0:
                t = (path_pts[1] - path_pts[0]).normalized()
            elif i == n - 1:
                t = (path_pts[-1] - path_pts[-2]).normalized()
            else:
                t = (path_pts[i + 1] - path_pts[i - 1]).normalized()
            tangents.append(t)

        ref = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
        binorm = tangents[0].cross(ref).normalized()
        norm = binorm.cross(tangents[0]).normalized()

        rings = []
        for i, (pt, rad) in enumerate(zip(path_pts, radii)):
            if i > 0:
                rot = tangents[i - 1].rotation_difference(tangents[i])
                norm = (rot @ norm).normalized()
                binorm = tangents[i].cross(norm).normalized()
            rx = rad[0] if isinstance(rad, (tuple, list)) else rad
            ry = rad[1] if isinstance(rad, (tuple, list)) else rad * oval_ratio
            ring = []
            for s in range(segs):
                ang = (2.0 * math.pi * s) / segs
                ring.append(pt + norm * (math.cos(ang) * rx) + binorm * (math.sin(ang) * ry))
            rings.append(ring)

        return self.add_loft(rings, mat_key, region_id, cap_start=cap_start, cap_end=cap_end)

    def add_beveled_box(self, center, size, mat_key, region_id, rot_euler=(0, 0, 0), bevel_width=0.004, bevel_segs=2):
        ret = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = ret['verts']
        m_scale = Matrix.Diagonal((size[0], size[1], size[2], 1.0))
        m_rot = Euler(rot_euler, 'XYZ').to_matrix().to_4x4()
        m_loc = Matrix.Translation(center)
        bmesh.ops.transform(self.bm, matrix=m_loc @ m_rot @ m_scale, verts=verts)

        edges = list({e for v in verts for e in v.link_edges})
        if bevel_width > 0:
            bev = bmesh.ops.bevel(
                self.bm,
                geom=edges,
                offset=min(bevel_width, min(size) * 0.42),
                offset_type='OFFSET',
                segments=bevel_segs,
                profile=0.5,
                affect='EDGES',
                clamp_overlap=True,
            )
            all_verts = [v for v in (set(verts) | set(bev.get('verts', []))) if v.is_valid]
            faces = list({f for v in all_verts for f in v.link_faces if f.is_valid} | {f for f in bev.get('faces', []) if f.is_valid})
        else:
            all_verts = [v for v in verts if v.is_valid]
            faces = list({f for v in all_verts for f in v.link_faces if f.is_valid})

        slot = self._slot(mat_key)
        for v in all_verts:
            v[self.region_layer] = region_id
        for f in faces:
            f.smooth = True
            f.material_index = slot
        self._assign_uv_box(faces, scale=2.5)
        return faces

    def add_ellipsoid(self, center, radii, mat_key, region_id, u_segs=18, v_rings=12, rot_euler=(0, 0, 0)):
        ret = bmesh.ops.create_uvsphere(self.bm, u_segments=u_segs, v_segments=v_rings, radius=1.0)
        verts = ret['verts']
        m_scale = Matrix.Diagonal((radii[0], radii[1], radii[2], 1.0))
        m_rot = Euler(rot_euler, 'XYZ').to_matrix().to_4x4()
        m_loc = Matrix.Translation(center)
        bmesh.ops.transform(self.bm, matrix=m_loc @ m_rot @ m_scale, verts=verts)

        faces = list({f for v in verts for f in v.link_faces})
        slot = self._slot(mat_key)
        for v in verts:
            v[self.region_layer] = region_id
        for f in faces:
            f.smooth = True
            f.material_index = slot
        self._assign_uv_box(faces, scale=3.0)
        return faces

    def finish(self, name, col):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        mesh = bpy.data.meshes.new(name + '_Mesh')
        self.bm.to_mesh(mesh)
        region_ids = [v[self.region_layer] for v in self.bm.verts]
        self.bm.free()

        for mk in self.mat_keys:
            mesh.materials.append(self.mats[mk])
        if len(mesh.polygons) > 0:
            mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
        mesh.update()

        obj = bpy.data.objects.new(name, mesh)
        col.objects.link(obj)
        wn = obj.modifiers.new(name='WeightedNormal', type='WEIGHTED_NORMAL')
        wn.keep_sharp = True
        return obj, region_ids


# ---------------------------------------------------------------------------
# Smooth Linear-Blend Skinning
# ---------------------------------------------------------------------------
def compute_smooth_skin_weights(co, region_id):
    x, y, z = co.x, co.y, co.z
    w = {}

    if region_id == REG_HEAD:
        if z < 1.435:
            t = smoothstep(1.375, 1.435, z)
            w['Chest'] = 1.0 - t
            w['Neck'] = t
        elif z < 1.500:
            t = smoothstep(1.435, 1.500, z)
            w['Neck'] = 1.0 - t
            w['Head'] = t
        else:
            w['Head'] = 1.0

    elif region_id == REG_ARC_HOOD:
        if z < 1.385:
            w['Chest'] = 1.0
        elif z < 1.455:
            t = smoothstep(1.385, 1.455, z)
            w['Chest'] = 1.0 - t
            w['Neck'] = t
        elif z < 1.520:
            t = smoothstep(1.455, 1.520, z)
            w['Neck'] = 1.0 - t
            w['Head'] = t
        else:
            w['Head'] = 1.0

    elif region_id == REG_TORSO:
        if z <= 0.90:
            w['Hips'] = 1.0
        elif z < 1.01:
            t = smoothstep(0.90, 1.01, z)
            w['Hips'] = 1.0 - t
            w['Spine'] = t
        elif z < 1.18:
            t = smoothstep(1.01, 1.18, z)
            w['Spine'] = 1.0 - t
            w['Chest'] = t
        elif z < 1.41:
            w['Chest'] = 1.0
        else:
            t = smoothstep(1.41, 1.45, z)
            w['Chest'] = 1.0 - t
            w['Neck'] = t

    elif region_id in (REG_LEFT_ARM, REG_RIGHT_ARM):
        side = 'Left' if region_id == REG_LEFT_ARM else 'Right'
        # Smooth shoulder deformation blended into Chest near torso seam
        if z > 1.295:
            t_sh = smoothstep(1.295, 1.395, z) * (1.0 - smoothstep(0.16, 0.23, abs(x))) * 0.45
            w['Chest'] = t_sh
            w[f'{side}UpperArm'] = 1.0 - t_sh
        elif z > 1.115:
            w[f'{side}UpperArm'] = 1.0
        elif z > 1.025:
            t_el = smoothstep(1.115, 1.025, z)
            w[f'{side}UpperArm'] = 1.0 - t_el
            w[f'{side}ForeArm'] = t_el
        elif z > 0.835:
            w[f'{side}ForeArm'] = 1.0
        else:
            t_wr = smoothstep(0.835, 0.785, z)
            w[f'{side}ForeArm'] = 1.0 - t_wr
            w[f'{side}Hand'] = t_wr

    elif region_id in (REG_LEFT_HAND, REG_RIGHT_HAND):
        side = 'Left' if region_id == REG_LEFT_HAND else 'Right'
        if z > 0.835:
            w[f'{side}ForeArm'] = 1.0
        elif z > 0.775:
            t = smoothstep(0.835, 0.775, z)
            w[f'{side}ForeArm'] = 1.0 - t
            w[f'{side}Hand'] = t
        else:
            w[f'{side}Hand'] = 1.0

    elif region_id in (REG_LEFT_LEG, REG_RIGHT_LEG):
        side = 'Left' if region_id == REG_LEFT_LEG else 'Right'
        if z > 0.84:
            t_hip = smoothstep(0.91, 0.83, z)
            w['Hips'] = 1.0 - t_hip
            w[f'{side}Thigh'] = t_hip
        elif z > 0.505:
            w[f'{side}Thigh'] = 1.0
        elif z > 0.415:
            t_kn = smoothstep(0.505, 0.415, z)
            w[f'{side}Thigh'] = 1.0 - t_kn
            w[f'{side}Shin'] = t_kn
        elif z > 0.140:
            w[f'{side}Shin'] = 1.0
        else:
            t_an = smoothstep(0.140, 0.085, z)
            w[f'{side}Shin'] = 1.0 - t_an
            w[f'{side}Foot'] = t_an

    elif region_id in (REG_LEFT_FOOT, REG_RIGHT_FOOT):
        side = 'Left' if region_id == REG_LEFT_FOOT else 'Right'
        # Synchronized EXACTLY with leg thresholds so tall yellow overboots deform identically to trouser hems during Walk/Sprint!
        if z > 0.140:
            w[f'{side}Shin'] = 1.0
        elif z > 0.085:
            t = smoothstep(0.140, 0.085, z)
            w[f'{side}Shin'] = 1.0 - t
            w[f'{side}Foot'] = t
        else:
            w[f'{side}Foot'] = 1.0

    else:
        w['Hips'] = 1.0

    items = sorted(((k, v) for k, v in w.items() if v > 1e-5), key=lambda kv: -kv[1])[:4]
    total = sum(v for _, v in items)
    if total <= 1e-6:
        return [('Hips', 1.0)]
    return [(k, v / total) for k, v in items]


def bind_object_to_armature(obj, arm_obj, region_ids, fixed_region_id=None):
    for name, _, _ in BONE_SPECS_GLTF:
        if name not in obj.vertex_groups:
            obj.vertex_groups.new(name=name)

    for idx, _ in enumerate(obj.data.vertices):
        reg = fixed_region_id if fixed_region_id is not None else region_ids[idx]
        for bone_name, weight in compute_smooth_skin_weights(obj.data.vertices[idx].co, reg):
            obj.vertex_groups[bone_name].add([idx], weight, 'REPLACE')

    obj.parent = arm_obj
    mod = obj.modifiers.new(name='Armature', type='ARMATURE')
    mod.object = arm_obj
    mod.use_vertex_groups = True


# ---------------------------------------------------------------------------
# Anatomical Rings & Smooth Boot Footprint Helpers
# ---------------------------------------------------------------------------
def _torso_ring(z, rx, ry_front, ry_back, segs=36, y_shift=0.0, fold_amp=0.002, fold_freq=5, chest_sculpt=0.0):
    pts = []
    for s in range(segs):
        ang = (2.0 * math.pi * s) / segs
        ca, sa = math.cos(ang), math.sin(ang)
        ry = ry_front if sa < 0 else ry_back
        sq = 1.0 + 0.055 * (ca * ca * sa * sa)
        pec = 0.0
        if chest_sculpt > 0.0 and sa < 0:
            pec = chest_sculpt * math.exp(-((abs(ca) - 0.44) / 0.30) ** 2) * (-sa)
        elif chest_sculpt > 0.0 and sa > 0:
            pec = -chest_sculpt * 0.40 * math.exp(-(ca / 0.16) ** 2) * sa
        fold = fold_amp * math.sin(ang * fold_freq + z * 16.0)
        pts.append(Vector(((rx * sq + fold) * ca, y_shift + (ry * sq + pec + fold) * sa, z)))
    return pts


def _boot_footprint_ring(cx, cy, z, scale_x=1.0, scale_y=1.0, segs=28, toe_z_lift=0.0):
    """Smooth C1-continuous convex boot footprint oriented toward -Y (toe) and +Y (heel)."""
    pts = []
    for i in range(segs):
        a = (2.0 * math.pi * i) / segs
        ca, sa = math.cos(a), math.sin(a)
        t_front = max(0.0, -sa)
        t_back = max(0.0, sa)
        rx = (0.052 + 0.005 * t_front - 0.009 * (t_front ** 2.4) - 0.005 * (t_back ** 2.0)) * scale_x
        ry = (0.164 if sa < 0.0 else 0.098) * scale_y
        z_off = toe_z_lift * (max(0.0, (t_front - 0.55) / 0.45) ** 1.4)
        pts.append(Vector((cx + rx * ca, cy + ry * sa, z + z_off)))
    return pts


def _ellipse_ring(cx, cy, z, rx, ry, segs=28, fold_amp=0.0, fold_freq=4.0):
    pts = []
    for s in range(segs):
        a = (2.0 * math.pi * s) / segs
        ca, sa = math.cos(a), math.sin(a)
        fold = fold_amp * math.sin(a * fold_freq + z * 18.0)
        pts.append(Vector((cx + (rx + fold) * ca, cy + (ry + fold) * sa, z)))
    return pts


# ---------------------------------------------------------------------------
# Base Marine ETO Engineer Mesh (`EngineerBody`) matching ref-09-engineer-base.jpg
# ---------------------------------------------------------------------------
def build_body_mesh(mats, col):
    mb = SkinnedCharBuilder(mats)

    # 1. Sculpted FR Navy Coveralls Torso & Pelvis (Z = 0.790 .. 1.445)
    # Matching ref-09: waist reflective belt around Z=1.05, upper-back shoulder blade stripe, open collar!
    torso_profile = [
        (0.772, 0.105, 0.072, 0.076,  0.002, 0.001, 0.000),  # Tapered pelvis tuck between thighs
        (0.805, 0.150, 0.092, 0.098,  0.003, 0.002, 0.000),
        (0.845, 0.172, 0.104, 0.114,  0.003, 0.003, 0.000),
        (0.900, 0.176, 0.108, 0.116,  0.002, 0.003, 0.000),  # Hips
        (0.955, 0.168, 0.104, 0.108,  0.001, 0.003, 0.000),  # Coverall elastic waist seam
        (1.015, 0.172, 0.108, 0.108,  0.000, 0.002, 0.002),
        (1.032, 0.174, 0.110, 0.110,  0.000, 0.001, 0.003),  # Waist hi-vis yellow lower
        (1.046, 0.176, 0.112, 0.111,  0.000, 0.001, 0.003),  # Waist hi-vis silver
        (1.062, 0.177, 0.113, 0.112,  0.000, 0.001, 0.003),  # Waist hi-vis yellow upper
        (1.082, 0.178, 0.114, 0.112,  0.000, 0.003, 0.004),  # Upper midriff
        (1.150, 0.190, 0.120, 0.116, -0.002, 0.003, 0.008),
        (1.225, 0.200, 0.124, 0.120, -0.003, 0.002, 0.010),  # Chest
        (1.242, 0.202, 0.125, 0.122, -0.003, 0.001, 0.010),  # Back-only shoulder-blade yellow stripe!
        (1.256, 0.203, 0.125, 0.122, -0.003, 0.001, 0.010),  # Back-only silver stripe
        (1.272, 0.202, 0.124, 0.121, -0.002, 0.001, 0.009),  # Back-only yellow stripe
        (1.335, 0.200, 0.115, 0.115,  0.000, 0.002, 0.005),  # Broad shoulders
        (1.375, 0.172, 0.096, 0.098,  0.002, 0.002, 0.002),  # Slope
        (1.408, 0.096, 0.080, 0.082,  0.002, 0.001, 0.000),  # Collar base
        (1.445, 0.074, 0.072, 0.074,  0.002, 0.001, 0.000),  # Collar rim
    ]
    torso_rings = [
        _torso_ring(z, rx, ryf, ryb, segs=36, y_shift=ys, fold_amp=fa, chest_sculpt=cs)
        for z, rx, ryf, ryb, ys, fa, cs in torso_profile
    ]
    torso_band_mats = [
        'navy_fr', 'navy_fr', 'navy_fr', 'navy_trim', 'navy_fr',
        'navy_fr',
        'hivis_yellow', 'hivis_silver', 'hivis_yellow',
        'navy_fr', 'navy_fr', 'navy_fr',
        'hivis_yellow', 'hivis_silver', 'hivis_yellow',
        'navy_fr', 'navy_fr', 'navy_fr',
    ]

    def _torso_mat_override(ri, si, segs, base_mk):
        # Upper chest bar (bands 12, 13, 14) applies ONLY on the BACK half (sa > 0.2 -> 0 < ang < pi)!
        if ri in (12, 13, 14):
            ang = (2.0 * math.pi * (si + 0.5)) / segs
            if math.sin(ang) < 0.25:
                return 'navy_fr'
        return base_mk

    mb.add_loft(torso_rings, torso_band_mats, REG_TORSO, cap_start=True, cap_end=True, face_mat_fn=_torso_mat_override)

    # Dark Crewneck Undershirt V-opening + Folded Shirt Collar Lapels (matching ref-09!)
    mb.add_beveled_box(Vector((0.0, -0.078, 1.402)), (0.068, 0.014, 0.056), 'navy_trim', REG_TORSO, rot_euler=(-0.38, 0, 0), bevel_width=0.003)
    for sx in (-1.0, 1.0):
        mb.add_beveled_box(
            Vector((sx * 0.056, -0.074, 1.412)), (0.044, 0.016, 0.072), 'navy_fr', REG_TORSO,
            rot_euler=(0.30, sx * 0.38, sx * -0.42), bevel_width=0.003
        )

    # Front zipper storm-flap placket + slant zippered breast pockets + metallic brass zipper tracks
    mb.add_beveled_box(Vector((0.0, -0.122, 1.14)), (0.032, 0.012, 0.48), 'navy_trim', REG_TORSO, bevel_width=0.003)
    for sx in (-1.0, 1.0):
        px = sx * 0.095
        mb.add_beveled_box(Vector((px, -0.122, 1.245)), (0.088, 0.018, 0.098), 'navy_trim', REG_TORSO,
                           rot_euler=(0.06, 0.0, sx * -0.16), bevel_width=0.004)
        # Diagonal brass pocket zipper
        mb.add_tube(
            [Vector((px - sx * 0.036, -0.132, 1.292)), Vector((px + sx * 0.036, -0.125, 1.278))],
            [0.0032, 0.0032], 'brass', REG_TORSO, segs=6
        )

    # Chief ETO Gold Epaulettes on Shoulders
    for sx in (-1.0, 1.0):
        mb.add_beveled_box(Vector((sx * 0.142, 0.0, 1.388)), (0.092, 0.044, 0.012), 'navy_trim', REG_TORSO,
                           rot_euler=(0.0, sx * 0.24, 0.0), bevel_width=0.003)
        for stripe_off in (-0.018, 0.0, 0.018):
            mb.add_beveled_box(
                Vector((sx * (0.142 + stripe_off * 0.8), 0.0, 1.394 - stripe_off * 0.18)),
                (0.008, 0.045, 0.005), 'gold_epaulette', REG_TORSO,
                rot_euler=(0.0, sx * 0.24, 0.0), bevel_width=0.001
            )

    # Vertical Over-the-Shoulder Hi-Vis Reflective Suspender Tapes (stopping cleanly above chest pockets front, joining back bar!)
    for sx in (-1.0, 1.0):
        strap_pts = [
            Vector((sx * 0.108, -0.118, 1.298)),
            Vector((sx * 0.110, -0.104, 1.345)),
            Vector((sx * 0.106, -0.056, 1.386)),
            Vector((sx * 0.106,  0.008, 1.395)),
            Vector((sx * 0.106,  0.074, 1.384)),
            Vector((sx * 0.110,  0.118, 1.330)),
            Vector((sx * 0.110,  0.123, 1.258)),
        ]
        mb.add_tube(strap_pts, [(0.014, 0.0038)] * len(strap_pts), 'hivis_yellow', REG_TORSO, segs=8)
        mb.add_tube(
            [p + Vector((0, -0.0018 if p.y < 0 else 0.0018, 0.0018)) for p in strap_pts],
            [(0.007, 0.0032)] * len(strap_pts), 'hivis_silver', REG_TORSO, segs=8
        )

    # Marine VHF Handheld Radio Clipped to Anatomical Left Chest Pocket (+X, matching ref-09!)
    mb.add_beveled_box(Vector((0.104, -0.142, 1.278)), (0.044, 0.026, 0.095), 'radio_body', REG_TORSO,
                       rot_euler=(0.08, 0.0, -0.12), bevel_width=0.004)
    mb.add_beveled_box(Vector((0.104, -0.155, 1.298)), (0.032, 0.004, 0.028), 'slate_skid', REG_TORSO,
                       rot_euler=(0.08, 0.0, -0.12), bevel_width=0.001)
    mb.add_tube(
        [Vector((0.114, -0.138, 1.324)), Vector((0.116, -0.132, 1.368)), Vector((0.118, -0.126, 1.412))],
        [0.0050, 0.0036, 0.0024], 'radio_body', REG_TORSO, segs=8
    )

    # 2. Anatomical Neck, Sculpted Male Head, Ears, Crew-Cut Hair & Clear Safety Glasses (Z = 1.40..1.705)
    neck_rings = [
        _torso_ring(z, rx, ry, ry, segs=24, y_shift=ys, fold_amp=0.0)
        for z, rx, ry, ys in (
            (1.400, 0.066, 0.064, 0.004),
            (1.432, 0.056, 0.056, 0.003),
            (1.462, 0.053, 0.055, 0.001),
            (1.494, 0.055, 0.058, 0.000),
        )
    ]
    mb.add_loft(neck_rings, 'skin', REG_HEAD, cap_start=True, cap_end=True)

    head_profile = [
        (1.478, 0.036, 0.056, 0.032, -0.018, 0.24, 0.000, 0.000),
        (1.496, 0.056, 0.078, 0.054, -0.014, 0.17, 0.000, 0.000),
        (1.520, 0.071, 0.088, 0.074, -0.008, 0.09, 0.000, 0.002),
        (1.545, 0.078, 0.092, 0.088, -0.004, 0.03, 0.000, 0.006),
        (1.568, 0.082, 0.094, 0.095,  0.000, 0.00, 0.000, 0.014),
        (1.592, 0.083, 0.090, 0.098,  0.002, 0.00, 0.002, 0.008),
        (1.615, 0.084, 0.095, 0.100,  0.002, 0.00, 0.006, 0.002),
        (1.644, 0.084, 0.094, 0.101,  0.003, 0.00, 0.000, 0.000),
        (1.672, 0.076, 0.085, 0.093,  0.004, 0.00, 0.000, 0.000),
        (1.692, 0.052, 0.060, 0.066,  0.004, 0.00, 0.000, 0.000),
        (1.702, 0.020, 0.024, 0.026,  0.004, 0.00, 0.000, 0.000),
    ]
    head_rings = []
    segs_h = 32
    for z, rx, ryf, ryb, ys, jt, bp, npj in head_profile:
        ring = []
        for s in range(segs_h):
            ang = (2.0 * math.pi * s) / segs_h
            ca, sa = math.cos(ang), math.sin(ang)
            ry = ryf if sa < 0 else ryb
            x_scale = rx * (1.0 - jt * max(0.0, -sa))
            y_extra = 0.0
            if sa < 0:
                y_extra -= npj * math.exp(-(ca / 0.17) ** 2) * (-sa)
                if 1.580 <= z <= 1.604:
                    y_extra += 0.0065 * math.exp(-((abs(ca) - 0.36) / 0.18) ** 2) * (-sa)
                if bp > 0:
                    y_extra -= bp * math.exp(-((abs(ca) - 0.30) / 0.35) ** 2) * (-sa)
            ring.append(Vector((x_scale * ca, ys + ry * sa + y_extra, z)))
        head_rings.append(ring)
    mb.add_loft(head_rings, 'skin', REG_HEAD, cap_start=True, cap_end=True)

    # Nose, Lips, Ears, Eyes, Eyebrows & Crew-cut Hair
    mb.add_ellipsoid(Vector((0.0, -0.098, 1.566)), (0.012, 0.015, 0.013), 'skin', REG_HEAD, u_segs=12, v_rings=8)
    mb.add_ellipsoid(Vector((0.0, -0.090, 1.531)), (0.023, 0.009, 0.007), 'skin_lips', REG_HEAD, u_segs=12, v_rings=8)
    for sx in (-1.0, 1.0):
        mb.add_ellipsoid(Vector((sx * 0.085, 0.008, 1.575)), (0.011, 0.017, 0.029), 'skin', REG_HEAD,
                         u_segs=12, v_rings=8, rot_euler=(0.0, 0.0, sx * -0.15))
        mb.add_ellipsoid(Vector((sx * 0.031, -0.082, 1.591)), (0.011, 0.010, 0.009), 'eye_white', REG_HEAD, u_segs=10, v_rings=8)
        mb.add_ellipsoid(Vector((sx * 0.031, -0.090, 1.591)), (0.0055, 0.004, 0.0055), 'eye_iris', REG_HEAD, u_segs=8, v_rings=6)
        mb.add_tube(
            [Vector((sx * 0.014, -0.090, 1.609)), Vector((sx * 0.033, -0.088, 1.612)), Vector((sx * 0.052, -0.079, 1.607))],
            [0.0038, 0.0044, 0.0030], 'hair', REG_HEAD, segs=6
        )

    hair_rings = []
    for z, rx, ryf, ryb, ys in (
        (1.528, 0.081, 0.012, 0.088, 0.018),
        (1.568, 0.085, 0.024, 0.100, 0.016),
        (1.612, 0.087, 0.052, 0.104, 0.012),
        (1.648, 0.088, 0.088, 0.105, 0.006),
        (1.678, 0.080, 0.086, 0.097, 0.005),
        (1.701, 0.046, 0.054, 0.058, 0.005),
    ):
        ring = []
        for s in range(28):
            ang = (2.0 * math.pi * s) / 28
            ca, sa = math.cos(ang), math.sin(ang)
            ry = ryf if sa < 0 else ryb
            ring.append(Vector((rx * ca, ys + ry * sa, z)))
        hair_rings.append(ring)
    mb.add_loft(hair_rings, 'hair', REG_HEAD, cap_start=False, cap_end=True)

    # Clear Polycarbonate Safety Glasses matching ref-09
    glass_arc = [
        Vector((-0.078, -0.044, 1.594)),
        Vector((-0.068, -0.082, 1.594)),
        Vector((-0.036, -0.103, 1.594)),
        Vector(( 0.000, -0.108, 1.594)),
        Vector(( 0.036, -0.103, 1.594)),
        Vector(( 0.068, -0.082, 1.594)),
        Vector(( 0.078, -0.044, 1.594)),
    ]
    mb.add_tube([p + Vector((0, 0, 0.014)) for p in glass_arc], [0.0032] * len(glass_arc), 'glasses_frame', REG_HEAD, segs=8)
    lens_rings = []
    for p in glass_arc:
        n_out = Vector((p.x, p.y, 0.0)).normalized() * 0.0014
        pt, pb = p + Vector((0, 0, 0.013)), p + Vector((0, 0, -0.014))
        lens_rings.append([pt + n_out, pb + n_out, pb - n_out, pt - n_out])
    mb.add_loft(lens_rings, 'glasses_lens', REG_HEAD, cap_start=True, cap_end=True)
    for sx in (-1.0, 1.0):
        mb.add_tube([
            Vector((sx * 0.078, -0.044, 1.604)),
            Vector((sx * 0.086,  0.004, 1.600)),
            Vector((sx * 0.083,  0.036, 1.586)),
        ], [0.0032, 0.0030, 0.0026], 'glasses_frame', REG_HEAD, segs=6)

    # 3. A-Pose Sculpted Sleeves (`arm_center(sx, z)`) with smooth sloped deltoids & slim wrist for HV gloves
    for side, sx, reg in (('Left', 1.0, REG_LEFT_ARM), ('Right', -1.0, REG_RIGHT_ARM)):
        arm_profile = [
            # (z, rx, ry, x_inward_tuck, fold_amp)
            (1.372, 0.042, 0.046, -sx * 0.026, 0.001),
            (1.348, 0.058, 0.060, -sx * 0.008, 0.002),
            (1.300, 0.060, 0.062,  0.0,        0.003),
            (1.215, 0.057, 0.059,  0.0,        0.003),
            (1.195, 0.058, 0.060,  0.0,        0.001),  # Bicep hi-vis yellow
            (1.182, 0.059, 0.061,  0.0,        0.001),  # Silver
            (1.168, 0.058, 0.060,  0.0,        0.001),  # Yellow
            (1.148, 0.054, 0.056,  0.0,        0.003),
            (1.095, 0.053, 0.056,  0.0,        0.003),  # Elbow patch top
            (1.050, 0.053, 0.057,  0.0,        0.004),  # Elbow center
            (1.005, 0.052, 0.055,  0.0,        0.003),  # Elbow patch bot
            (0.935, 0.048, 0.049,  0.0,        0.002),
            (0.855, 0.041, 0.041,  0.0,        0.002),
            (0.822, 0.040, 0.040,  0.0,        0.001),  # Slim cuff rim
            (0.806, 0.032, 0.032,  0.0,        0.001),  # Stays cleanly inside glove cuff!
        ]
        arm_rings = []
        for z, rx, ry, x_in, fa in arm_profile:
            c = _arm_center(sx, z)
            arm_rings.append(_ellipse_ring(c.x + x_in, c.y, z, rx, ry, segs=24, fold_amp=fa, fold_freq=4.0))
        arm_mats = [
            'navy_fr', 'navy_fr', 'navy_fr', 'navy_fr',
            'hivis_yellow', 'hivis_silver', 'hivis_yellow',
            'navy_fr', 'cordura_knee', 'cordura_knee', 'navy_fr',
            'navy_fr', 'navy_fr', 'navy_trim',
        ]

        def _arm_mat_override(ri, si, segs, base_mk):
            if ri in (8, 9):
                ang = (2.0 * math.pi * (si + 0.5)) / segs
                # Reinforced patch primarily on back/outer elbow (matching ref-09!)
                if math.sin(ang) < 0.05:
                    return 'navy_fr'
            return base_mk

        mb.add_loft(arm_rings, arm_mats, reg, cap_start=True, cap_end=True, face_mat_fn=_arm_mat_override)

    # 4. Sculpted Trousers (`_leg_center(sx, z)`) with Cordura Knee Pads & Ankle Reflective Tape
    for side, sx, reg in (('Left', 1.0, REG_LEFT_LEG), ('Right', -1.0, REG_RIGHT_LEG)):
        leg_profile = [
            (0.885, 0.088, 0.095, -sx * 0.008, 0.002),
            (0.820, 0.084, 0.092, -sx * 0.004, 0.003),
            (0.700, 0.077, 0.083,  0.0,        0.003),
            (0.575, 0.069, 0.074,  0.0,        0.003),
            (0.515, 0.067, 0.073,  0.0,        0.002),  # Knee patch top
            (0.455, 0.068, 0.077,  0.0,        0.002),  # Articulated knee
            (0.395, 0.065, 0.072,  0.0,        0.002),  # Knee patch bot
            (0.310, 0.061, 0.064,  0.0,        0.002),  # Calf (slim enough to fit under arc boots)
            (0.245, 0.058, 0.060,  0.0,        0.002),
            (0.232, 0.059, 0.061,  0.0,        0.001),  # Shin hi-vis yellow
            (0.218, 0.060, 0.062,  0.0,        0.001),  # Silver
            (0.204, 0.059, 0.061,  0.0,        0.001),  # Yellow
            (0.180, 0.057, 0.059,  0.0,        0.002),
            (0.132, 0.057, 0.060,  0.0,        0.001),  # Cuff hem (fits cleanly inside yellow overboot!)
        ]
        leg_rings = []
        for z, rx, ry, x_in, fa in leg_profile:
            c = _leg_center(sx, z)
            leg_rings.append(_ellipse_ring(c.x + x_in, c.y, z, rx, ry, segs=26, fold_amp=fa, fold_freq=5.0))
        leg_mats = [
            'navy_fr', 'navy_fr', 'navy_fr', 'navy_fr',
            'cordura_knee', 'cordura_knee',
            'navy_fr', 'navy_fr', 'navy_fr',
            'hivis_yellow', 'hivis_silver', 'hivis_yellow',
            'navy_fr',
        ]

        def _leg_mat_override(ri, si, segs, base_mk):
            if ri in (4, 5):
                ang = (2.0 * math.pi * (si + 0.5)) / segs
                if math.sin(ang) > -0.15:
                    return 'navy_fr'
            return base_mk

        mb.add_loft(leg_rings, leg_mats, reg, cap_start=True, cap_end=True, face_mat_fn=_leg_mat_override)

        # Flush front dark Cordura knee shield (clears outer khaki over-trousers!)
        kc = _leg_center(sx, 0.455)
        mb.add_beveled_box(Vector((kc.x, kc.y - 0.068, 0.455)), (0.082, 0.011, 0.106), 'cordura_knee', reg, bevel_width=0.004)

    # 5. Smooth Steel-Toe Safety Work Boots (`_leg_center(sx, 0.09)` -> `Z = 0.000` flat on floor!)
    for side, sx, reg in (('Left', 1.0, REG_LEFT_FOOT), ('Right', -1.0, REG_RIGHT_FOOT)):
        fc = _leg_center(sx, 0.090)
        fx, fy = fc.x, fc.y
        # Convex lugged sole + molded leather upper (zero inward heel pinch!)
        sole_rings = [
            _boot_footprint_ring(fx, fy, 0.000, 1.02, 1.02, segs=28, toe_z_lift=0.002),
            _boot_footprint_ring(fx, fy, 0.020, 1.02, 1.02, segs=28, toe_z_lift=0.003),
            _boot_footprint_ring(fx, fy, 0.036, 0.99, 0.99, segs=28, toe_z_lift=0.004),
        ]
        mb.add_loft(sole_rings, 'rubber', reg, cap_start=True, cap_end=True)

        upper_rings = [
            _boot_footprint_ring(fx, fy, 0.035, 0.985, 0.985, segs=28, toe_z_lift=0.004),
            _boot_footprint_ring(fx, fy + 0.004, 0.060, 0.96, 0.96, segs=28, toe_z_lift=0.004),
            _boot_footprint_ring(fx, fy + 0.012, 0.088, 0.91, 0.84, segs=28),
            _boot_footprint_ring(fx, fy + 0.024, 0.114, 0.86, 0.72, segs=28),
            _ellipse_ring(fx, fy + 0.006, 0.145, 0.052, 0.064, segs=28),
        ]
        mb.add_loft(upper_rings, 'boot_leather', reg, cap_start=True, cap_end=True)

        # Criss-cross speed-hook boot laces & brass eyelets on instep
        for zl, yl in ((0.092, fy - 0.095), (0.106, fy - 0.080), (0.120, fy - 0.066), (0.134, fy - 0.054)):
            mb.add_tube(
                [Vector((fx - 0.022, yl, zl)), Vector((fx, yl - 0.006, zl + 0.004)), Vector((fx + 0.022, yl, zl))],
                [0.0030] * 3, 'rubber', reg, segs=6
            )
            for ex in (-0.025, 0.025):
                mb.add_ellipsoid(Vector((fx + ex, yl + 0.002, zl)), (0.0038, 0.0038, 0.0038), 'brass', reg, u_segs=6, v_rings=5)

    return mb.finish('EngineerBody', col)


# ---------------------------------------------------------------------------
# Sculpted 5-Finger Bare Hands & Class 2 HV Dielectric Gauntlets (aligned to A-Pose wrists)
# ---------------------------------------------------------------------------
def build_hand_mesh(name, side, is_glove, mats, col):
    mb = SkinnedCharBuilder(mats)
    sx = 1.0 if side == 'Left' else -1.0
    reg = REG_LEFT_HAND if side == 'Left' else REG_RIGHT_HAND

    # Exact A-pose wrist origin & slight natural outward slope vector from forearm
    wc = _arm_center(sx, 0.810)
    ec = _arm_center(sx, 1.075)
    axis_dn = (wc - ec).normalized()  # downward along forearm axis

    def hand_pt(local_x_in, local_y_fwd, dist_down):
        # Project local offsets along A-pose hand centerline cleanly
        c = wc + axis_dn * dist_down
        return Vector((c.x - sx * local_x_in, c.y + local_y_fwd, c.z))

    if is_glove:
        cuff_mat = 'glove_orange'
        palm_mat = 'leather_tan'
        finger_mat = 'leather_tan'
        scale = 1.15
        # Conformal elliptical Class 2 orange gauntlet worn OVER parka cuff (Z ~ 0.945 .. 0.796)
        # Uses `_arm_center(sx, z)` so rolled cuff bead hugs sleeve cleanly & wrist clears coverall cuff!
        cuff_specs = [
            (0.942, 0.068, 0.068),
            (0.945, 0.073, 0.073),  # Conformal rolled cuff crest
            (0.938, 0.073, 0.073),
            (0.928, 0.068, 0.068),
            (0.892, 0.063, 0.063),
            (0.850, 0.058, 0.057),
            (0.815, 0.054, 0.052),  # Generous wrist clearance over coverall cuff (r=0.042)
            (0.796, 0.050, 0.046),
        ]
        cuff_rings = []
        for z, rx, ry in cuff_specs:
            cc = _arm_center(sx, z)
            cuff_rings.append(_ellipse_ring(cc.x, cc.y, z, rx, ry, segs=24))
        mb.add_loft(cuff_rings, cuff_mat, reg, cap_start=True, cap_end=False)

        # Dark leather cuff border sealing directly down onto palm base (zero gap!)
        c0 = _arm_center(sx, 0.808)
        c1 = _arm_center(sx, 0.798)
        c2 = wc + axis_dn * 0.014
        mb.add_loft([
            _ellipse_ring(c0.x, c0.y, 0.808, 0.052, 0.048, segs=24),
            _ellipse_ring(c1.x, c1.y, 0.798, 0.048, 0.045, segs=24),
            _ellipse_ring(c2.x, c2.y, c2.z,  0.028 * scale, 0.038 * scale, segs=24),
        ], 'dark_fascia', reg, cap_start=False, cap_end=True)
    else:
        palm_mat = 'skin'
        finger_mat = 'skin'
        scale = 1.0

    # Anatomical Palm (dist_down = 0.01 .. 0.095 below wrist `wc`)
    palm_specs = [
        (0.006, 0.023 * scale, 0.034 * scale, 0.000),
        (0.034, 0.022 * scale, 0.040 * scale, -0.002),
        (0.065, 0.019 * scale, 0.042 * scale, -0.002),
        (0.092, 0.016 * scale, 0.039 * scale, -0.001),
    ]
    palm_rings = []
    for dd, rx, ry, yoff in palm_specs:
        c = wc + axis_dn * dd
        palm_rings.append(_ellipse_ring(c.x, c.y + yoff, c.z, rx, ry, segs=20))
    mb.add_loft(palm_rings, palm_mat, reg, cap_start=True, cap_end=True)

    # 4 Articulated Naturally Curled Fingers with smooth rounded fingertips
    finger_specs = [
        (-0.028 * scale, 0.070 * scale, 0.0088 * scale),
        (-0.009 * scale, 0.078 * scale, 0.0092 * scale),
        ( 0.010 * scale, 0.072 * scale, 0.0086 * scale),
        ( 0.028 * scale, 0.058 * scale, 0.0076 * scale),
    ]
    for fy, flen, frad in finger_specs:
        pts = [
            hand_pt(0.000, fy, 0.088),
            hand_pt(0.004, fy, 0.088 + flen * 0.34),
            hand_pt(0.012, fy, 0.088 + flen * 0.68),
            hand_pt(0.020, fy, 0.088 + flen * 0.90),
            hand_pt(0.023, fy, 0.088 + flen * 0.97),
            hand_pt(0.024, fy, 0.088 + flen),
        ]
        rads = [frad * 1.05, frad * 0.95, frad * 0.85, frad * 0.68, frad * 0.50, frad * 0.25]
        mb.add_tube(pts, rads, finger_mat, reg, segs=12)

    # Opposable Curved Thumb
    tr = 0.0102 * scale
    thumb_pts = [
        hand_pt(0.006, -0.030 * scale, 0.036),
        hand_pt(0.016, -0.048 * scale, 0.062),
        hand_pt(0.023, -0.058 * scale, 0.088),
        hand_pt(0.024, -0.057 * scale, 0.104),
        hand_pt(0.024, -0.055 * scale, 0.110),
    ]
    mb.add_tube(thumb_pts, [tr * 1.15, tr * 1.0, tr * 0.86, tr * 0.60, tr * 0.30], finger_mat, reg, segs=12)

    return mb.finish(name, col)


# ---------------------------------------------------------------------------
# Class E Hard Hat, 40 cal/cm² Arc Suit Coat & Trousers, Arc Hood, 20 kV Overboots
# ---------------------------------------------------------------------------
def build_hard_hat_mesh(mats, col):
    """MSA V-Gard Class E white hard hat matching ref-10 inset."""
    mb = SkinnedCharBuilder(mats)
    dome_profile = [
        (1.622, 0.115, 0.172, 0.128, -0.004, 0.000),
        (1.628, 0.111, 0.144, 0.122, -0.002, 0.000),
        (1.634, 0.104, 0.118, 0.116,  0.000, 0.002),
        (1.666, 0.103, 0.115, 0.114,  0.001, 0.006),
        (1.700, 0.095, 0.106, 0.106,  0.002, 0.010),
        (1.732, 0.075, 0.086, 0.086,  0.002, 0.013),
        (1.756, 0.044, 0.056, 0.056,  0.002, 0.012),
        (1.766, 0.016, 0.024, 0.024,  0.002, 0.008),
    ]
    rings = []
    segs = 32
    for z, rx, ryf, ryb, ys, vrh in dome_profile:
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / segs
            ca, sa = math.cos(ang), math.sin(ang)
            ry = ryf if sa < 0 else ryb
            rib_z = vrh * math.exp(-(ca / 0.24) ** 2)
            ring.append(Vector((rx * ca, ys + ry * sa, z + rib_z)))
        rings.append(ring)
    mb.add_loft(rings, 'hardhat_white', REG_HEAD, cap_start=True, cap_end=True)

    # Rear Ratchet Suspension & Nape Dial
    band_pts = [
        Vector((-0.092, -0.020, 1.618)),
        Vector((-0.094,  0.045, 1.598)),
        Vector((-0.058,  0.098, 1.580)),
        Vector(( 0.000,  0.112, 1.576)),
        Vector(( 0.058,  0.098, 1.580)),
        Vector(( 0.094,  0.045, 1.598)),
        Vector(( 0.092, -0.020, 1.618)),
    ]
    mb.add_tube(band_pts, [0.008] * len(band_pts), 'hardhat_harness', REG_HEAD, segs=8)
    mb.add_ellipsoid(Vector((0.0, 0.116, 1.576)), (0.018, 0.012, 0.018), 'hardhat_harness', REG_HEAD, u_segs=10, v_rings=8)

    for sx in (-1.0, 1.0):
        mb.add_beveled_box(Vector((sx * 0.106, -0.005, 1.642)), (0.010, 0.038, 0.014), 'hardhat_harness', REG_HEAD, bevel_width=0.002)
    # Front Marine ETO Shield Badge (matching ref-10 inset)
    mb.add_beveled_box(Vector((0.0, -0.116, 1.680)), (0.042, 0.008, 0.040), 'hardhat_badge', REG_HEAD, rot_euler=(-0.22, 0, 0), bevel_width=0.003)
    mb.add_beveled_box(Vector((0.0, -0.120, 1.680)), (0.024, 0.005, 0.024), 'white_label', REG_HEAD, rot_euler=(-0.22, 0, 0), bevel_width=0.002)

    return mb.finish('EngineerHardHat', col)


def build_arc_suit_coat_mesh(mats, col):
    """
    40 cal/cm² NFPA 70E Nomex Switching Parka + Matching Khaki Arc Trousers (`ref-10-engineer-ppe-kit.jpg`).
    Sleeves and over-trousers track the exact A-pose bone centerlines so swapping clips zero cloth!
    """
    mb = SkinnedCharBuilder(mats)

    # 1. Quilted Parka Coat Torso (Z = 0.72 .. 1.455) matching ref-10 olive border, pockets & stripes
    coat_profile = [
        (0.718, 0.226, 0.152, 0.148, 0.000, 0.003),   # Dark olive lower hem cuff border
        (0.742, 0.228, 0.154, 0.150, 0.000, 0.003),
        (0.768, 0.230, 0.156, 0.152, 0.000, 0.002),   # Lower hem hi-vis yellow
        (0.782, 0.231, 0.157, 0.153, 0.000, 0.001),   # Silver
        (0.798, 0.230, 0.156, 0.152, 0.000, 0.002),   # Yellow
        (0.890, 0.226, 0.153, 0.148, 0.000, 0.004),
        (1.000, 0.222, 0.150, 0.145, 0.000, 0.004),
        (1.135, 0.228, 0.162, 0.150, -0.004, 0.003),  # Chest
        (1.155, 0.230, 0.164, 0.152, -0.004, 0.001),  # Chest hi-vis yellow
        (1.170, 0.231, 0.165, 0.153, -0.004, 0.001),  # Silver
        (1.186, 0.230, 0.164, 0.152, -0.004, 0.001),  # Yellow
        (1.265, 0.230, 0.164, 0.150, -0.004, 0.003),
        (1.335, 0.218, 0.152, 0.142, -0.003, 0.002),  # Rounded shoulder slope
        (1.388, 0.172, 0.124, 0.120, -0.002, 0.002),
        (1.452, 0.104, 0.096, 0.096,  0.002, 0.001),  # Standing thermal collar
    ]
    coat_rings = [
        _torso_ring(z, rx, ryf, ryb, segs=32, y_shift=ys, fold_amp=fa, fold_freq=6)
        for z, rx, ryf, ryb, ys, fa in coat_profile
    ]
    coat_mats = [
        'olive_trim', 'khaki_nomex',
        'hivis_yellow', 'hivis_silver', 'hivis_yellow',
        'khaki_nomex', 'khaki_nomex', 'khaki_nomex',
        'hivis_yellow', 'hivis_silver', 'hivis_yellow',
        'khaki_nomex', 'khaki_nomex', 'olive_trim',
    ]
    mb.add_loft(coat_rings, coat_mats, REG_TORSO, cap_start=True, cap_end=True)

    # Front storm-flap placket (stops at Z=1.305 under hood bib so it never pokes through hood front!)
    mb.add_beveled_box(Vector((0.0, -0.165, 1.015)), (0.062, 0.018, 0.58), 'olive_trim', REG_TORSO, bevel_width=0.004)
    # Left chest utility pocket (+X anatomical left, below hood bib)
    mb.add_beveled_box(Vector((0.098, -0.164, 1.195)), (0.072, 0.020, 0.082), 'khaki_nomex', REG_TORSO, rot_euler=(0.04, 0, -0.15), bevel_width=0.004)
    mb.add_beveled_box(Vector((0.098, -0.168, 1.230)), (0.076, 0.014, 0.022), 'olive_trim', REG_TORSO, rot_euler=(0.05, 0, -0.15), bevel_width=0.003)
    # Twin lower hip cargo bellows pockets + angled flaps
    for sx in (-1.0, 1.0):
        mb.add_beveled_box(Vector((sx * 0.118, -0.158, 0.875)), (0.102, 0.026, 0.118), 'khaki_nomex', REG_TORSO, rot_euler=(0.02, 0, sx * -0.14), bevel_width=0.005)
        mb.add_beveled_box(Vector((sx * 0.118, -0.164, 0.928)), (0.106, 0.018, 0.028), 'olive_trim', REG_TORSO, rot_euler=(0.04, 0, sx * -0.14), bevel_width=0.004)

    # Vertical back shoulder-blade reflective tapes on Khaki Parka (visible in ref-10 BACK VIEW!)
    for sx in (-1.0, 1.0):
        bk_pts = [
            Vector((sx * 0.120, 0.150, 1.186)),
            Vector((sx * 0.120, 0.148, 1.265)),
            Vector((sx * 0.118, 0.140, 1.335)),
        ]
        mb.add_tube(bk_pts, [(0.020, 0.0045)] * 3, 'hivis_yellow', REG_TORSO, segs=8)
        mb.add_tube([p + Vector((0, 0.002, 0)) for p in bk_pts], [(0.010, 0.0035)] * 3, 'hivis_silver', REG_TORSO, segs=8)

    # 2. Loose Khaki Switching Coat Sleeves aligned directly along A-pose Arm Centerline (`_arm_center`)
    for sx, reg in ((1.0, REG_LEFT_ARM), (-1.0, REG_RIGHT_ARM)):
        sl_specs = [
            (1.380, 0.054, 0.058, -sx * 0.024),
            (1.348, 0.076, 0.078, -sx * 0.006),
            (1.300, 0.076, 0.078,  0.0),
            (1.225, 0.073, 0.075,  0.0),
            (1.210, 0.074, 0.076,  0.0),  # Sleeve hi-vis yellow
            (1.196, 0.075, 0.077,  0.0),  # Silver
            (1.182, 0.074, 0.076,  0.0),  # Yellow
            (1.075, 0.069, 0.071,  0.0),  # Elbow
            (0.960, 0.063, 0.064,  0.0),  # Forearm
            (0.895, 0.058, 0.059,  0.0),  # Fits inside Class 2 orange gauntlet cuff!
        ]
        sl_rings = []
        for z, rx, ry, x_in in sl_specs:
            c = _arm_center(sx, z)
            sl_rings.append(_ellipse_ring(c.x + x_in, c.y, z, rx, ry, segs=22))
        sl_mats = [
            'khaki_nomex', 'khaki_nomex', 'khaki_nomex', 'khaki_nomex',
            'hivis_yellow', 'hivis_silver', 'hivis_yellow',
            'khaki_nomex', 'olive_trim',
        ]
        mb.add_loft(sl_rings, sl_mats, reg, cap_start=True, cap_end=True)

    # 3. Matching Khaki Nomex Arc-Flash Over-Trousers (roomy knees + tapered cuffs inside yellow boots!)
    for sx, reg in ((1.0, REG_LEFT_LEG), (-1.0, REG_RIGHT_LEG)):
        pant_specs = [
            (0.875, 0.098, 0.106, -sx * 0.006, 0.003),
            (0.760, 0.093, 0.100,  0.0,        0.004),
            (0.580, 0.088, 0.096,  0.0,        0.004),
            (0.455, 0.086, 0.096,  0.0,        0.003),  # Clears Cordura knee shield completely!
            (0.355, 0.078, 0.084,  0.0,        0.003),
            (0.240, 0.064, 0.068,  0.0,        0.001),  # Tapered cleanly inside yellow overboots (r=0.082)!
            (0.145, 0.060, 0.064,  0.0,        0.001),
        ]
        p_rings = []
        for z, rx, ry, x_in, fa in pant_specs:
            c = _leg_center(sx, z)
            p_rings.append(_ellipse_ring(c.x + x_in, c.y, z, rx, ry, segs=24, fold_amp=fa, fold_freq=5.0))
        mb.add_loft(p_rings, 'khaki_nomex', reg, cap_start=True, cap_end=True)

    return mb.finish('EngineerArcSuitCoat', col)


def build_arc_hood_mesh(mats, col):
    """
    40 cal/cm² NFPA 70E Switching Hood with draped circular Nomex shoulder cape & emerald face shield (ref-10).
    """
    mb = SkinnedCharBuilder(mats)

    hood_profile = [
        (1.245, 0.244, 0.200, 0.178, -0.010, 0.005),  # Draped front & shoulder circular bib clearing collar & placket!
        (1.315, 0.240, 0.194, 0.172, -0.008, 0.004),
        (1.385, 0.214, 0.176, 0.158, -0.006, 0.003),
        (1.448, 0.156, 0.158, 0.144, -0.006, 0.002),  # Neck shroud tuck
        (1.505, 0.146, 0.160, 0.140, -0.008, 0.0),    # Visor lower
        (1.625, 0.144, 0.160, 0.140, -0.008, 0.0),    # Brow / visor upper
        (1.698, 0.134, 0.146, 0.135, -0.004, 0.0),    # Crown transition
        (1.752, 0.098, 0.108, 0.105, -0.002, 0.0),
        (1.780, 0.036, 0.042, 0.042, -0.002, 0.0),    # Dome crest
    ]
    hood_rings = [
        _torso_ring(z, rx, ryf, ryb, segs=32, y_shift=ys, fold_amp=fa, fold_freq=7)
        for z, rx, ryf, ryb, ys, fa in hood_profile
    ]
    mb.add_loft(hood_rings, 'khaki_nomex', REG_ARC_HOOD, cap_start=True, cap_end=True)

    # Molded olive/charcoal visor frame gasket & curved emerald polycarbonate face shield
    visor_arc = [
        Vector((-0.102, -0.130, 1.572)),
        Vector((-0.072, -0.162, 1.572)),
        Vector(( 0.000, -0.176, 1.572)),
        Vector(( 0.072, -0.162, 1.572)),
        Vector(( 0.102, -0.130, 1.572)),
    ]
    mb.add_tube([p + Vector((0, 0,  0.076)) for p in visor_arc], [0.0085] * 5, 'olive_trim', REG_ARC_HOOD, segs=8)
    mb.add_tube([p + Vector((0, 0, -0.068)) for p in visor_arc], [0.0085] * 5, 'olive_trim', REG_ARC_HOOD, segs=8)
    for p_end in (visor_arc[0], visor_arc[-1]):
        mb.add_tube([p_end + Vector((0, 0, -0.068)), p_end + Vector((0, 0, 0.076))], [0.0085, 0.0085], 'olive_trim', REG_ARC_HOOD, segs=8)

    v_rings = []
    for p in visor_arc:
        n_out = Vector((p.x, p.y, 0.0)).normalized() * 0.0035
        pt, pb = p + Vector((0, 0, 0.072)), p + Vector((0, 0, -0.064))
        v_rings.append([pt + n_out, pb + n_out, pb - n_out, pt - n_out])
    mb.add_loft(v_rings, 'emerald_visor', REG_ARC_HOOD, cap_start=True, cap_end=True)

    return mb.finish('EngineerArcHood', col)


def build_hv_overboot_mesh(name, side, mats, col):
    """Tall calf-high 20 kV ASTM F1117 yellow dielectric overboot (`Z = 0.000 .. 0.345`) with zero shoe/pant bleed."""
    mb = SkinnedCharBuilder(mats)
    sx = 1.0 if side == 'Left' else -1.0
    reg = REG_LEFT_FOOT if side == 'Left' else REG_RIGHT_FOOT
    fc = _leg_center(sx, 0.090)
    fx, fy = fc.x, fc.y

    # Black lugged outsole flush at Z = 0.000
    sole_rings = [
        _boot_footprint_ring(fx, fy, 0.000, 1.22, 1.12, segs=28, toe_z_lift=0.002),
        _boot_footprint_ring(fx, fy, 0.022, 1.22, 1.12, segs=28, toe_z_lift=0.003),
        _boot_footprint_ring(fx, fy, 0.040, 1.20, 1.10, segs=28, toe_z_lift=0.004),
    ]
    mb.add_loft(sole_rings, 'rubber', reg, cap_start=True, cap_end=True)

    # Roomy Molded Yellow Overboot Foot & Calf Shaft (100% clears work boot + pant cuffs from Z=0 to Z=0.345!)
    boot_rings = [
        _boot_footprint_ring(fx, fy, 0.039, 1.19, 1.10, segs=28, toe_z_lift=0.004),
        _boot_footprint_ring(fx, fy + 0.002, 0.072, 1.18, 1.08, segs=28, toe_z_lift=0.004),
        _boot_footprint_ring(fx, fy + 0.006, 0.112, 1.22, 1.00, segs=28),
        _boot_footprint_ring(fx, fy + 0.010, 0.148, 1.28, 0.88, segs=28),
        _ellipse_ring(fx, _leg_center(sx, 0.188).y, 0.188, 0.076, 0.086, segs=28),
        _ellipse_ring(fx, _leg_center(sx, 0.255).y, 0.255, 0.080, 0.088, segs=28),
        _ellipse_ring(fx, _leg_center(sx, 0.325).y, 0.325, 0.084, 0.092, segs=28),
        _ellipse_ring(fx, _leg_center(sx, 0.344).y, 0.344, 0.086, 0.094, segs=28),
    ]
    mb.add_loft(boot_rings, 'yellow', reg, cap_start=True, cap_end=False)

    # Conformal black rolled collar lip at Z = 0.344 + dark recessed interior liner
    c_top = _leg_center(sx, 0.344)
    mb.add_loft([
        _ellipse_ring(fx, c_top.y, 0.342, 0.085, 0.093, segs=28),
        _ellipse_ring(fx, c_top.y, 0.348, 0.088, 0.096, segs=28),
        _ellipse_ring(fx, c_top.y, 0.350, 0.082, 0.090, segs=28),
        _ellipse_ring(fx, c_top.y, 0.318, 0.074, 0.082, segs=28),
    ], ['rubber', 'rubber', 'dark_fascia'], reg, cap_start=False, cap_end=True)

    return mb.finish(name, col)


# ---------------------------------------------------------------------------
# Armature & 5 Looping NLA Animation Clips (`Idle`, `Walk`, `Sprint`, `Interact`, `PushTrolley`)
# ---------------------------------------------------------------------------
def build_armature(col):
    arm_data = bpy.data.armatures.new('ArmatureData')
    arm_obj = bpy.data.objects.new('Armature', arm_data)
    col.objects.link(arm_obj)

    override_kwargs = {'active_object': arm_obj, 'object': arm_obj}
    wm = bpy.context.window_manager
    if wm and len(wm.windows) > 0:
        win = wm.windows[0]
        area = next((a for a in win.screen.areas if a.type == 'VIEW_3D'), win.screen.areas[0] if win.screen.areas else None)
        override_kwargs['window'] = win
        override_kwargs['screen'] = win.screen
        if area is not None:
            override_kwargs['area'] = area
            region = next((r for r in area.regions if r.type == 'WINDOW'), area.regions[0] if area.regions else None)
            if region is not None:
                override_kwargs['region'] = region

    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)
    with bpy.context.temp_override(**override_kwargs):
        bpy.ops.object.mode_set(mode='EDIT')

        world_pos = compute_bone_world_positions_blender()
        eb_map = {}

        for name, _, _ in BONE_SPECS_GLTF:
            eb = arm_data.edit_bones.new(name)
            head = world_pos[name]
            eb.head = head
            eb.tail = head + Vector((0.0, 0.0, 0.08))
            eb.roll = 0.0
            eb.use_connect = False
            eb.use_deform = True
            eb_map[name] = eb

        for name, parent_name, _ in BONE_SPECS_GLTF:
            if parent_name is not None:
                eb_map[name].parent = eb_map[parent_name]

        bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj


def build_locomotion_actions(arm_obj):
    """
    Create 5 looping AnimationClips (`Idle`, `Walk`, `Sprint`, `Interact`, `PushTrolley`)
    at 30 fps pushed onto named NLA tracks (handles Blender 5.x action slots safely).
    """
    fps = 30
    bpy.context.scene.render.fps = fps
    arm_obj.animation_data_create()

    for pb in arm_obj.pose.bones:
        pb.rotation_mode = 'XYZ'

    clip_defs = [
        (
            'Idle',
            [0.0, 1.2, 2.4],
            {
                'Hips': {'loc': [(0, 0.0, 0), (0, 0.008, 0), (0, 0.0, 0)]},
                'Chest': {'rot': [(0, 0, 0), (-0.024, 0, 0), (0, 0, 0)]},
                'Head': {'rot': [(0, -0.045, 0), (0, 0.045, 0), (0, -0.045, 0)]},
                'LeftUpperArm': {'rot': [(0, 0, 0.02), (0.02, 0, 0.04), (0, 0, 0.02)]},
                'RightUpperArm': {'rot': [(0, 0, -0.02), (0.02, 0, -0.04), (0, 0, -0.02)]},
                'LeftForeArm': {'rot': [(-0.12, 0, 0), (-0.16, 0, 0), (-0.12, 0, 0)]},
                'RightForeArm': {'rot': [(-0.12, 0, 0), (-0.16, 0, 0), (-0.12, 0, 0)]},
            },
        ),
        (
            'Walk',
            [0.0, 0.24, 0.48, 0.72, 0.96],
            {
                'Hips': {
                    'loc': [(0, 0.0, 0), (0, 0.026, 0), (0, 0.0, 0), (0, 0.026, 0), (0, 0.0, 0)],
                    'rot': [(0, 0.04, 0.02), (0, 0, 0), (0, -0.04, -0.02), (0, 0, 0), (0, 0.04, 0.02)],
                },
                'Chest': {'rot': [(0.05, -0.07, 0), (0.05, 0, 0), (0.05, 0.07, 0), (0.05, 0, 0), (0.05, -0.07, 0)]},
                'LeftThigh': {'rot': [(-0.46, 0, 0), (0, 0, 0), (0.44, 0, 0), (0, 0, 0), (-0.46, 0, 0)]},
                'LeftShin': {'rot': [(0.10, 0, 0), (0.15, 0, 0), (0.45, 0, 0), (0.52, 0, 0), (0.10, 0, 0)]},
                'LeftFoot': {'rot': [(-0.12, 0, 0), (0.02, 0, 0), (0.18, 0, 0), (-0.06, 0, 0), (-0.12, 0, 0)]},
                'RightThigh': {'rot': [(0.44, 0, 0), (0, 0, 0), (-0.46, 0, 0), (0, 0, 0), (0.44, 0, 0)]},
                'RightShin': {'rot': [(0.45, 0, 0), (0.52, 0, 0), (0.10, 0, 0), (0.15, 0, 0), (0.45, 0, 0)]},
                'RightFoot': {'rot': [(0.18, 0, 0), (-0.06, 0, 0), (-0.12, 0, 0), (0.02, 0, 0), (0.18, 0, 0)]},
                'LeftUpperArm': {'rot': [(0.36, 0, 0.02), (0, 0, 0.02), (-0.38, 0, 0.02), (0, 0, 0.02), (0.36, 0, 0.02)]},
                'RightUpperArm': {'rot': [(-0.38, 0, -0.02), (0, 0, -0.02), (0.36, 0, -0.02), (0, 0, -0.02), (-0.38, 0, -0.02)]},
                'LeftForeArm': {'rot': [(-0.16, 0, 0), (-0.24, 0, 0), (-0.34, 0, 0), (-0.22, 0, 0), (-0.16, 0, 0)]},
                'RightForeArm': {'rot': [(-0.34, 0, 0), (-0.22, 0, 0), (-0.16, 0, 0), (-0.24, 0, 0), (-0.34, 0, 0)]},
            },
        ),
        (
            'Sprint',
            [0.0, 0.16, 0.32, 0.48, 0.64],
            {
                'Hips': {
                    'loc': [(0, -0.01, 0), (0, 0.034, 0), (0, -0.01, 0), (0, 0.034, 0), (0, -0.01, 0)],
                    'rot': [(0, 0.06, 0.03), (0, 0, 0), (0, -0.06, -0.03), (0, 0, 0), (0, 0.06, 0.03)],
                },
                'Chest': {'rot': [(0.12, -0.10, 0), (0.12, 0, 0), (0.12, 0.10, 0), (0.12, 0, 0), (0.12, -0.10, 0)]},
                'LeftThigh': {'rot': [(-0.68, 0, 0), (0, 0, 0), (0.62, 0, 0), (0, 0, 0), (-0.68, 0, 0)]},
                'LeftShin': {'rot': [(0.14, 0, 0), (0.22, 0, 0), (0.68, 0, 0), (0.78, 0, 0), (0.14, 0, 0)]},
                'LeftFoot': {'rot': [(-0.16, 0, 0), (0.04, 0, 0), (0.24, 0, 0), (-0.08, 0, 0), (-0.16, 0, 0)]},
                'RightThigh': {'rot': [(0.62, 0, 0), (0, 0, 0), (-0.68, 0, 0), (0, 0, 0), (0.62, 0, 0)]},
                'RightShin': {'rot': [(0.68, 0, 0), (0.78, 0, 0), (0.14, 0, 0), (0.22, 0, 0), (0.68, 0, 0)]},
                'RightFoot': {'rot': [(0.24, 0, 0), (-0.08, 0, 0), (-0.16, 0, 0), (0.04, 0, 0), (0.24, 0, 0)]},
                'LeftUpperArm': {'rot': [(0.56, 0, 0.02), (0, 0, 0.02), (-0.62, 0, 0.02), (0, 0, 0.02), (0.56, 0, 0.02)]},
                'RightUpperArm': {'rot': [(-0.62, 0, -0.02), (0, 0, -0.02), (0.56, 0, -0.02), (0, 0, -0.02), (-0.62, 0, -0.02)]},
                'LeftForeArm': {'rot': [(-0.45, 0, 0), (-0.55, 0, 0), (-0.72, 0, 0), (-0.55, 0, 0), (-0.45, 0, 0)]},
                'RightForeArm': {'rot': [(-0.72, 0, 0), (-0.55, 0, 0), (-0.45, 0, 0), (-0.55, 0, 0), (-0.72, 0, 0)]},
            },
        ),
        (
            'Interact',
            [0.0, 0.45, 0.90, 1.35, 1.80],
            {
                'Hips': {'loc': [(0, 0, 0), (0, -0.015, 0), (0, -0.020, 0), (0, -0.012, 0), (0, 0, 0)]},
                'Chest': {'rot': [(0, 0, 0), (0.08, -0.06, 0), (0.12, -0.10, 0), (0.07, -0.04, 0), (0, 0, 0)]},
                'Head': {'rot': [(0, 0, 0), (0.10, -0.04, 0), (0.14, -0.06, 0), (0.08, -0.02, 0), (0, 0, 0)]},
                'LeftThigh': {'rot': [(-0.04, 0, 0)] * 5},
                'LeftShin': {'rot': [(0.08, 0, 0)] * 5},
                'LeftFoot': {'rot': [(-0.04, 0, 0)] * 5},
                'RightThigh': {'rot': [(-0.04, 0, 0)] * 5},
                'RightShin': {'rot': [(0.08, 0, 0)] * 5},
                'RightFoot': {'rot': [(-0.04, 0, 0)] * 5},
                'RightUpperArm': {'rot': [(0, 0, -0.02), (-0.72, 0.10, 0.06), (-1.05, 0.14, 0.10), (-0.68, 0.08, 0.04), (0, 0, -0.02)]},
                'RightForeArm': {'rot': [(-0.14, 0, 0), (-0.62, 0, 0), (-0.44, 0, 0), (-0.58, 0, 0), (-0.14, 0, 0)]},
                'RightHand': {'rot': [(0, 0, 0), (-0.18, 0.15, 0), (-0.10, -0.25, 0), (-0.15, 0.10, 0), (0, 0, 0)]},
                'LeftUpperArm': {'rot': [(0, 0, 0.02), (-0.18, -0.04, 0.04), (-0.24, -0.06, 0.05), (-0.16, -0.03, 0.04), (0, 0, 0.02)]},
                'LeftForeArm': {'rot': [(-0.14, 0, 0), (-0.28, 0, 0), (-0.32, 0, 0), (-0.24, 0, 0), (-0.14, 0, 0)]},
            },
        ),
        (
            'PushTrolley',
            [0.0, 0.23, 0.46, 0.69, 0.92],
            {
                'Hips': {'loc': [(0, -0.01, 0), (0, 0.012, 0), (0, -0.01, 0), (0, 0.012, 0), (0, -0.01, 0)]},
                'Chest': {'rot': [(0.14, 0, 0), (0.15, 0, 0), (0.14, 0, 0), (0.15, 0, 0), (0.14, 0, 0)]},
                'LeftUpperArm': {'rot': [(-1.05, -0.04, 0.04)] * 5},
                'RightUpperArm': {'rot': [(-1.05, 0.04, -0.04)] * 5},
                'LeftForeArm': {'rot': [(-0.22, 0, 0)] * 5},
                'RightForeArm': {'rot': [(-0.22, 0, 0)] * 5},
                'LeftThigh': {'rot': [(-0.34, 0, 0), (0, 0, 0), (0.34, 0, 0), (0, 0, 0), (-0.34, 0, 0)]},
                'LeftShin': {'rot': [(0.12, 0, 0), (0.16, 0, 0), (0.38, 0, 0), (0.42, 0, 0), (0.12, 0, 0)]},
                'RightThigh': {'rot': [(0.34, 0, 0), (0, 0, 0), (-0.34, 0, 0), (0, 0, 0), (0.34, 0, 0)]},
                'RightShin': {'rot': [(0.38, 0, 0), (0.42, 0, 0), (0.12, 0, 0), (0.16, 0, 0), (0.38, 0, 0)]},
            },
        ),
    ]

    for clip_name, times, tracks in clip_defs:
        act = bpy.data.actions.new(name=clip_name)
        arm_obj.animation_data.action = act

        for pb in arm_obj.pose.bones:
            pb.location = (0.0, 0.0, 0.0)
            pb.rotation_euler = (0.0, 0.0, 0.0)

        for t_idx, t_sec in enumerate(times):
            frame = int(round(t_sec * fps)) + 1
            for bone_name, chan in tracks.items():
                pb = arm_obj.pose.bones[bone_name]
                if 'loc' in chan:
                    pb.location = chan['loc'][t_idx]
                    pb.keyframe_insert(data_path='location', frame=frame)
                if 'rot' in chan:
                    pb.rotation_euler = chan['rot'][t_idx]
                    pb.keyframe_insert(data_path='rotation_euler', frame=frame)

        trk = arm_obj.animation_data.nla_tracks.new()
        trk.name = clip_name
        strip = trk.strips.new(clip_name, 1, act)
        strip.name = clip_name
        if hasattr(strip, 'action_slot') and hasattr(act, 'slots') and len(act.slots) > 0:
            strip.action_slot = act.slots[0]

    arm_obj.animation_data.action = None
    for pb in arm_obj.pose.bones:
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)


# ---------------------------------------------------------------------------
# Main Build & Export
# ---------------------------------------------------------------------------
def build_engineer():
    reset_clean_scene()
    col = ensure_collection('MarineEngineer')
    mats = build_clean_material_library()

    arm_obj = build_armature(col)

    body_obj, body_regs = build_body_mesh(mats, col)
    bind_object_to_armature(body_obj, arm_obj, body_regs)

    l_bare, l_bare_regs = build_hand_mesh('EngineerLeftBareHand', 'Left', False, mats, col)
    bind_object_to_armature(l_bare, arm_obj, l_bare_regs, fixed_region_id=REG_LEFT_HAND)

    r_bare, r_bare_regs = build_hand_mesh('EngineerRightBareHand', 'Right', False, mats, col)
    bind_object_to_armature(r_bare, arm_obj, r_bare_regs, fixed_region_id=REG_RIGHT_HAND)

    l_glove, l_glove_regs = build_hand_mesh('EngineerLeftHvGlove', 'Left', True, mats, col)
    bind_object_to_armature(l_glove, arm_obj, l_glove_regs, fixed_region_id=REG_LEFT_HAND)

    r_glove, r_glove_regs = build_hand_mesh('EngineerRightHvGlove', 'Right', True, mats, col)
    bind_object_to_armature(r_glove, arm_obj, r_glove_regs, fixed_region_id=REG_RIGHT_HAND)

    hard_hat, hh_regs = build_hard_hat_mesh(mats, col)
    bind_object_to_armature(hard_hat, arm_obj, hh_regs, fixed_region_id=REG_HEAD)

    arc_coat, ac_regs = build_arc_suit_coat_mesh(mats, col)
    bind_object_to_armature(arc_coat, arm_obj, ac_regs)

    arc_hood, ah_regs = build_arc_hood_mesh(mats, col)
    bind_object_to_armature(arc_hood, arm_obj, ah_regs, fixed_region_id=REG_ARC_HOOD)

    l_sole, l_sole_regs = build_hv_overboot_mesh('EngineerLeftHvSole', 'Left', mats, col)
    bind_object_to_armature(l_sole, arm_obj, l_sole_regs, fixed_region_id=REG_LEFT_FOOT)

    r_sole, r_sole_regs = build_hv_overboot_mesh('EngineerRightHvSole', 'Right', mats, col)
    bind_object_to_armature(r_sole, arm_obj, r_sole_regs, fixed_region_id=REG_RIGHT_FOOT)

    build_locomotion_actions(arm_obj)

    blend_out = os.path.join(REPO_ROOT, 'assets-src', 'blender', 'engineer.blend')
    os.makedirs(os.path.dirname(blend_out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend_out)

    glb_out = os.path.join(REPO_ROOT, 'godot', 'assets', 'models', 'engineer.glb')
    tris, size_bytes = export_rigged_collection_uncompressed_glb(col, glb_out)

    return {
        'tris': tris,
        'glb_bytes': size_bytes,
        'glb_path': glb_out,
        'blend_path': blend_out,
        'meshes': [o.name for o in col.all_objects if o.type == 'MESH'],
        'actions': [t.name for t in arm_obj.animation_data.nla_tracks],
    }


if __name__ == '__main__':
    print(build_engineer())
