"""
Build and export the high-poly sculpted & multi-bone linear-blend skinned
Marine Chief Electrical Officer (ETO) character:
  - Editable source: `assets-src/blender/engineer.blend`
  - Runtime asset:   `public/models/engineer.glb`

Preserves the exact 19-bone humanoid skeleton + IK targets (`Hips`, `Spine`, `Chest`,
`Neck`, `Head`, `Left/Right UpperArm/ForeArm/Hand`, `Left/Right Thigh/Shin/Foot`,
`RightHandIKTarget`, `LeftHandIKTarget`) and all 4 looping clips
(`Idle`, `Walk`, `Sprint`, `PushTrolley`) expected by `src/game/character.js`
and `src/game/ik.test.mjs`.

Also embeds high-poly swappable PPE & 5-finger hand meshes bound to the same Armature:
  - `EngineerLeftBareHand`, `EngineerRightBareHand`
  - `EngineerLeftHvGlove`, `EngineerRightHvGlove`
  - `EngineerHardHat`
  - `EngineerArcSuitCoat`, `EngineerArcHood`
  - `EngineerLeftHvSole`, `EngineerRightHvSole`
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector
from common_pbr import (
    clear_scene,
    ensure_collection,
    link_object,
    save_blend,
    set_smooth_shading,
)

# ---------------------------------------------------------------------------
# Exact 19-Bone Skeleton Specification (in glTF Y-up, +Z forward coordinates)
# ---------------------------------------------------------------------------
# [name, parent_name, (x_gltf, y_gltf, z_gltf)]
BONE_SPECS_GLTF = [
    ('Hips', None, (0.0, 0.90, 0.0)),
    ('Spine', 'Hips', (0.0, 0.08, 0.0)),
    ('Chest', 'Spine', (0.0, 0.18, 0.0)),
    ('Neck', 'Chest', (0.0, 0.25, 0.0)),
    ('Head', 'Neck', (0.0, 0.06, 0.0)),
    ('LeftUpperArm', 'Chest', (0.235, 0.19, 0.0)),
    ('LeftForeArm', 'LeftUpperArm', (0.0, -0.30, 0.0)),
    ('LeftHand', 'LeftForeArm', (0.0, -0.28, 0.0)),
    ('RightUpperArm', 'Chest', (-0.235, 0.19, 0.0)),
    ('RightForeArm', 'RightUpperArm', (0.0, -0.30, 0.0)),
    ('RightHand', 'RightForeArm', (0.0, -0.28, 0.0)),
    ('LeftThigh', 'Hips', (0.10, -0.05, 0.0)),
    ('LeftShin', 'LeftThigh', (0.0, -0.40, 0.0)),
    ('LeftFoot', 'LeftShin', (0.0, -0.38, 0.04)),
    ('RightThigh', 'Hips', (-0.10, -0.05, 0.0)),
    ('RightShin', 'RightThigh', (0.0, -0.40, 0.0)),
    ('RightFoot', 'RightShin', (0.0, -0.38, 0.04)),
    ('RightHandIKTarget', None, (-0.235, 1.02, 0.36)),
    ('LeftHandIKTarget', None, (0.235, 1.02, 0.36)),
]


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


# ---------------------------------------------------------------------------
# Procedural Packed PBR Textures (Fabric Twill, Leather Grain, Retroreflective)
# ---------------------------------------------------------------------------
def _height_to_normal_rgba(height, strength=1.6):
    """Sobel wrap-around tangent-space normal map RGBA float array [0..1]."""
    h, w = height.shape
    tl = np.roll(np.roll(height, 1, axis=0), 1, axis=1)
    t = np.roll(height, 1, axis=0)
    tr = np.roll(np.roll(height, 1, axis=0), -1, axis=1)
    l = np.roll(height, 1, axis=1)
    r = np.roll(height, -1, axis=1)
    bl = np.roll(np.roll(height, -1, axis=0), 1, axis=1)
    b = np.roll(height, -1, axis=0)
    br = np.roll(np.roll(height, -1, axis=0), -1, axis=1)

    dx = (tr + 2.0 * r + br - (tl + 2.0 * l + bl)) * strength
    dy = (bl + 2.0 * b + br - (tl + 2.0 * t + tr)) * strength
    nx = -dx
    ny = -dy
    nz = np.ones_like(height)
    inv_len = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)

    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., 0] = np.clip(nx * inv_len * 0.5 + 0.5, 0.0, 1.0)
    rgba[..., 1] = np.clip(ny * inv_len * 0.5 + 0.5, 0.0, 1.0)
    rgba[..., 2] = np.clip(nz * inv_len * 0.5 + 0.5, 0.0, 1.0)
    return rgba


def _make_packed_image(name, rgba_float, non_color=True):
    h, w, _ = rgba_float.shape
    img = bpy.data.images.new(name=name, width=w, height=h, alpha=False)
    img.pixels.foreach_set(rgba_float.ravel())
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    img.pack()
    return img


def build_pbr_textures():
    """Generate compact deterministic packed normal maps for twill fabric, leather, and hi-vis."""
    rng = np.random.default_rng(2026)

    # 1. FR Cotton-Twill Fabric diagonal weave normal map (128x128)
    s = 128
    yy, xx = np.mgrid[0:s, 0:s]
    diag = np.sin((xx + yy) * (2.0 * math.pi / 4.0)) * 0.42
    warp = np.sin(xx * (2.0 * math.pi / 4.0)) * 0.22
    weft = np.sin(yy * (2.0 * math.pi / 4.0)) * 0.22
    fold = np.sin(yy * (2.0 * math.pi / 32.0)) * 0.14
    noise = rng.normal(0.0, 0.06, (s, s))
    twill_h = np.clip(0.5 + diag * 0.35 + warp * 0.2 + weft * 0.2 + fold + noise, 0.0, 1.0)
    twill_norm = _make_packed_image('FRTwillNormal', _height_to_normal_rgba(twill_h, strength=1.45), non_color=True)

    # 2. Pebbled Safety Leather grain normal map (128x128)
    l_base = rng.uniform(0.0, 1.0, (s, s))
    # Smooth slightly with 3x3 average for organic pebble cells
    l_smooth = (
        l_base
        + np.roll(l_base, 1, 0)
        + np.roll(l_base, -1, 0)
        + np.roll(l_base, 1, 1)
        + np.roll(l_base, -1, 1)
    ) / 5.0
    l_pebble = np.clip(0.5 + (l_smooth - 0.5) * 1.4 + np.sin(xx * 0.35) * np.sin(yy * 0.35) * 0.16, 0.0, 1.0)
    leather_norm = _make_packed_image('LeatherGrainNormal', _height_to_normal_rgba(l_pebble, strength=1.65), non_color=True)

    # 3. Micro-prismatic 3M retroreflective tape normal map (64x64)
    rs = 64
    ry, rx = np.mgrid[0:rs, 0:rs]
    prism = np.abs(((rx + ry) % 8) - 4) / 4.0 * 0.5 + np.abs(((rx - ry) % 8) - 4) / 4.0 * 0.5
    hivis_norm = _make_packed_image('RetroReflectNormal', _height_to_normal_rgba(prism, strength=1.25), non_color=True)

    return {
        'twill_norm': twill_norm,
        'leather_norm': leather_norm,
        'hivis_norm': hivis_norm,
    }


def make_pbr_mat(
    name,
    color,
    metallic=0.0,
    roughness=0.5,
    coat_weight=0.0,
    coat_roughness=0.15,
    alpha=1.0,
    normal_img=None,
    normal_strength=0.35,
    uv_scale=6.0,
):
    mat = bpy.data.materials.new(name=name)
    if mat.node_tree is None:
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    out.location = (420, 0)
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (100, 0)

    bsdf.inputs['Base Color'].default_value = (*color[:3], 1.0)
    bsdf.inputs['Metallic'].default_value = float(metallic)
    bsdf.inputs['Roughness'].default_value = float(roughness)
    if 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = float(coat_weight)
    if 'Coat Roughness' in bsdf.inputs:
        bsdf.inputs['Coat Roughness'].default_value = float(coat_roughness)
    if alpha < 0.999:
        bsdf.inputs['Alpha'].default_value = float(alpha)
        mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else 'HASHED'

    if normal_img is not None:
        tc = nodes.new('ShaderNodeTexCoord')
        tc.location = (-720, -180)
        mp = nodes.new('ShaderNodeMapping')
        mp.location = (-540, -180)
        mp.inputs['Scale'].default_value = (uv_scale, uv_scale, 1.0)
        ti = nodes.new('ShaderNodeTexImage')
        ti.location = (-320, -180)
        ti.image = normal_img
        nm = nodes.new('ShaderNodeNormalMap')
        nm.location = (-80, -180)
        nm.inputs['Strength'].default_value = float(normal_strength)

        links.new(tc.outputs['UV'], mp.inputs['Vector'])
        links.new(mp.outputs['Vector'], ti.inputs['Vector'])
        links.new(ti.outputs['Color'], nm.inputs['Color'])
        links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat


def build_materials(tex):
    return {
        'navy_fr': make_pbr_mat(
            'FRCoverallNavy', (0.055, 0.105, 0.178), metallic=0.02, roughness=0.76,
            normal_img=tex['twill_norm'], normal_strength=0.38, uv_scale=10.0
        ),
        'navy_trim': make_pbr_mat(
            'FRCoverallDarkTrim', (0.032, 0.062, 0.105), metallic=0.04, roughness=0.72,
            normal_img=tex['twill_norm'], normal_strength=0.42, uv_scale=10.0
        ),
        'cordura_knee': make_pbr_mat(
            'CorduraKneePad', (0.048, 0.056, 0.068), metallic=0.06, roughness=0.68,
            normal_img=tex['twill_norm'], normal_strength=0.52, uv_scale=14.0
        ),
        'hivis_yellow': make_pbr_mat(
            'HiVisYellowTape', (0.86, 0.69, 0.055), metallic=0.14, roughness=0.34,
            coat_weight=0.25, coat_roughness=0.22,
            normal_img=tex['hivis_norm'], normal_strength=0.28, uv_scale=16.0
        ),
        'hivis_silver': make_pbr_mat(
            'RetroReflectiveSilver', (0.76, 0.80, 0.84), metallic=0.78, roughness=0.22,
            coat_weight=0.4, coat_roughness=0.12,
            normal_img=tex['hivis_norm'], normal_strength=0.32, uv_scale=20.0
        ),
        'skin': make_pbr_mat(
            'EngineerSkin', (0.69, 0.45, 0.32), metallic=0.0, roughness=0.54,
            coat_weight=0.06, coat_roughness=0.42
        ),
        'skin_lips': make_pbr_mat(
            'EngineerLips', (0.50, 0.27, 0.22), metallic=0.0, roughness=0.48
        ),
        'hair': make_pbr_mat(
            'MarineCrewHair', (0.045, 0.036, 0.030), metallic=0.02, roughness=0.64,
            normal_img=tex['twill_norm'], normal_strength=0.30, uv_scale=18.0
        ),
        'eye_white': make_pbr_mat('EyeSclera', (0.82, 0.80, 0.78), metallic=0.0, roughness=0.18, coat_weight=0.7),
        'eye_iris': make_pbr_mat('EyeIris', (0.06, 0.045, 0.032), metallic=0.0, roughness=0.10, coat_weight=0.9),
        'glasses_frame': make_pbr_mat('SafetyGlassesFrame', (0.04, 0.05, 0.065), metallic=0.18, roughness=0.30),
        'glasses_lens': make_pbr_mat(
            'SafetyGlassesPolycarb', (0.45, 0.62, 0.72), metallic=0.05, roughness=0.08,
            coat_weight=1.0, coat_roughness=0.05, alpha=0.42
        ),
        'leather_dark': make_pbr_mat(
            'SafetyBootLeather', (0.042, 0.046, 0.052), metallic=0.06, roughness=0.50,
            normal_img=tex['leather_norm'], normal_strength=0.46, uv_scale=9.0
        ),
        'boot_sole': make_pbr_mat(
            'OilResistantSole', (0.026, 0.029, 0.033), metallic=0.04, roughness=0.78,
            normal_img=tex['leather_norm'], normal_strength=0.55, uv_scale=12.0
        ),
        'brass': make_pbr_mat('BrushedBrassHardware', (0.72, 0.52, 0.14), metallic=0.88, roughness=0.26),
        'steel': make_pbr_mat('BrushedSteelHardware', (0.62, 0.66, 0.70), metallic=0.86, roughness=0.28),
        'radio_body': make_pbr_mat('VhfRadioCasing', (0.055, 0.065, 0.075), metallic=0.15, roughness=0.44),
        'gold_epaulette': make_pbr_mat('ChiefEtoGoldStripe', (0.82, 0.62, 0.12), metallic=0.72, roughness=0.30),
        # Swappable PPE Materials
        'hardhat_white': make_pbr_mat(
            'ClassEHardHatShell', (0.88, 0.90, 0.92), metallic=0.04, roughness=0.24,
            coat_weight=0.65, coat_roughness=0.14
        ),
        'hardhat_harness': make_pbr_mat('HardHatSuspension', (0.10, 0.12, 0.14), metallic=0.04, roughness=0.70),
        'hardhat_badge': make_pbr_mat('MarineEtoBadge', (0.05, 0.25, 0.34), metallic=0.15, roughness=0.32),
        'hv_glove_orange': make_pbr_mat(
            'Class2DielectricRubber', (0.82, 0.24, 0.04), metallic=0.02, roughness=0.36,
            coat_weight=0.25, coat_roughness=0.28,
            normal_img=tex['leather_norm'], normal_strength=0.22, uv_scale=10.0
        ),
        'hv_glove_leather': make_pbr_mat(
            'GloveLeatherProtector', (0.68, 0.56, 0.38), metallic=0.0, roughness=0.64,
            normal_img=tex['leather_norm'], normal_strength=0.45, uv_scale=10.0
        ),
        'arc_coat_khaki': make_pbr_mat(
            'ArcFlashNomexKhaki', (0.48, 0.45, 0.34), metallic=0.02, roughness=0.78,
            normal_img=tex['twill_norm'], normal_strength=0.44, uv_scale=10.0
        ),
        'arc_coat_dark': make_pbr_mat(
            'ArcFlashTrimOlive', (0.24, 0.24, 0.19), metallic=0.04, roughness=0.72,
            normal_img=tex['twill_norm'], normal_strength=0.44, uv_scale=10.0
        ),
        'arc_visor_green': make_pbr_mat(
            'ArcFlashPolycarbVisor', (0.10, 0.42, 0.24), metallic=0.06, roughness=0.08,
            coat_weight=1.0, coat_roughness=0.05, alpha=0.46
        ),
        'hv_boot_yellow': make_pbr_mat(
            'DielectricOverbootYellow', (0.86, 0.64, 0.04), metallic=0.02, roughness=0.42,
            coat_weight=0.20, coat_roughness=0.30,
            normal_img=tex['leather_norm'], normal_strength=0.34, uv_scale=12.0
        ),
    }


# ---------------------------------------------------------------------------
# BMesh Lofting & Sculpting Primitives (with Clean UVs & Region Tagging)
# ---------------------------------------------------------------------------
class MeshBuilder:
    """Accumulates high-poly sculpted sub-parts with per-face material slots and skin-region tags."""

    def __init__(self, mat_dict):
        self.bm = bmesh.new()
        self.uv_layer = self.bm.loops.layers.uv.new('UVMap')
        self.region_layer = self.bm.verts.layers.int.new('skin_region')
        self.mat_list = []
        self.mat_index = {}
        self.mat_dict = mat_dict

    def _get_mat_idx(self, mat_key):
        if mat_key not in self.mat_index:
            self.mat_index[mat_key] = len(self.mat_list)
            self.mat_list.append(self.mat_dict[mat_key])
        return self.mat_index[mat_key]

    def _assign_uv_box(self, faces, scale=2.5):
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

    def add_loft(self, rings, mat_key_per_band, region_id, cap_start=True, cap_end=True, uv_v_scale=2.8):
        """
        Stitch rings of equal vertex count into a smooth quad loft.
        `rings`: list of list-of-Vector
        `mat_key_per_band`: str or list[str] of length len(rings) - 1
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

        created_faces = []
        for r_i in range(n_rings - 1):
            mk = mat_key_per_band if isinstance(mat_key_per_band, str) else mat_key_per_band[r_i]
            m_idx = self._get_mat_idx(mk)
            v0 = r_i / max(1, n_rings - 1) * uv_v_scale
            v1 = (r_i + 1) / max(1, n_rings - 1) * uv_v_scale
            for s_i in range(segs):
                s_next = (s_i + 1) % segs
                u0 = s_i / segs * 2.0
                u1 = (s_i + 1) / segs * 2.0
                try:
                    f = self.bm.faces.new((
                        bm_rings[r_i][s_i],
                        bm_rings[r_i][s_next],
                        bm_rings[r_i + 1][s_next],
                        bm_rings[r_i + 1][s_i],
                    ))
                    f.smooth = True
                    f.material_index = m_idx
                    uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
                    for loop, uv in zip(f.loops, uvs):
                        loop[self.uv_layer].uv = uv
                    created_faces.append(f)
                except ValueError:
                    pass

        if cap_start:
            mk = mat_key_per_band if isinstance(mat_key_per_band, str) else mat_key_per_band[0]
            m_idx = self._get_mat_idx(mk)
            center = sum(rings[0], Vector()) / segs
            vc = self.bm.verts.new(center)
            vc[self.region_layer] = region_id
            for s_i in range(segs):
                s_next = (s_i + 1) % segs
                try:
                    f = self.bm.faces.new((bm_rings[0][s_next], bm_rings[0][s_i], vc))
                    f.smooth = True
                    f.material_index = m_idx
                    created_faces.append(f)
                except ValueError:
                    pass

        if cap_end:
            mk = mat_key_per_band if isinstance(mat_key_per_band, str) else mat_key_per_band[-1]
            m_idx = self._get_mat_idx(mk)
            center = sum(rings[-1], Vector()) / segs
            vc = self.bm.verts.new(center)
            vc[self.region_layer] = region_id
            for s_i in range(segs):
                s_next = (s_i + 1) % segs
                try:
                    f = self.bm.faces.new((bm_rings[-1][s_i], bm_rings[-1][s_next], vc))
                    f.smooth = True
                    f.material_index = m_idx
                    created_faces.append(f)
                except ValueError:
                    pass

        return created_faces

    def add_tube(self, path_pts, radii, mat_key, region_id, segs=12, cap_start=True, cap_end=True, oval_ratio=1.0):
        """Build a smooth parallel-transport lofted tube along a 3D spine curve."""
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

        # Initial orthonormal frame
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
        """Add a cleanly beveled hard-surface block (pouches, buckles, radio, pockets)."""
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
                offset=bevel_width,
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

        m_idx = self._get_mat_idx(mat_key)
        for v in all_verts:
            v[self.region_layer] = region_id
        for f in faces:
            f.smooth = True
            f.material_index = m_idx
        self._assign_uv_box(faces, scale=3.0)
        return faces

    def add_ellipsoid(self, center, radii, mat_key, region_id, u_segs=18, v_rings=12, rot_euler=(0, 0, 0)):
        ret = bmesh.ops.create_uvsphere(self.bm, u_segments=u_segs, v_segments=v_rings, radius=1.0)
        verts = ret['verts']
        m_scale = Matrix.Diagonal((radii[0], radii[1], radii[2], 1.0))
        m_rot = Euler(rot_euler, 'XYZ').to_matrix().to_4x4()
        m_loc = Matrix.Translation(center)
        bmesh.ops.transform(self.bm, matrix=m_loc @ m_rot @ m_scale, verts=verts)

        faces = list({f for v in verts for f in v.link_faces})
        m_idx = self._get_mat_idx(mat_key)
        for v in verts:
            v[self.region_layer] = region_id
        for f in faces:
            f.smooth = True
            f.material_index = m_idx
        self._assign_uv_box(faces, scale=3.5)
        return faces

    def build_object(self, name, col, subsurf_levels=0):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)

        # Preserve per-vertex region IDs before converting bmesh to mesh
        mesh = bpy.data.meshes.new(name + '_Mesh')
        self.bm.to_mesh(mesh)
        # Extract region ids aligned with mesh.vertices
        region_ids = [v[self.region_layer] for v in self.bm.verts]
        self.bm.free()

        for mat in self.mat_list:
            mesh.materials.append(mat)

        obj = bpy.data.objects.new(name, mesh)
        link_object(obj, col)
        set_smooth_shading(obj)

        if subsurf_levels > 0:
            # Apply Catmull-Clark subdivision cleanly; region weights are computed analytically
            # after subdivision using vertex coordinates + nearest coarse region tag
            mod = obj.modifiers.new('Subsurf', 'SUBSURF')
            mod.levels = subsurf_levels
            mod.render_levels = subsurf_levels
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.modifier_apply(modifier=mod.name)
            obj.select_set(False)
            set_smooth_shading(obj)
            # Re-derive region tags cleanly via closest-point / coordinate classification if subdivided
            return obj, None

        return obj, region_ids


# Skin region IDs
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


def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / max(1e-6, edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def compute_smooth_skin_weights(co, region_id):
    """
    Analytic smooth multi-bone linear-blend skinning (max 4 bones, sum = 1.0)
    in Blender rest space (+X left, -Y forward, +Z up).
    """
    x, y, z = co.x, co.y, co.z
    w = {}

    if region_id == REG_HEAD:
        if z < 1.445:
            t_neck = smoothstep(1.375, 1.445, z)
            w['Chest'] = 1.0 - t_neck
            w['Neck'] = t_neck
        elif z < 1.505:
            t_head = smoothstep(1.445, 1.505, z)
            w['Neck'] = 1.0 - t_head
            w['Head'] = t_head
        else:
            w['Head'] = 1.0

    elif region_id == REG_ARC_HOOD:
        # Drapes seamlessly across Chest -> Neck -> Head
        if z < 1.38:
            w['Chest'] = 1.0
        elif z < 1.46:
            t = smoothstep(1.38, 1.46, z)
            w['Chest'] = 1.0 - t
            w['Neck'] = t
        elif z < 1.53:
            t = smoothstep(1.46, 1.53, z)
            w['Neck'] = 1.0 - t
            w['Head'] = t
        else:
            w['Head'] = 1.0

    elif region_id == REG_TORSO:
        if z <= 0.90:
            w['Hips'] = 1.0
        elif z < 1.00:
            t = smoothstep(0.90, 1.00, z)
            w['Hips'] = 1.0 - t
            w['Spine'] = t
        elif z < 1.18:
            t = smoothstep(1.00, 1.18, z)
            w['Spine'] = 1.0 - t
            w['Chest'] = t
        elif z < 1.415:
            w['Chest'] = 1.0
        else:
            t = smoothstep(1.415, 1.46, z)
            w['Chest'] = 1.0 - t
            w['Neck'] = t

    elif region_id in (REG_LEFT_ARM, REG_RIGHT_ARM):
        side = 'Left' if region_id == REG_LEFT_ARM else 'Right'
        # Shoulder blend smoothly near deltoid top (Z > 1.30 and |x| < 0.23)
        if z > 1.29:
            t_sh = smoothstep(1.29, 1.39, z) * (1.0 - smoothstep(0.17, 0.25, abs(x))) * 0.45
            w['Chest'] = t_sh
            w[f'{side}UpperArm'] = 1.0 - t_sh
        elif z > 1.09:
            w[f'{side}UpperArm'] = 1.0
        elif z > 1.00:
            # Smooth elbow blend around Z = 1.05
            t_el = smoothstep(1.09, 1.00, z)
            w[f'{side}UpperArm'] = 1.0 - t_el
            w[f'{side}ForeArm'] = t_el
        elif z > 0.80:
            w[f'{side}ForeArm'] = 1.0
        else:
            t_wr = smoothstep(0.80, 0.76, z)
            w[f'{side}ForeArm'] = 1.0 - t_wr
            w[f'{side}Hand'] = t_wr

    elif region_id in (REG_LEFT_HAND, REG_RIGHT_HAND):
        side = 'Left' if region_id == REG_LEFT_HAND else 'Right'
        if z > 0.81:
            w[f'{side}ForeArm'] = 1.0
        elif z > 0.755:
            t = smoothstep(0.81, 0.755, z)
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
        elif z > 0.50:
            w[f'{side}Thigh'] = 1.0
        elif z > 0.40:
            # Smooth knee bend around Z = 0.45
            t_kn = smoothstep(0.50, 0.40, z)
            w[f'{side}Thigh'] = 1.0 - t_kn
            w[f'{side}Shin'] = t_kn
        elif z > 0.145:
            w[f'{side}Shin'] = 1.0
        else:
            t_an = smoothstep(0.145, 0.085, z)
            w[f'{side}Shin'] = 1.0 - t_an
            w[f'{side}Foot'] = t_an

    elif region_id in (REG_LEFT_FOOT, REG_RIGHT_FOOT):
        side = 'Left' if region_id == REG_LEFT_FOOT else 'Right'
        if z > 0.125:
            t = smoothstep(0.16, 0.11, z)
            w[f'{side}Shin'] = 1.0 - t
            w[f'{side}Foot'] = t
        else:
            w[f'{side}Foot'] = 1.0

    else:
        w['Hips'] = 1.0

    # Normalize & cap at 4 influences
    items = sorted(((k, v) for k, v in w.items() if v > 1e-5), key=lambda kv: -kv[1])[:4]
    total = sum(v for _, v in items)
    if total <= 1e-6:
        return [('Hips', 1.0)]
    return [(k, v / total) for k, v in items]


def bind_object_to_armature(obj, arm_obj, region_ids, fixed_region_id=None):
    """Assign smooth linear-blend vertex groups and bind obj to Armature."""
    for name, _, _ in BONE_SPECS_GLTF:
        if name not in obj.vertex_groups:
            obj.vertex_groups.new(name=name)

    mesh = obj.data
    for idx, v in enumerate(mesh.vertices):
        reg = fixed_region_id if fixed_region_id is not None else region_ids[idx]
        weights = compute_smooth_skin_weights(v.co, reg)
        for bone_name, weight in weights:
            obj.vertex_groups[bone_name].add([idx], weight, 'REPLACE')

    obj.parent = arm_obj
    mod = obj.modifiers.new(name='Armature', type='ARMATURE')
    mod.object = arm_obj
    mod.use_vertex_groups = True


# ---------------------------------------------------------------------------
# High-Poly Sculpted Character Geometry Builders
# ---------------------------------------------------------------------------
def _torso_ring(z, rx, ry_front, ry_back, segs=32, y_shift=0.0, fold_amp=0.0025, fold_freq=5, chest_sculpt=0.0):
    pts = []
    for s in range(segs):
        ang = (2.0 * math.pi * s) / segs
        ca = math.cos(ang)
        sa = math.sin(ang)
        # Forward in Blender is -Y (sa < 0)
        ry = ry_front if sa < 0 else ry_back
        # Subtle anatomical super-ellipse squaring for realistic shoulders/ribcage
        sq = 1.0 + 0.06 * (ca * ca * sa * sa)
        # Pectoral / scapular contour
        pec = 0.0
        if chest_sculpt > 0.0 and sa < 0:
            pec = chest_sculpt * math.exp(-((abs(ca) - 0.45) / 0.32) ** 2) * (-sa)
        elif chest_sculpt > 0.0 and sa > 0:
            # Slight spine groove in center back
            pec = -chest_sculpt * 0.45 * math.exp(-(ca / 0.18) ** 2) * sa
        # Organic FR coverall cloth micro-drape folds
        fold = fold_amp * math.sin(ang * fold_freq + z * 18.0)
        px = (rx * sq + fold) * ca
        py = y_shift + (ry * sq + pec + fold) * sa
        pts.append(Vector((px, py, z)))
    return pts


def build_body_mesh(mats, col):
    mb = MeshBuilder(mats)

    # 1. Continuous Sculpted FR Marine Coverall Torso & Pelvis (Z = 0.78 .. 1.445)
    # Each entry: (z, rx, ry_front, ry_back, y_shift, fold_amp, chest_sculpt, mat_below_band)
    torso_profile = [
        (0.790, 0.145, 0.088, 0.092,  0.002, 0.002, 0.000),  # Pelvis base
        (0.840, 0.172, 0.104, 0.114,  0.004, 0.003, 0.000),  # Lower hip/glutes
        (0.900, 0.176, 0.108, 0.115,  0.003, 0.003, 0.000),  # Hips
        (0.935, 0.170, 0.105, 0.108,  0.002, 0.004, 0.000),  # Belt waist cinch
        (0.975, 0.166, 0.104, 0.105,  0.001, 0.004, 0.000),  # Upper waist folds
        (1.035, 0.175, 0.110, 0.108,  0.000, 0.003, 0.002),  # Lower ribs
        (1.055, 0.179, 0.113, 0.111,  0.000, 0.001, 0.003),  # Lower hi-vis yellow lower edge
        (1.068, 0.181, 0.115, 0.112,  0.000, 0.001, 0.003),  # Lower hi-vis silver center
        (1.084, 0.182, 0.116, 0.113,  0.000, 0.001, 0.004),  # Lower hi-vis yellow upper edge
        (1.096, 0.181, 0.115, 0.112,  0.000, 0.003, 0.005),  # Mid torso
        (1.155, 0.192, 0.122, 0.116, -0.002, 0.003, 0.008),  # Lower chest
        (1.215, 0.204, 0.128, 0.120, -0.003, 0.002, 0.011),  # Chest / pectorals
        (1.230, 0.208, 0.130, 0.122, -0.003, 0.001, 0.011),  # Upper hi-vis yellow
        (1.243, 0.210, 0.131, 0.123, -0.003, 0.001, 0.011),  # Upper hi-vis silver
        (1.259, 0.211, 0.131, 0.123, -0.003, 0.001, 0.011),  # Upper hi-vis yellow
        (1.272, 0.210, 0.129, 0.121, -0.002, 0.002, 0.010),  # Upper chest
        (1.335, 0.216, 0.118, 0.115,  0.000, 0.002, 0.006),  # Broad shoulder shelf
        (1.378, 0.184, 0.098, 0.098,  0.002, 0.002, 0.002),  # Trapezius slope
        (1.408, 0.102, 0.082, 0.082,  0.002, 0.001, 0.000),  # Collar base
        (1.445, 0.078, 0.076, 0.076,  0.002, 0.001, 0.000),  # Standing FR collar rim
    ]
    torso_rings = [
        _torso_ring(z, rx, ryf, ryb, segs=32, y_shift=ys, fold_amp=fa, chest_sculpt=cs)
        for (z, rx, ryf, ryb, ys, fa, cs) in torso_profile
    ]
    torso_band_mats = [
        'navy_fr', 'navy_fr', 'navy_fr', 'navy_fr', 'navy_fr',
        'navy_fr',
        'hivis_yellow', 'hivis_silver', 'hivis_yellow',
        'navy_fr', 'navy_fr', 'navy_fr',
        'hivis_yellow', 'hivis_silver', 'hivis_yellow',
        'navy_fr', 'navy_fr', 'navy_fr', 'navy_trim',
    ]
    mb.add_loft(torso_rings, torso_band_mats, REG_TORSO, cap_start=True, cap_end=True)

    # Front zipper storm-flap placket + metallic zipper slider
    mb.add_beveled_box(Vector((0.0, -0.124, 1.16)), (0.036, 0.014, 0.46), 'navy_trim', REG_TORSO, bevel_width=0.003)
    mb.add_beveled_box(Vector((0.0, -0.132, 1.37)), (0.014, 0.010, 0.022), 'steel', REG_TORSO, bevel_width=0.002)
    for zb in (1.02, 1.14, 1.28, 1.38):
        mb.add_ellipsoid(Vector((0.008, -0.131, zb)), (0.005, 0.004, 0.005), 'steel', REG_TORSO, u_segs=8, v_rings=6)

    # Twin Pleated Chest Pockets with Angled Velcro Flaps + Nameplate
    for sx in (-1.0, 1.0):
        px = sx * 0.095
        mb.add_beveled_box(Vector((px, -0.124, 1.275)), (0.092, 0.020, 0.095), 'navy_trim', REG_TORSO,
                           rot_euler=(0.06, 0.0, sx * -0.18), bevel_width=0.004)
        mb.add_beveled_box(Vector((px, -0.129, 1.318)), (0.096, 0.014, 0.026), 'navy_fr', REG_TORSO,
                           rot_euler=(0.08, 0.0, sx * -0.18), bevel_width=0.003)
    # Chief ETO Gold Shoulder Epaulettes (both shoulders)
    for sx in (-1.0, 1.0):
        mb.add_beveled_box(Vector((sx * 0.145, 0.0, 1.392)), (0.095, 0.046, 0.012), 'navy_trim', REG_TORSO,
                           rot_euler=(0.0, sx * 0.24, 0.0), bevel_width=0.003)
        for stripe_off in (-0.018, 0.0, 0.018):
            mb.add_beveled_box(
                Vector((sx * (0.145 + stripe_off * 0.8), 0.0, 1.398 - stripe_off * 0.18)),
                (0.008, 0.047, 0.006), 'gold_epaulette', REG_TORSO,
                rot_euler=(0.0, sx * 0.24, 0.0), bevel_width=0.001
            )

    # Vertical Over-the-Shoulder Hi-Vis Reflective Suspender Tapes (front & back)
    for sx in (-1.0, 1.0):
        strap_pts = [
            Vector((sx * 0.115, -0.130, 1.26)),
            Vector((sx * 0.118, -0.124, 1.335)),
            Vector((sx * 0.112, -0.065, 1.396)),
            Vector((sx * 0.112,  0.005, 1.406)),
            Vector((sx * 0.112,  0.072, 1.392)),
            Vector((sx * 0.116,  0.118, 1.330)),
            Vector((sx * 0.115,  0.124, 1.26)),
        ]
        mb.add_tube(strap_pts, [(0.020, 0.005)] * len(strap_pts), 'hivis_yellow', REG_TORSO, segs=8)
        mb.add_tube(
            [p + Vector((0, -0.002 if p.y < 0 else 0.002, 0.002)) for p in strap_pts],
            [(0.010, 0.004)] * len(strap_pts), 'hivis_silver', REG_TORSO, segs=8
        )

    # Heavy Utility Duty Belt + Brass Buckle + VHF Radio (Left Hip) + Tool Pouch (Right Hip)
    belt_rings = [
        _torso_ring(0.910, 0.182, 0.116, 0.118, segs=32, y_shift=0.002, fold_amp=0.0),
        _torso_ring(0.916, 0.186, 0.120, 0.122, segs=32, y_shift=0.002, fold_amp=0.0),
        _torso_ring(0.954, 0.186, 0.120, 0.122, segs=32, y_shift=0.002, fold_amp=0.0),
        _torso_ring(0.960, 0.182, 0.116, 0.118, segs=32, y_shift=0.002, fold_amp=0.0),
    ]
    mb.add_loft(belt_rings, 'leather_dark', REG_TORSO, cap_start=True, cap_end=True)
    # Brushed Brass Buckle
    mb.add_beveled_box(Vector((0.0, -0.124, 0.935)), (0.064, 0.016, 0.052), 'brass', REG_TORSO, bevel_width=0.004)
    mb.add_beveled_box(Vector((0.0, -0.130, 0.935)), (0.036, 0.012, 0.030), 'leather_dark', REG_TORSO, bevel_width=0.002)
    # Marine VHF Handheld Radio on Left Hip (+X)
    mb.add_beveled_box(Vector((0.198, -0.015, 0.920)), (0.044, 0.064, 0.122), 'radio_body', REG_TORSO, bevel_width=0.006)
    mb.add_tube(
        [Vector((0.205, 0.005, 0.98)), Vector((0.212, 0.012, 1.07)), Vector((0.218, 0.018, 1.15))],
        [0.0065, 0.0048, 0.0032], 'radio_body', REG_TORSO, segs=8
    )
    mb.add_beveled_box(Vector((0.206, -0.032, 0.992)), (0.014, 0.016, 0.022), 'brass', REG_TORSO, bevel_width=0.003)
    # Utility Multimeter / LOTO Pouch on Right Hip (-X)
    mb.add_beveled_box(Vector((-0.198, -0.010, 0.915)), (0.048, 0.088, 0.125), 'leather_dark', REG_TORSO, bevel_width=0.007)
    mb.add_beveled_box(Vector((-0.205, -0.010, 0.955)), (0.046, 0.090, 0.032), 'navy_trim', REG_TORSO, bevel_width=0.005)
    mb.add_beveled_box(Vector((-0.175, -0.082, 0.915)), (0.016, 0.016, 0.036), 'brass', REG_TORSO, bevel_width=0.003)

    # 2. Sculpted Anatomical Neck, Head, Face, Ears, Crew-Cut Hair & Safety Glasses
    # Neck loft (Z = 1.40 .. 1.495)
    neck_rings = []
    for z, rx, ry, ys in [
        (1.400, 0.068, 0.066,  0.004),
        (1.430, 0.058, 0.058,  0.003),
        (1.460, 0.054, 0.056,  0.001),
        (1.492, 0.056, 0.059,  0.000),
    ]:
        neck_rings.append(_torso_ring(z, rx, ry, ry, segs=24, y_shift=ys, fold_amp=0.0))
    mb.add_loft(neck_rings, 'skin', REG_HEAD, cap_start=True, cap_end=True)

    # Anatomical Cranium + Sculpted Face Loft (Z = 1.472 .. 1.696, 32 radial segs)
    head_profile = [
        # (z, rx, ry_front, ry_back, y_shift, jaw_taper, brow_proj, nose_proj)
        (1.475, 0.036, 0.056, 0.032, -0.018, 0.25, 0.000, 0.000),  # Chin bottom
        (1.492, 0.056, 0.078, 0.054, -0.014, 0.18, 0.000, 0.000),  # Jawline & chin point
        (1.516, 0.071, 0.088, 0.074, -0.008, 0.10, 0.000, 0.002),  # Lower cheek / mouth level
        (1.542, 0.078, 0.092, 0.088, -0.004, 0.04, 0.000, 0.006),  # Upper lip / cheeks
        (1.565, 0.082, 0.094, 0.095,  0.000, 0.00, 0.000, 0.014),  # Cheekbones / nose tip level
        (1.590, 0.083, 0.090, 0.098,  0.002, 0.00, 0.002, 0.008),  # Eye sockets / nose bridge
        (1.612, 0.084, 0.095, 0.100,  0.002, 0.00, 0.006, 0.002),  # Brow ridge
        (1.640, 0.084, 0.094, 0.101,  0.003, 0.00, 0.000, 0.000),  # Forehead
        (1.668, 0.077, 0.086, 0.094,  0.004, 0.00, 0.000, 0.000),  # Upper cranium
        (1.688, 0.054, 0.062, 0.068,  0.004, 0.00, 0.000, 0.000),  # Crown
        (1.698, 0.022, 0.025, 0.028,  0.004, 0.00, 0.000, 0.000),  # Top skull cap
    ]
    head_rings = []
    segs_h = 32
    for z, rx, ryf, ryb, ys, jt, bp, npj in head_profile:
        ring = []
        for s in range(segs_h):
            ang = (2.0 * math.pi * s) / segs_h
            ca = math.cos(ang)
            sa = math.sin(ang)
            ry = ryf if sa < 0 else ryb
            # Slight jawline pinch at front
            x_scale = rx * (1.0 - jt * max(0.0, -sa))
            y_extra = 0.0
            if sa < 0:
                # Nose ridge/tip projection along center front (ca ~ 0)
                y_extra -= npj * math.exp(-(ca / 0.17) ** 2) * (-sa)
                # Subtle eye socket indentation around |ca| ~ 0.36 at eye level
                if 1.578 <= z <= 1.602:
                    y_extra += 0.0065 * math.exp(-((abs(ca) - 0.36) / 0.18) ** 2) * (-sa)
                # Brow ridge projection
                if bp > 0:
                    y_extra -= bp * math.exp(-((abs(ca) - 0.30) / 0.35) ** 2) * (-sa)
            ring.append(Vector((x_scale * ca, ys + ry * sa + y_extra, z)))
        head_rings.append(ring)
    mb.add_loft(head_rings, 'skin', REG_HEAD, cap_start=True, cap_end=True)

    # Sculpted Nose, Lips, Ears, Eyes, Eyebrows
    mb.add_ellipsoid(Vector((0.0, -0.098, 1.563)), (0.013, 0.016, 0.013), 'skin', REG_HEAD, u_segs=12, v_rings=8)
    mb.add_ellipsoid(Vector((0.0, -0.090, 1.528)), (0.024, 0.009, 0.007), 'skin_lips', REG_HEAD, u_segs=12, v_rings=8)
    for sx in (-1.0, 1.0):
        # Outer sculpted ears
        mb.add_ellipsoid(Vector((sx * 0.085, 0.008, 1.572)), (0.012, 0.018, 0.030), 'skin', REG_HEAD,
                         u_segs=12, v_rings=8, rot_euler=(0.0, 0.0, sx * -0.15))
        # Eyeballs + Irises + Eyebrows
        mb.add_ellipsoid(Vector((sx * 0.031, -0.082, 1.589)), (0.011, 0.010, 0.009), 'eye_white', REG_HEAD, u_segs=10, v_rings=8)
        mb.add_ellipsoid(Vector((sx * 0.031, -0.090, 1.589)), (0.0055, 0.004, 0.0055), 'eye_iris', REG_HEAD, u_segs=8, v_rings=6)
        mb.add_tube(
            [Vector((sx * 0.014, -0.090, 1.607)), Vector((sx * 0.033, -0.088, 1.610)), Vector((sx * 0.052, -0.079, 1.605))],
            [0.004, 0.0045, 0.0032], 'hair', REG_HEAD, segs=6
        )

    # Cropped Marine Crew-Cut Hair Cap (wraps back, crown, and temples — stays neatly inside hard hat)
    hair_rings = []
    for z, rx, ryf, ryb, ys in [
        (1.568, 0.085, 0.020, 0.100, 0.016),
        (1.610, 0.087, 0.048, 0.104, 0.012),
        (1.646, 0.088, 0.088, 0.105, 0.006),
        (1.675, 0.080, 0.086, 0.097, 0.005),
        (1.697, 0.048, 0.055, 0.060, 0.005),
    ]:
        ring = []
        for s in range(28):
            ang = (2.0 * math.pi * s) / 28
            ca, sa = math.cos(ang), math.sin(ang)
            ry = ryf if sa < 0 else ryb
            ring.append(Vector((rx * ca, ys + ry * sa, z)))
        hair_rings.append(ring)
    mb.add_loft(hair_rings, 'hair', REG_HEAD, cap_start=False, cap_end=True)

    # Wrap-Around ANSI Z87.1 Safety Glasses (curved polycarbonate lenses + dark brow frame + temples)
    glass_arc = [
        Vector((-0.078, -0.044, 1.592)),
        Vector((-0.068, -0.080, 1.592)),
        Vector((-0.036, -0.101, 1.592)),
        Vector(( 0.000, -0.106, 1.592)),
        Vector(( 0.036, -0.101, 1.592)),
        Vector(( 0.068, -0.080, 1.592)),
        Vector(( 0.078, -0.044, 1.592)),
    ]
    mb.add_tube(
        [p + Vector((0, 0, 0.014)) for p in glass_arc],
        [0.0045] * len(glass_arc), 'glasses_frame', REG_HEAD, segs=8
    )
    # Translucent Curved Shield Lens Band
    lens_top = [p + Vector((0, 0, 0.013)) for p in glass_arc]
    lens_bot = [p + Vector((0, 0, -0.015)) for p in glass_arc]
    # Build thin curved lens strip as a closed thin loft
    lens_rings = []
    for p_top, p_bot in zip(lens_top, lens_bot):
        n_out = Vector((p_top.x, p_top.y, 0.0)).normalized() * 0.0022
        lens_rings.append([p_top + n_out, p_bot + n_out, p_bot - n_out, p_top - n_out])
    mb.add_loft(lens_rings, 'glasses_lens', REG_HEAD, cap_start=True, cap_end=True)
    # Temple arms over ears
    for sx in (-1.0, 1.0):
        mb.add_tube([
            Vector((sx * 0.078, -0.044, 1.602)),
            Vector((sx * 0.086,  0.004, 1.598)),
            Vector((sx * 0.083,  0.036, 1.584)),
        ], [0.004, 0.0038, 0.0032], 'glasses_frame', REG_HEAD, segs=6)

    # 3. Sculpted Left & Right Sleeves (Deltoid -> Bicep -> Elbow -> Forearm -> Wrist Cuff)
    for side, sx, reg in (('Left', 1.0, REG_LEFT_ARM), ('Right', -1.0, REG_RIGHT_ARM)):
        ax = sx * 0.235
        arm_profile = [
            # (z, rx, ry, x_off, y_off, fold_amp)
            (1.392, 0.042, 0.048, -sx * 0.032, 0.000, 0.001),  # Upper deltoid cap
            (1.360, 0.068, 0.070, -sx * 0.010, 0.000, 0.002),  # Rounded shoulder cap
            (1.310, 0.065, 0.067,  0.000,      0.002, 0.003),  # Upper bicep
            (1.230, 0.060, 0.062,  0.000,      0.002, 0.003),  # Mid bicep
            (1.145, 0.057, 0.058,  0.000,      0.003, 0.003),  # Lower bicep
            (1.132, 0.058, 0.059,  0.000,      0.003, 0.001),  # Upper arm hi-vis yellow
            (1.120, 0.059, 0.060,  0.000,      0.003, 0.001),  # Upper arm hi-vis silver
            (1.106, 0.058, 0.059,  0.000,      0.003, 0.001),  # Upper arm hi-vis yellow
            (1.092, 0.055, 0.056,  0.000,      0.004, 0.004),  # Above elbow crease
            (1.050, 0.054, 0.057,  0.000,      0.006, 0.005),  # Elbow joint folds
            (1.000, 0.053, 0.055,  0.000,      0.002, 0.003),  # Upper forearm
            (0.925, 0.049, 0.050,  0.000,      0.000, 0.002),  # Mid forearm
            (0.845, 0.045, 0.044,  0.000,     -0.001, 0.002),  # Lower forearm
            (0.812, 0.047, 0.046,  0.000,     -0.001, 0.001),  # Buttoned FR cuff flare
            (0.782, 0.043, 0.042,  0.000,     -0.001, 0.001),  # Wrist cuff edge
        ]
        arm_rings = []
        for z, rx, ry, xo, yo, fa in arm_profile:
            ring = []
            for s in range(22):
                ang = (2.0 * math.pi * s) / 22
                ca, sa = math.cos(ang), math.sin(ang)
                fold = fa * math.sin(ang * 4.0 + z * 24.0)
                ring.append(Vector((ax + xo + (rx + fold) * ca, yo + (ry + fold) * sa, z)))
            arm_rings.append(ring)
        arm_mats = [
            'navy_fr', 'navy_fr', 'navy_fr', 'navy_fr', 'navy_fr',
            'hivis_yellow', 'hivis_silver', 'hivis_yellow',
            'navy_fr', 'navy_fr', 'navy_fr', 'navy_fr', 'navy_fr', 'navy_trim',
        ]
        mb.add_loft(arm_rings, arm_mats, reg, cap_start=True, cap_end=True)

        # Pen / utility slot pocket on Left Upper Sleeve
        if side == 'Left':
            mb.add_beveled_box(
                Vector((ax + 0.062, 0.0, 1.245)), (0.014, 0.046, 0.088),
                'navy_trim', reg, bevel_width=0.003
            )

    # 4. Sculpted Trousers (Thigh -> Cargo Pocket -> Cordura Knee Pad -> Calf -> Hem)
    for side, sx, reg in (('Left', 1.0, REG_LEFT_LEG), ('Right', -1.0, REG_RIGHT_LEG)):
        lx = sx * 0.100
        leg_profile = [
            # (z, rx, ry, x_off, y_off, fold_amp)
            (0.885, 0.088, 0.095, -sx * 0.010,  0.004, 0.002),  # Hip top bridge
            (0.820, 0.085, 0.092, -sx * 0.004,  0.004, 0.003),  # Upper thigh
            (0.710, 0.079, 0.084,  0.000,       0.002, 0.003),  # Mid thigh
            (0.585, 0.071, 0.075,  0.000,       0.002, 0.003),  # Lower thigh
            (0.515, 0.067, 0.072,  0.000,      -0.002, 0.004),  # Upper knee pad seam
            (0.455, 0.068, 0.076,  0.000,      -0.004, 0.003),  # Articulated knee pad center
            (0.395, 0.065, 0.071,  0.000,      -0.001, 0.004),  # Lower knee pad seam
            (0.320, 0.064, 0.068,  0.000,       0.005, 0.003),  # Upper calf
            (0.240, 0.060, 0.062,  0.000,       0.002, 0.002),  # Lower calf
            (0.228, 0.061, 0.063,  0.000,       0.002, 0.001),  # Ankle hi-vis yellow
            (0.214, 0.062, 0.064,  0.000,       0.002, 0.001),  # Ankle hi-vis silver
            (0.200, 0.061, 0.063,  0.000,       0.002, 0.001),  # Ankle hi-vis yellow
            (0.185, 0.059, 0.061,  0.000,       0.001, 0.003),  # Trouser gather over boot
            (0.125, 0.062, 0.066,  0.000,      -0.004, 0.002),  # Trouser cuff hem
        ]
        leg_rings = []
        for z, rx, ry, xo, yo, fa in leg_profile:
            ring = []
            for s in range(24):
                ang = (2.0 * math.pi * s) / 24
                ca, sa = math.cos(ang), math.sin(ang)
                fold = fa * math.sin(ang * 5.0 + z * 20.0)
                ring.append(Vector((lx + xo + (rx + fold) * ca, yo + (ry + fold) * sa, z)))
            leg_rings.append(ring)
        leg_mats = [
            'navy_fr', 'navy_fr', 'navy_fr', 'navy_fr',
            'cordura_knee', 'cordura_knee',
            'navy_fr', 'navy_fr', 'navy_fr',
            'hivis_yellow', 'hivis_silver', 'hivis_yellow',
            'navy_fr',
        ]
        mb.add_loft(leg_rings, leg_mats, reg, cap_start=True, cap_end=True)

        # Side Cargo Bellows Pocket on Outer Thigh
        mb.add_beveled_box(
            Vector((lx + sx * 0.076, 0.004, 0.680)), (0.022, 0.095, 0.128),
            'navy_trim', reg, bevel_width=0.005
        )
        mb.add_beveled_box(
            Vector((lx + sx * 0.081, 0.004, 0.735)), (0.018, 0.098, 0.028),
            'navy_fr', reg, bevel_width=0.004
        )
        # Sculpted Front Knee-Pad Protective Cushion Plate
        mb.add_beveled_box(
            Vector((lx, -0.074, 0.455)), (0.095, 0.022, 0.118),
            'cordura_knee', reg, bevel_width=0.008
        )

    # 5. High-Poly Marine Steel-Toe Safety Work Boots (soles flush at Z = 0.000)
    for side, sx, reg in (('Left', 1.0, REG_LEFT_FOOT), ('Right', -1.0, REG_RIGHT_FOOT)):
        fx = sx * 0.100
        # Boot upper shaft + anatomical sculpted vamp + bulbous steel toe cap
        # Built as horizontal contour slices from Z = 0.000 to Z = 0.155
        boot_slices = [
            # (z, rx, y_front, y_back, mat_above)
            (0.000, 0.062, -0.172, 0.082),  # Treaded lug sole bottom (flush on deck!)
            (0.018, 0.064, -0.176, 0.084),  # Sole welt edge
            (0.032, 0.062, -0.172, 0.080),  # Midsole / upper leather seam
            (0.062, 0.060, -0.165, 0.076),  # Steel-toe cap bulge
            (0.088, 0.056, -0.132, 0.072),  # Instep vamp slope
            (0.112, 0.053, -0.078, 0.068),  # Ankle lace collar
            (0.145, 0.055, -0.062, 0.064),  # Padded collar rim
        ]
        boot_rings = []
        for z, rx, yf, yb in boot_slices:
            ym = 0.5 * (yf + yb)
            ry = 0.5 * (yb - yf)
            ring = []
            for s in range(24):
                ang = (2.0 * math.pi * s) / 24
                ca, sa = math.cos(ang), math.sin(ang)
                # Slightly wider forefoot, narrower heel
                w_mod = 1.05 if sa < 0 else 0.88
                ring.append(Vector((fx + rx * w_mod * ca, ym + ry * sa, z)))
            boot_rings.append(ring)
        boot_mats = ['boot_sole', 'boot_sole', 'leather_dark', 'leather_dark', 'leather_dark', 'leather_dark']
        mb.add_loft(boot_rings, boot_mats, reg, cap_start=True, cap_end=True)

        # Criss-cross speed-hook boot laces & metallic eyelets on instep
        for i_l, (zl, yl) in enumerate([(0.092, -0.112), (0.106, -0.095), (0.120, -0.080), (0.134, -0.068)]):
            mb.add_tube(
                [Vector((fx - 0.024, yl, zl)), Vector((fx, yl - 0.008, zl + 0.004)), Vector((fx + 0.024, yl, zl))],
                [0.0032] * 3, 'boot_sole', reg, segs=6
            )
            for ex in (-0.027, 0.027):
                mb.add_ellipsoid(Vector((fx + ex, yl + 0.002, zl)), (0.004, 0.004, 0.004), 'brass', reg, u_segs=6, v_rings=5)

    return mb.build_object('EngineerBodyMesh', col, subsurf_levels=0)


# ---------------------------------------------------------------------------
# Sculpted 5-Finger Hands & Class 2 HV Dielectric Gauntlets
# ---------------------------------------------------------------------------
def build_hand_mesh(name, side, is_glove, mats, col):
    """Build either a sculpted 5-finger bare hand OR a Class 2 HV orange gauntlet with 5 fingers."""
    mb = MeshBuilder(mats)
    sx = 1.0 if side == 'Left' else -1.0
    reg = REG_LEFT_HAND if side == 'Left' else REG_RIGHT_HAND
    hx = sx * 0.235

    if is_glove:
        cuff_mat = 'hv_glove_orange'
        palm_mat = 'hv_glove_leather'
        finger_mat = 'hv_glove_leather'
        scale = 1.18
        # Flared Class 2 HV dielectric rubber gauntlet worn OVER coat cuff (Z = 0.96 -> 0.77)
        cuff_rings = []
        for z, rx, ry in [
            (0.962, 0.073, 0.073),  # Rolled high-visibility Class 2 safety cuff lip
            (0.946, 0.069, 0.069),
            (0.900, 0.065, 0.065),
            (0.845, 0.060, 0.058),
            (0.795, 0.052, 0.048),
            (0.768, 0.046, 0.042),
        ]:
            ring = []
            for s in range(20):
                ang = (2.0 * math.pi * s) / 20
                ring.append(Vector((hx + rx * math.cos(ang), ry * math.sin(ang), z)))
            cuff_rings.append(ring)
        mb.add_loft(cuff_rings, cuff_mat, reg, cap_start=True, cap_end=True)
        # Rolled cuff lip torus bead
        lip_ring = [Vector((hx + 0.074 * math.cos(2 * math.pi * s / 20), 0.074 * math.sin(2 * math.pi * s / 20), 0.962)) for s in range(20)]
        mb.add_tube(lip_ring + [lip_ring[0]], [0.0065] * 21, cuff_mat, reg, segs=8, cap_start=False, cap_end=False)
        # Leather protector wrist strap
        mb.add_beveled_box(Vector((hx, 0.0, 0.792)), (0.104, 0.094, 0.018), 'hv_glove_leather', reg, bevel_width=0.004)
    else:
        palm_mat = 'skin'
        finger_mat = 'skin'
        scale = 1.0

    # Anatomical Palm (Z = 0.778 .. 0.696; palm faces inward toward body +/-X, thumb forward -Y)
    palm_rings = []
    for z, rx, ry, yo in [
        (0.778, 0.025 * scale, 0.036 * scale,  0.000),  # Wrist base
        (0.750, 0.024 * scale, 0.042 * scale, -0.002),  # Mid palm + thenar pad
        (0.720, 0.021 * scale, 0.044 * scale, -0.002),  # Lower palm
        (0.698, 0.017 * scale, 0.041 * scale, -0.001),  # Knuckle ridge
    ]:
        ring = []
        for s in range(18):
            ang = (2.0 * math.pi * s) / 18
            ring.append(Vector((hx + rx * math.cos(ang), yo + ry * math.sin(ang), z)))
        palm_rings.append(ring)
    mb.add_loft(palm_rings, palm_mat, reg, cap_start=True, cap_end=True)

    # 4 Sculpted Articulated Fingers (Index, Middle, Ring, Pinky) in natural slight working curl
    finger_specs = [
        # (y_offset, length, radius)
        (-0.029 * scale, 0.072 * scale, 0.0092 * scale),  # Index
        (-0.009 * scale, 0.080 * scale, 0.0095 * scale),  # Middle
        ( 0.011 * scale, 0.074 * scale, 0.0090 * scale),  # Ring
        ( 0.029 * scale, 0.060 * scale, 0.0078 * scale),  # Pinky
    ]
    for fy, flen, frad in finger_specs:
        # Subtle inward anatomical curl toward body (-sx)
        f_pts = [
            Vector((hx, fy, 0.704)),
            Vector((hx - sx * 0.004, fy, 0.704 - flen * 0.36)),
            Vector((hx - sx * 0.013, fy, 0.704 - flen * 0.72)),
            Vector((hx - sx * 0.024, fy, 0.704 - flen * 1.00)),
        ]
        f_rads = [frad * 1.05, frad * 0.96, frad * 0.86, frad * 0.68]
        mb.add_tube(f_pts, f_rads, finger_mat, reg, segs=10, cap_start=True, cap_end=True)

    # Opposable Thumb (pointing forward -Y and slightly downward/inward)
    tr = 0.0108 * scale
    thumb_pts = [
        Vector((hx - sx * 0.008, -0.032 * scale, 0.752)),
        Vector((hx - sx * 0.018, -0.052 * scale, 0.730)),
        Vector((hx - sx * 0.025, -0.062 * scale, 0.704)),
        Vector((hx - sx * 0.026, -0.060 * scale, 0.686)),
    ]
    mb.add_tube(thumb_pts, [tr * 1.15, tr * 1.0, tr * 0.88, tr * 0.72], finger_mat, reg, segs=10)

    return mb.build_object(name, col, subsurf_levels=0)


# ---------------------------------------------------------------------------
# Sculpted Class E Hard Hat, 40 cal/cm² Arc-Flash Suit Coat & Hood, HV Overboots
# ---------------------------------------------------------------------------
def build_hard_hat_mesh(mats, col):
    """MSA V-Gard style Class E hard hat with central V-rib, curved bill, rain brim & harness."""
    mb = MeshBuilder(mats)

    # Parabolic shell dome + wrap-around rain gutter brim + front visor peak (-Y)
    dome_profile = [
        # (z, rx, ry_front, ry_back, y_shift, vrib_h)
        (1.618, 0.116, 0.172, 0.128, -0.004, 0.000),  # Outer brim + front peak visor
        (1.624, 0.112, 0.145, 0.122, -0.002, 0.000),  # Rain gutter lip
        (1.630, 0.104, 0.118, 0.116,  0.000, 0.002),  # Shell base
        (1.662, 0.103, 0.115, 0.114,  0.001, 0.006),  # Mid shell
        (1.696, 0.095, 0.106, 0.106,  0.002, 0.010),  # Upper shell curve
        (1.728, 0.075, 0.086, 0.086,  0.002, 0.013),  # Crown shoulder
        (1.752, 0.044, 0.056, 0.056,  0.002, 0.012),  # Crown top
        (1.762, 0.016, 0.024, 0.024,  0.002, 0.008),  # Apex
    ]
    rings = []
    segs = 32
    for z, rx, ryf, ryb, ys, vrh in dome_profile:
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / segs
            ca, sa = math.cos(ang), math.sin(ang)
            ry = ryf if sa < 0 else ryb
            # Characteristic MSA V-rib crest ridge running front-to-back along center top
            rib_z = vrh * math.exp(-(ca / 0.24) ** 2)
            ring.append(Vector((rx * ca, ys + ry * sa, z + rib_z)))
        rings.append(ring)
    mb.add_loft(rings, 'hardhat_white', REG_HEAD, cap_start=True, cap_end=True)

    # Rear Ratchet Suspension Band & Nape Adjustment Knob
    band_pts = [
        Vector((-0.092, -0.020, 1.615)),
        Vector((-0.094,  0.045, 1.595)),
        Vector((-0.058,  0.098, 1.578)),
        Vector(( 0.000,  0.112, 1.574)),
        Vector(( 0.058,  0.098, 1.578)),
        Vector(( 0.094,  0.045, 1.595)),
        Vector(( 0.092, -0.020, 1.615)),
    ]
    mb.add_tube(band_pts, [0.008] * len(band_pts), 'hardhat_harness', REG_HEAD, segs=8)
    mb.add_ellipsoid(Vector((0.0, 0.116, 1.574)), (0.018, 0.012, 0.018), 'hardhat_harness', REG_HEAD, u_segs=10, v_rings=8)

    # Side Accessory Earmuff Mounting Slots + Front Marine ETO Safety Crest
    for sx in (-1.0, 1.0):
        mb.add_beveled_box(Vector((sx * 0.106, -0.005, 1.638)), (0.010, 0.038, 0.014), 'hardhat_harness', REG_HEAD, bevel_width=0.002)
    mb.add_beveled_box(Vector((0.0, -0.116, 1.676)), (0.044, 0.008, 0.036), 'hardhat_badge', REG_HEAD,
                       rot_euler=(-0.22, 0.0, 0.0), bevel_width=0.003)

    return mb.build_object('EngineerHardHat', col, subsurf_levels=0)


def build_arc_suit_coat_mesh(mats, col):
    """Sculpted 40 cal/cm² NFPA 70E HRC 4 multi-layer quilted Nomex switching coat + sleeves."""
    mb = MeshBuilder(mats)

    # Heavy outer parka torso shell (Z = 0.74 .. 1.455) enveloping coverall, pockets, and belt hardware cleanly
    coat_profile = [
        (0.740, 0.238, 0.160, 0.156,  0.000, 0.004),  # Flared lower switching coat hem
        (0.840, 0.232, 0.156, 0.152,  0.000, 0.004),  # Lower hip (clears radio & tool pouch)
        (0.950, 0.228, 0.152, 0.148,  0.000, 0.005),  # Waist quilt baffle
        (1.045, 0.226, 0.154, 0.148,  0.000, 0.004),  # Lower hi-vis yellow
        (1.060, 0.228, 0.156, 0.150,  0.000, 0.001),  # Silver
        (1.076, 0.229, 0.157, 0.151,  0.000, 0.001),  # Yellow
        (1.092, 0.228, 0.156, 0.150,  0.000, 0.004),  # Mid chest
        (1.225, 0.240, 0.176, 0.156, -0.006, 0.004),  # Upper chest (generously clears coverall chest pockets)
        (1.240, 0.242, 0.178, 0.158, -0.006, 0.001),  # Upper hi-vis yellow
        (1.255, 0.243, 0.179, 0.159, -0.006, 0.001),  # Silver
        (1.270, 0.242, 0.178, 0.158, -0.006, 0.001),  # Yellow
        (1.340, 0.238, 0.170, 0.152, -0.004, 0.003),  # Smoothly rounded shoulder taper
        (1.392, 0.192, 0.138, 0.132, -0.002, 0.002),  # High shoulder slope
        (1.455, 0.106, 0.098, 0.098,  0.002, 0.001),  # Standing FR thermal collar
    ]
    coat_rings = [
        _torso_ring(z, rx, ryf, ryb, segs=30, y_shift=ys, fold_amp=fa, fold_freq=6)
        for (z, rx, ryf, ryb, ys, fa) in coat_profile
    ]
    coat_mats = [
        'arc_coat_khaki', 'arc_coat_khaki', 'arc_coat_khaki',
        'hivis_yellow', 'hivis_silver', 'hivis_yellow',
        'arc_coat_khaki', 'arc_coat_khaki',
        'hivis_yellow', 'hivis_silver', 'hivis_yellow',
        'arc_coat_khaki', 'arc_coat_dark',
    ]
    mb.add_loft(coat_rings, coat_mats, REG_TORSO, cap_start=True, cap_end=True)

    # Heavy double-layered front Velcro storm-flap placket
    mb.add_beveled_box(Vector((0.0, -0.180, 1.095)), (0.064, 0.020, 0.68), 'arc_coat_dark', REG_TORSO, bevel_width=0.005)

    # Quilted Switching Coat Sleeves (tucked inside Class 2 HV gauntlet cuffs at Z = 0.855)
    for sx, reg in ((1.0, REG_LEFT_ARM), (-1.0, REG_RIGHT_ARM)):
        ax = sx * 0.235
        sl_rings = []
        for z, rx, ry, xo in [
            (1.404, 0.056, 0.060, -sx * 0.028),  # Rounded deltoid shoulder dome clearing underlying sleeve cap
            (1.374, 0.078, 0.080, -sx * 0.010),
            (1.335, 0.082, 0.084, -sx * 0.002),
            (1.240, 0.073, 0.075,  0.000),
            (1.135, 0.070, 0.071,  0.000),
            (1.120, 0.071, 0.072,  0.000),
            (1.105, 0.070, 0.071,  0.000),
            (1.050, 0.067, 0.069,  0.000),
            (0.955, 0.061, 0.062,  0.000),
            (0.855, 0.054, 0.054,  0.000),  # Tucks cleanly into flared Class 2 HV gauntlet
        ]:
            ring = []
            for s in range(20):
                ang = (2.0 * math.pi * s) / 20
                ring.append(Vector((ax + xo + rx * math.cos(ang), ry * math.sin(ang), z)))
            sl_rings.append(ring)
        sl_mats = [
            'arc_coat_khaki', 'arc_coat_khaki', 'arc_coat_khaki', 'arc_coat_khaki',
            'hivis_yellow', 'hivis_silver',
            'arc_coat_khaki', 'arc_coat_khaki', 'arc_coat_dark',
        ]
        mb.add_loft(sl_rings, sl_mats, reg, cap_start=True, cap_end=True)

    return mb.build_object('EngineerArcSuitCoat', col, subsurf_levels=0)


def build_arc_hood_mesh(mats, col):
    """40 cal/cm² NFPA 70E switching hood with Nomex shoulder drape + emerald polycarbonate face shield."""
    mb = MeshBuilder(mats)

    # Outer Nomex hood shell & shoulder cape (Z = 1.32 .. 1.775) with front face window opening
    hood_profile = [
        (1.315, 0.238, 0.165, 0.155,  0.000),  # Wide draped shoulder bib
        (1.378, 0.212, 0.152, 0.148,  0.000),  # Shoulder slope drape
        (1.445, 0.148, 0.146, 0.138, -0.006),  # Neck shroud
        (1.500, 0.142, 0.154, 0.136, -0.008),  # Lower hood frame
        (1.625, 0.140, 0.156, 0.136, -0.008),  # Upper hood window
        (1.695, 0.130, 0.142, 0.132, -0.004),  # Crown transition
        (1.748, 0.095, 0.106, 0.104, -0.002),  # Hard-hat dome crown
        (1.774, 0.036, 0.042, 0.042, -0.002),  # Hood apex
    ]
    hood_rings = []
    segs = 30
    for z, rx, ryf, ryb, ys in hood_profile:
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / segs
            ca, sa = math.cos(ang), math.sin(ang)
            ry = ryf if sa < 0 else ryb
            ring.append(Vector((rx * ca, ys + ry * sa, z)))
        hood_rings.append(ring)
    hood_mats = ['arc_coat_khaki', 'arc_coat_khaki', 'arc_coat_khaki', 'arc_coat_khaki', 'arc_coat_khaki', 'arc_coat_khaki', 'arc_coat_dark']
    mb.add_loft(hood_rings, hood_mats, REG_ARC_HOOD, cap_start=True, cap_end=True)

    # Molded Black Gasket Window Bezel Frame & Curved Green Anti-Fog Polycarbonate Visor
    visor_arc = [
        Vector((-0.102, -0.125, 1.568)),
        Vector((-0.072, -0.158, 1.568)),
        Vector(( 0.000, -0.172, 1.568)),
        Vector(( 0.072, -0.158, 1.568)),
        Vector(( 0.102, -0.125, 1.568)),
    ]
    # Top & bottom rubber frame rails
    mb.add_tube([p + Vector((0, 0,  0.076)) for p in visor_arc], [0.011] * 5, 'arc_coat_dark', REG_ARC_HOOD, segs=8)
    mb.add_tube([p + Vector((0, 0, -0.068)) for p in visor_arc], [0.011] * 5, 'arc_coat_dark', REG_ARC_HOOD, segs=8)
    # Side frame posts
    for p_end in (visor_arc[0], visor_arc[-1]):
        mb.add_tube([p_end + Vector((0, 0, -0.068)), p_end + Vector((0, 0, 0.076))], [0.011, 0.011], 'arc_coat_dark', REG_ARC_HOOD, segs=8)

    # Curved Panoramic Translucent Green Polycarbonate Face Shield
    v_rings = []
    for p in visor_arc:
        n_out = Vector((p.x, p.y, 0.0)).normalized() * 0.004
        pt = p + Vector((0, 0, 0.072))
        pb = p + Vector((0, 0, -0.064))
        v_rings.append([pt + n_out, pb + n_out, pb - n_out, pt - n_out])
    mb.add_loft(v_rings, 'arc_visor_green', REG_ARC_HOOD, cap_start=True, cap_end=True)

    return mb.build_object('EngineerArcHood', col, subsurf_levels=0)


def build_hv_overboot_mesh(name, side, mats, col):
    """Sculpted 20 kV ASTM F1117 yellow dielectric rubber overboot."""
    mb = MeshBuilder(mats)
    sx = 1.0 if side == 'Left' else -1.0
    reg = REG_LEFT_FOOT if side == 'Left' else REG_RIGHT_FOOT
    fx = sx * 0.100

    slices = [
        (0.000, 0.070, -0.184, 0.092),
        (0.022, 0.073, -0.188, 0.094),
        (0.044, 0.070, -0.182, 0.088),
        (0.074, 0.066, -0.172, 0.082),
        (0.104, 0.062, -0.136, 0.078),
        (0.132, 0.062, -0.080, 0.076),
        (0.168, 0.065, -0.074, 0.076),
    ]
    rings = []
    for z, rx, yf, yb in slices:
        ym = 0.5 * (yf + yb)
        ry = 0.5 * (yb - yf)
        ring = []
        for s in range(22):
            ang = (2.0 * math.pi * s) / 22
            ca, sa = math.cos(ang), math.sin(ang)
            w_mod = 1.05 if sa < 0 else 0.90
            ring.append(Vector((fx + rx * w_mod * ca, ym + ry * sa, z)))
        rings.append(ring)
    mats_band = ['boot_sole', 'hv_boot_yellow', 'hv_boot_yellow', 'hv_boot_yellow', 'hv_boot_yellow', 'hv_boot_yellow']
    mb.add_loft(rings, mats_band, reg, cap_start=True, cap_end=True)

    # Rear kick-off spur tab
    mb.add_beveled_box(Vector((fx, 0.095, 0.032)), (0.028, 0.022, 0.018), 'boot_sole', reg, bevel_width=0.004)
    return mb.build_object(name, col, subsurf_levels=0)


# ---------------------------------------------------------------------------
# Armature Construction & 4 Looping AnimationClips
# ---------------------------------------------------------------------------
def build_armature(col):
    arm_data = bpy.data.armatures.new('ArmatureData')
    arm_obj = bpy.data.objects.new('Armature', arm_data)
    link_object(arm_obj, col)

    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')

    world_pos = compute_bone_world_positions_blender()
    eb_map = {}

    for name, parent_name, _ in BONE_SPECS_GLTF:
        eb = arm_data.edit_bones.new(name)
        head = world_pos[name]
        # Pointing straight +Z in Blender with roll=0 yields EXACT identity quaternion (0,0,0,1)
        # in glTF Y-up space, matching CCDIKSolver & character.js bone conventions!
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
    Create the 4 looping AnimationClips (`Idle`, `Walk`, `Sprint`, `PushTrolley`)
    in exact order, authored at 30 fps via NLA tracks for clean glTF export.
    Note: Because every bone is vertical +Z with roll=0, PoseBone local (x, y, z)
    matches glTF local (x, y, z) 1-to-1!
    """
    fps = 30
    bpy.context.scene.render.fps = fps
    arm_obj.animation_data_create()

    for pb in arm_obj.pose.bones:
        pb.rotation_mode = 'XYZ'

    # Tracks defined as: { bone_name: { 'loc': [(t, (dx, dy, dz))], 'rot': [(t, (rx, ry, rz))] } }
    # Note: loc is DELTA from rest position in bone-local (glTF) space.
    clip_defs = [
        (
            'Idle',
            [0.0, 1.2, 2.4],
            {
                'Hips': {'loc': [(0, 0.0, 0), (0, 0.008, 0), (0, 0.0, 0)]},
                'Chest': {'rot': [(0, 0, 0), (-0.025, 0, 0), (0, 0, 0)]},
                'Head': {'rot': [(0, -0.045, 0), (0, 0.045, 0), (0, -0.045, 0)]},
                'LeftUpperArm': {'rot': [(0, 0, -0.07), (0.02, 0, -0.09), (0, 0, -0.07)]},
                'RightUpperArm': {'rot': [(0, 0, 0.07), (0.02, 0, 0.09), (0, 0, 0.07)]},
                'LeftForeArm': {'rot': [(-0.14, 0, 0), (-0.18, 0, 0), (-0.14, 0, 0)]},
                'RightForeArm': {'rot': [(-0.14, 0, 0), (-0.18, 0, 0), (-0.14, 0, 0)]},
            },
        ),
        (
            'Walk',
            [0.0, 0.24, 0.48, 0.72, 0.96],
            {
                'Hips': {
                    'loc': [(0, 0.0, 0), (0, 0.028, 0), (0, 0.0, 0), (0, 0.028, 0), (0, 0.0, 0)],
                    'rot': [(0, 0.04, 0.02), (0, 0, 0), (0, -0.04, -0.02), (0, 0, 0), (0, 0.04, 0.02)],
                },
                'Chest': {'rot': [(0.05, -0.07, 0), (0.05, 0, 0), (0.05, 0.07, 0), (0.05, 0, 0), (0.05, -0.07, 0)]},
                'LeftThigh': {'rot': [(-0.46, 0, 0), (0, 0, 0), (0.44, 0, 0), (0, 0, 0), (-0.46, 0, 0)]},
                'LeftShin': {'rot': [(0.10, 0, 0), (0.15, 0, 0), (0.45, 0, 0), (0.52, 0, 0), (0.10, 0, 0)]},
                'LeftFoot': {'rot': [(-0.12, 0, 0), (0.02, 0, 0), (0.18, 0, 0), (-0.06, 0, 0), (-0.12, 0, 0)]},
                'RightThigh': {'rot': [(0.44, 0, 0), (0, 0, 0), (-0.46, 0, 0), (0, 0, 0), (0.44, 0, 0)]},
                'RightShin': {'rot': [(0.45, 0, 0), (0.52, 0, 0), (0.10, 0, 0), (0.15, 0, 0), (0.45, 0, 0)]},
                'RightFoot': {'rot': [(0.18, 0, 0), (-0.06, 0, 0), (-0.12, 0, 0), (0.02, 0, 0), (0.18, 0, 0)]},
                'LeftUpperArm': {'rot': [(0.36, 0, -0.07), (0, 0, -0.07), (-0.38, 0, -0.07), (0, 0, -0.07), (0.36, 0, -0.07)]},
                'RightUpperArm': {'rot': [(-0.38, 0, 0.07), (0, 0, 0.07), (0.36, 0, 0.07), (0, 0, 0.07), (-0.38, 0, 0.07)]},
                'LeftForeArm': {'rot': [(-0.18, 0, 0), (-0.26, 0, 0), (-0.36, 0, 0), (-0.24, 0, 0), (-0.18, 0, 0)]},
                'RightForeArm': {'rot': [(-0.36, 0, 0), (-0.24, 0, 0), (-0.18, 0, 0), (-0.26, 0, 0), (-0.36, 0, 0)]},
            },
        ),
        (
            'Sprint',
            [0.0, 0.16, 0.32, 0.48, 0.64],
            {
                'Hips': {
                    'loc': [(0, -0.01, 0), (0, 0.035, 0), (0, -0.01, 0), (0, 0.035, 0), (0, -0.01, 0)],
                    'rot': [(0, 0.06, 0.03), (0, 0, 0), (0, -0.06, -0.03), (0, 0, 0), (0, 0.06, 0.03)],
                },
                'Chest': {'rot': [(0.12, -0.10, 0), (0.12, 0, 0), (0.12, 0.10, 0), (0.12, 0, 0), (0.12, -0.10, 0)]},
                'LeftThigh': {'rot': [(-0.68, 0, 0), (0, 0, 0), (0.62, 0, 0), (0, 0, 0), (-0.68, 0, 0)]},
                'LeftShin': {'rot': [(0.14, 0, 0), (0.22, 0, 0), (0.68, 0, 0), (0.78, 0, 0), (0.14, 0, 0)]},
                'LeftFoot': {'rot': [(-0.16, 0, 0), (0.04, 0, 0), (0.24, 0, 0), (-0.08, 0, 0), (-0.16, 0, 0)]},
                'RightThigh': {'rot': [(0.62, 0, 0), (0, 0, 0), (-0.68, 0, 0), (0, 0, 0), (0.62, 0, 0)]},
                'RightShin': {'rot': [(0.68, 0, 0), (0.78, 0, 0), (0.14, 0, 0), (0.22, 0, 0), (0.68, 0, 0)]},
                'RightFoot': {'rot': [(0.24, 0, 0), (-0.08, 0, 0), (-0.16, 0, 0), (0.04, 0, 0), (0.24, 0, 0)]},
                'LeftUpperArm': {'rot': [(0.56, 0, -0.08), (0, 0, -0.08), (-0.62, 0, -0.08), (0, 0, -0.08), (0.56, 0, -0.08)]},
                'RightUpperArm': {'rot': [(-0.62, 0, 0.08), (0, 0, 0.08), (0.56, 0, 0.08), (0, 0, 0.08), (-0.62, 0, 0.08)]},
                'LeftForeArm': {'rot': [(-0.45, 0, 0), (-0.55, 0, 0), (-0.72, 0, 0), (-0.55, 0, 0), (-0.45, 0, 0)]},
                'RightForeArm': {'rot': [(-0.72, 0, 0), (-0.55, 0, 0), (-0.45, 0, 0), (-0.55, 0, 0), (-0.72, 0, 0)]},
            },
        ),
        (
            'PushTrolley',
            [0.0, 0.23, 0.46, 0.69, 0.92],
            {
                'Hips': {'loc': [(0, -0.01, 0), (0, 0.012, 0), (0, -0.01, 0), (0, 0.012, 0), (0, -0.01, 0)]},
                'Chest': {'rot': [(0.15, 0, 0), (0.16, 0, 0), (0.15, 0, 0), (0.16, 0, 0), (0.15, 0, 0)]},
                'LeftUpperArm': {'rot': [(-1.12, -0.06, -0.05)] * 5},
                'RightUpperArm': {'rot': [(-1.12, 0.06, 0.05)] * 5},
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

        # Reset all pose bones before keying each action
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

        # Push onto dedicated NLA track named identically to clip_name
        trk = arm_obj.animation_data.nla_tracks.new()
        trk.name = clip_name
        strip = trk.strips.new(clip_name, 1, act)
        strip.name = clip_name

    # Clear active action so glTF exporter reads cleanly from NLA tracks in order
    arm_obj.animation_data.action = None
    for pb in arm_obj.pose.bones:
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)


# ---------------------------------------------------------------------------
# Main Build & Export Pipeline
# ---------------------------------------------------------------------------
def main():
    clear_scene()
    col = ensure_collection('MarineEngineer')
    tex = build_pbr_textures()
    mats = build_materials(tex)

    arm_obj = build_armature(col)

    # Build primary body + swappable high-poly PPE/hand meshes
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

    # Author all 4 locomotion clips
    build_locomotion_actions(arm_obj)

    # Triangle audit across all generated meshes
    total_tris = 0
    for obj in col.objects:
        if obj.type == 'MESH':
            tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
            total_tris += tris
            print(f'[build_engineer]   {obj.name}: {len(obj.data.vertices)} verts, {tris} tris')
    print(f'[build_engineer] Total high-poly triangles: {total_tris}')
    if total_tris < 12000:
        raise RuntimeError(f'Expected high-poly engineer >= 12000 tris, got {total_tris}')

    blend_out = os.path.join(REPO_ROOT, 'assets-src', 'blender', 'engineer.blend')
    glb_out = os.path.join(REPO_ROOT, 'public', 'models', 'engineer.glb')

    save_blend(blend_out)
    print(f'[build_engineer] Saved editable Blender rig: {blend_out}')

    os.makedirs(os.path.dirname(glb_out), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        export_yup=True,
        export_apply=False,  # Keep Armature modifier live for glTF skinning!
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials='EXPORT',
        export_skins=True,
        export_all_influences=False,
        export_def_bones=False,  # Preserve IK target bones in skeleton!
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_force_sampling=True,
        export_frame_step=1,
        export_draco_mesh_compression_enable=False,  # Keep Node GLTFLoader + CCDIKSolver tests 100% native
    )
    size_kb = os.path.getsize(glb_out) / 1024.0
    print(f'[build_engineer] Exported rigged GLB: {glb_out} ({size_kb:.1f} KB)')


if __name__ == '__main__':
    main()
