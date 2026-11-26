"""
Build and export high-poly, beveled, Draco-compressed Blender 5.2+ `.glb` assemblies
for all switchroom stations and industrial marine architecture:
  - `public/models/ppe-locker.glb`         (with named PpeLockerSuit / PpeLockerGloves / PpeLockerBoots)
  - `public/models/permit-desk.glb`        (with drawers, hardwood top, PTW/SFT binders, intercom, beacon mast)
  - `public/models/test-bench.glb`         (welded ESD bench, 6.6 kV proving unit, 5 kV Megger + leads, HV wand)
  - `public/models/key-board.glb`          (welded bench, framed pegboard, red LOTO lockbox, padlocks, keys, tools)
  - `public/models/vcb-workbench.glb`      (heavy maintenance bench, 3-drawer chest, ESD mat, pegboard, task lamp)
  - `public/models/room-architecture.glb`  (gusset brackets, marine piping/conduit, junction boxes, LED luminaires,
                                            coved kickplates, first-aid cabinet, bolted wheel stops)
  - Editable combined scene: `assets-src/blender/room_props.blend`

Coordinate convention (glTF Y-up output via `export_yup=True`):
  Blender (+X, -Y, +Z) -> Three.js / glTF (+X, +Y, +Z).
  Helper `g2b(x, y, z)` converts Three.js local coordinates directly to Blender space!
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


def g2b(x, y, z):
    """Convert Three.js/glTF local (x, y_up, z_fwd) to Blender (x, -z_fwd, y_up)."""
    return Vector((x, -z, y))


def gsize(sx, sy, sz):
    """Convert Three.js box dimensions (w_x, h_y, d_z) to Blender (w_x, d_y, h_z)."""
    return (sx, sz, sy)


# ---------------------------------------------------------------------------
# Packed Procedural PBR Normal Textures (Powder Coat, Brushed Steel, Wood, ESD)
# ---------------------------------------------------------------------------
def _height_to_normal_rgba(height, strength=1.5):
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
    nx, ny, nz = -dx, -dy, np.ones_like(height)
    inv_len = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)

    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., 0] = np.clip(nx * inv_len * 0.5 + 0.5, 0.0, 1.0)
    rgba[..., 1] = np.clip(ny * inv_len * 0.5 + 0.5, 0.0, 1.0)
    rgba[..., 2] = np.clip(nz * inv_len * 0.5 + 0.5, 0.0, 1.0)
    return rgba


def _make_packed_image(name, rgba_float):
    h, w, _ = rgba_float.shape
    img = bpy.data.images.new(name=name, width=w, height=h, alpha=False)
    img.pixels.foreach_set(rgba_float.ravel())
    img.colorspace_settings.name = 'Non-Color'
    img.pack()
    return img


def build_prop_textures():
    rng = np.random.default_rng(707)
    s = 128
    yy, xx = np.mgrid[0:s, 0:s]

    # 1. Powder-coat micro-stipple
    p_noise = rng.normal(0.5, 0.14, (s, s))
    p_smooth = (p_noise + np.roll(p_noise, 1, 0) + np.roll(p_noise, -1, 0) + np.roll(p_noise, 1, 1) + np.roll(p_noise, -1, 1)) / 5.0
    powder_norm = _make_packed_image('PropPowderNormal', _height_to_normal_rgba(np.clip(p_smooth, 0, 1), strength=1.25))

    # 2. Brushed stainless anisotropic streaks
    row_var = rng.normal(0.0, 0.22, (s, 1))
    fine = rng.normal(0.0, 0.08, (s, s))
    brush_h = np.clip(0.5 + row_var + fine * 0.5 + np.sin(yy * 0.65) * 0.08, 0, 1)
    brushed_norm = _make_packed_image('PropBrushedNormal', _height_to_normal_rgba(brush_h, strength=1.35))

    # 3. Laminated marine hardwood grain
    warp = np.sin(xx * (2.0 * math.pi / s) * 2.0) * 0.35 + np.sin(yy * (2.0 * math.pi / s) * 4.0) * 0.20
    wood_h = np.clip(0.5 + 0.25 * np.sin((yy * 0.42 + warp * 5.0)) + rng.normal(0, 0.05, (s, s)), 0, 1)
    wood_norm = _make_packed_image('PropWoodNormal', _height_to_normal_rgba(wood_h, strength=1.20))

    # 4. Perforated pegboard / textured ESD rubber stipple
    esd_h = np.clip(0.5 + 0.20 * np.sin(xx * 0.9) * np.sin(yy * 0.9) + rng.normal(0, 0.08, (s, s)), 0, 1)
    esd_norm = _make_packed_image('PropEsdNormal', _height_to_normal_rgba(esd_h, strength=1.30))

    return {
        'powder': powder_norm,
        'brushed': brushed_norm,
        'wood': wood_norm,
        'esd': esd_norm,
    }


def make_mat(
    name,
    color,
    metallic=0.0,
    roughness=0.5,
    coat_weight=0.0,
    coat_roughness=0.14,
    alpha=1.0,
    emission=None,
    emission_strength=0.0,
    normal_img=None,
    normal_strength=0.30,
    uv_scale=4.0,
):
    mat = bpy.data.materials.new(name=name)
    if mat.node_tree is None:
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (*color[:3], 1.0)
    bsdf.inputs['Metallic'].default_value = float(metallic)
    bsdf.inputs['Roughness'].default_value = float(roughness)
    if 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = float(coat_weight)
    if 'Coat Roughness' in bsdf.inputs:
        bsdf.inputs['Coat Roughness'].default_value = float(coat_roughness)
    if alpha < 0.999:
        bsdf.inputs['Alpha'].default_value = float(alpha)
        if hasattr(mat, 'blend_method'):
            mat.blend_method = 'BLEND'
    if emission is not None and emission_strength > 0.0:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = (*emission[:3], 1.0)
        if 'Emission Strength' in bsdf.inputs:
            bsdf.inputs['Emission Strength'].default_value = float(emission_strength)

    if normal_img is not None:
        tc = nodes.new('ShaderNodeTexCoord')
        mp = nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (uv_scale, uv_scale, 1.0)
        ti = nodes.new('ShaderNodeTexImage')
        ti.image = normal_img
        nm = nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = float(normal_strength)
        links.new(tc.outputs['UV'], mp.inputs['Vector'])
        links.new(mp.outputs['Vector'], ti.inputs['Vector'])
        links.new(ti.outputs['Color'], nm.inputs['Color'])
        links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat


def build_materials(tex):
    return {
        'teal_locker': make_mat('MarineTealCabinet', (0.045, 0.215, 0.255), 0.28, 0.44, normal_img=tex['powder'], normal_strength=0.30, uv_scale=4.0),
        'teal_dark': make_mat('MarineTealRecess', (0.025, 0.120, 0.145), 0.32, 0.52, normal_img=tex['powder'], normal_strength=0.32, uv_scale=4.0),
        'steel_dark': make_mat('IndustrialSteelDark', (0.085, 0.105, 0.128), 0.62, 0.44, normal_img=tex['powder'], normal_strength=0.32, uv_scale=5.0),
        'steel_mid': make_mat('IndustrialSteelMid', (0.21, 0.25, 0.29), 0.58, 0.40, normal_img=tex['powder'], normal_strength=0.28, uv_scale=5.0),
        'steel_light': make_mat('GalvSteelFrame', (0.48, 0.53, 0.58), 0.80, 0.30, normal_img=tex['brushed'], normal_strength=0.36, uv_scale=5.0),
        'chrome': make_mat('PolishedStainless', (0.76, 0.80, 0.84), 0.92, 0.20, normal_img=tex['brushed'], normal_strength=0.18, uv_scale=6.0),
        'brass': make_mat('MachinedBrass', (0.76, 0.55, 0.14), 0.88, 0.24),
        'copper': make_mat('ElectrolyticCopper', (0.72, 0.34, 0.14), 0.88, 0.26, normal_img=tex['brushed'], normal_strength=0.22, uv_scale=6.0),
        'wood_top': make_mat('LaminatedOakTop', (0.42, 0.30, 0.18), 0.04, 0.48, coat_weight=0.25, coat_roughness=0.24, normal_img=tex['wood'], normal_strength=0.36, uv_scale=3.0),
        'rubber_black': make_mat('HeavyElastomerBlack', (0.032, 0.036, 0.042), 0.04, 0.78, normal_img=tex['esd'], normal_strength=0.38, uv_scale=8.0),
        'esd_green': make_mat('PhenolicEsdMat', (0.045, 0.21, 0.135), 0.04, 0.64, normal_img=tex['esd'], normal_strength=0.34, uv_scale=7.0),
        'safety_red': make_mat('SafetyRedEnamel', (0.58, 0.068, 0.052), 0.24, 0.34, coat_weight=0.35, coat_roughness=0.18, normal_img=tex['powder'], normal_strength=0.24, uv_scale=4.0),
        'safety_yellow': make_mat('SafetyYellowEnamel', (0.82, 0.56, 0.038), 0.18, 0.34, coat_weight=0.30, coat_roughness=0.20, normal_img=tex['powder'], normal_strength=0.24, uv_scale=4.0),
        'safety_green': make_mat('FirstAidGreen', (0.048, 0.32, 0.15), 0.20, 0.38, coat_weight=0.25, normal_img=tex['powder'], normal_strength=0.22, uv_scale=4.0),
        'safety_orange': make_mat('Class2OrangeRubber', (0.84, 0.24, 0.038), 0.04, 0.38, coat_weight=0.22),
        'leather_tan': make_mat('GloveLeatherTan', (0.66, 0.54, 0.36), 0.02, 0.66),
        'arc_khaki': make_mat('ArcNomexKhaki', (0.44, 0.42, 0.32), 0.02, 0.76, normal_img=tex['powder'], normal_strength=0.30, uv_scale=6.0),
        'arc_visor': make_mat('ArcVisorEmerald', (0.10, 0.46, 0.26), 0.05, 0.08, coat_weight=1.0, coat_roughness=0.04, alpha=0.52),
        'glass_clear': make_mat('CabinetAcrylicGlass', (0.76, 0.88, 0.94), 0.04, 0.06, coat_weight=1.0, coat_roughness=0.04, alpha=0.26),
        'paper_white': make_mat('PermitPaperCream', (0.86, 0.84, 0.78), 0.0, 0.78),
        'white_enamel': make_mat('MedicalCrossWhite', (0.90, 0.92, 0.94), 0.04, 0.28),
        'lcd_green': make_mat('MeggerLcdBacklit', (0.04, 0.16, 0.11), 0.05, 0.12, coat_weight=0.8, emission=(0.14, 0.62, 0.38), emission_strength=0.85),
        'led_strip': make_mat('MarineLedDiffuser', (0.94, 0.98, 1.0), 0.0, 0.18, emission=(0.94, 0.98, 1.0), emission_strength=1.55),
        'pipe_grey': make_mat('MarineAirPipe', (0.34, 0.40, 0.46), 0.68, 0.36, normal_img=tex['brushed'], normal_strength=0.26, uv_scale=5.0),
        'cable_blue': make_mat('GuardLeadBlue', (0.06, 0.24, 0.68), 0.06, 0.46),
        'ceramic_white': make_mat('PorcelainInsulator', (0.86, 0.85, 0.82), 0.02, 0.16, coat_weight=0.8),
    }


# ---------------------------------------------------------------------------
# Fast Clean Hard-Surface BMesh Builder (Bevels, Cylinders, Tubes, Bolts)
# ---------------------------------------------------------------------------
class HardSurfaceBuilder:
    def __init__(self, mat_dict):
        self.bm = bmesh.new()
        self.uv_layer = self.bm.loops.layers.uv.new('UVMap')
        self.mat_list = []
        self.mat_index = {}
        self.mat_dict = mat_dict

    def _mat_idx(self, key):
        if key not in self.mat_index:
            self.mat_index[key] = len(self.mat_list)
            self.mat_list.append(self.mat_dict[key])
        return self.mat_index[key]

    def _box_uv(self, faces, scale=2.2):
        for f in faces:
            if not f.is_valid:
                continue
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

    def _finish_faces(self, faces, mat_key, smooth=True, uv_scale=2.2):
        m_idx = self._mat_idx(mat_key)
        valid = [f for f in faces if f.is_valid]
        for f in valid:
            f.smooth = smooth
            f.material_index = m_idx
        self._box_uv(valid, scale=uv_scale)
        return valid

    def box(self, center_gltf, size_gltf, mat_key, bevel=0.005, segs=2, rot_gltf=(0, 0, 0)):
        """Create a cleanly beveled box using Three.js local coordinates & dimensions."""
        ret = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = ret['verts']
        sx, sy, sz = gsize(*size_gltf)
        c = g2b(*center_gltf)
        # Convert Three.js Euler (rx, ry, rz) to Blender rotation roughly via axis remap (x->x, y->z, z->-y)
        m_scale = Matrix.Diagonal((sx, sy, sz, 1.0))
        m_rot = Euler((rot_gltf[0], -rot_gltf[2], rot_gltf[1]), 'XYZ').to_matrix().to_4x4()
        m_loc = Matrix.Translation(c)
        bmesh.ops.transform(self.bm, matrix=m_loc @ m_rot @ m_scale, verts=verts)

        if bevel > 0.0:
            max_b = min(sx, sy, sz) * 0.36
            b_amt = min(bevel, max_b)
            edges = list({e for v in verts for e in v.link_edges})
            bev = bmesh.ops.bevel(
                self.bm, geom=edges, offset=b_amt, offset_type='OFFSET',
                segments=segs, profile=0.5, affect='EDGES', clamp_overlap=True
            )
            all_v = [v for v in (set(verts) | set(bev.get('verts', []))) if v.is_valid]
            faces = list({f for v in all_v for f in v.link_faces if f.is_valid} | {f for f in bev.get('faces', []) if f.is_valid})
        else:
            faces = list({f for v in verts if v.is_valid for f in v.link_faces if f.is_valid})
        return self._finish_faces(faces, mat_key, smooth=True)

    def cyl(self, center_gltf, r_bottom, r_top, height, mat_key, segs=18, axis='y', rot_gltf=(0, 0, 0), bevel_caps=0.0):
        """
        Create a smooth cylinder aligned along Three.js axis ('x', 'y', or 'z').
        Note: Blender create_cone aligns along Blender Z (= Three.js Y!).
        """
        ret = bmesh.ops.create_cone(
            self.bm, cap_ends=True, cap_tris=False, segments=segs,
            radius1=r_bottom, radius2=r_top, depth=height
        )
        verts = ret['verts']
        if axis == 'x':
            m_axis = Euler((0.0, math.pi / 2.0, 0.0), 'XYZ').to_matrix().to_4x4()
        elif axis == 'z':
            m_axis = Euler((math.pi / 2.0, 0.0, 0.0), 'XYZ').to_matrix().to_4x4()
        else:
            m_axis = Matrix.Identity(4)

        m_rot = Euler((rot_gltf[0], -rot_gltf[2], rot_gltf[1]), 'XYZ').to_matrix().to_4x4()
        m_loc = Matrix.Translation(g2b(*center_gltf))
        bmesh.ops.transform(self.bm, matrix=m_loc @ m_rot @ m_axis, verts=verts)

        if bevel_caps > 0.0:
            cap_edges = [e for v in verts for e in v.link_edges if len(e.link_faces) == 2 and abs(e.link_faces[0].normal.dot(e.link_faces[1].normal)) < 0.5]
            if cap_edges:
                bev = bmesh.ops.bevel(
                    self.bm, geom=list(set(cap_edges)), offset=bevel_caps, offset_type='OFFSET',
                    segments=2, profile=0.5, affect='EDGES', clamp_overlap=True
                )
                all_v = [v for v in (set(verts) | set(bev.get('verts', []))) if v.is_valid]
                faces = list({f for v in all_v for f in v.link_faces if f.is_valid} | {f for f in bev.get('faces', []) if f.is_valid})
                return self._finish_faces(faces, mat_key, smooth=True)

        faces = list({f for v in verts if v.is_valid for f in v.link_faces if f.is_valid})
        return self._finish_faces(faces, mat_key, smooth=True)

    def sphere(self, center_gltf, radii_gltf, mat_key, u_segs=16, v_segs=10):
        ret = bmesh.ops.create_uvsphere(self.bm, u_segments=u_segs, v_segments=v_segs, radius=1.0)
        verts = ret['verts']
        rx, ry, rz = gsize(*radii_gltf)
        m = Matrix.Translation(g2b(*center_gltf)) @ Matrix.Diagonal((rx, ry, rz, 1.0))
        bmesh.ops.transform(self.bm, matrix=m, verts=verts)
        faces = list({f for v in verts for f in v.link_faces})
        return self._finish_faces(faces, mat_key, smooth=True)

    def tube_gltf(self, pts_gltf, radii, mat_key, segs=12, cap_start=True, cap_end=True):
        """Smooth parallel-transport lofted tube from Three.js local coordinates."""
        pts = [g2b(*p) for p in pts_gltf]
        n = len(pts)
        tangents = []
        for i in range(n):
            t = (pts[1] - pts[0]) if i == 0 else ((pts[-1] - pts[-2]) if i == n - 1 else (pts[i + 1] - pts[i - 1]))
            tangents.append(t.normalized())

        ref = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
        binorm = tangents[0].cross(ref).normalized()
        norm = binorm.cross(tangents[0]).normalized()

        bm_rings = []
        for i, pt in enumerate(pts):
            if i > 0:
                rot = tangents[i - 1].rotation_difference(tangents[i])
                norm = (rot @ norm).normalized()
                binorm = tangents[i].cross(norm).normalized()
            rad = radii[i] if isinstance(radii, (list, tuple)) else radii
            rx = rad[0] if isinstance(rad, (tuple, list)) else rad
            ry = rad[1] if isinstance(rad, (tuple, list)) else rad
            ring = []
            for s in range(segs):
                ang = (2.0 * math.pi * s) / segs
                ring.append(self.bm.verts.new(pt + norm * (math.cos(ang) * rx) + binorm * (math.sin(ang) * ry)))
            bm_rings.append(ring)

        faces = []
        for i in range(n - 1):
            for s in range(segs):
                sn = (s + 1) % segs
                try:
                    faces.append(self.bm.faces.new((bm_rings[i][s], bm_rings[i][sn], bm_rings[i + 1][sn], bm_rings[i + 1][s])))
                except ValueError:
                    pass
        if cap_start:
            c = self.bm.verts.new(pts[0])
            for s in range(segs):
                sn = (s + 1) % segs
                try:
                    faces.append(self.bm.faces.new((bm_rings[0][sn], bm_rings[0][s], c)))
                except ValueError:
                    pass
        if cap_end:
            c = self.bm.verts.new(pts[-1])
            for s in range(segs):
                sn = (s + 1) % segs
                try:
                    faces.append(self.bm.faces.new((bm_rings[-1][s], bm_rings[-1][sn], c)))
                except ValueError:
                    pass
        return self._finish_faces(faces, mat_key, smooth=True)

    def handle_u(self, center_gltf, width, depth, mat_key='chrome', r=0.006, horizontal=True):
        """Industrial U-shaped stainless cabinet pull handle pointing along +Z."""
        cx, cy, cz = center_gltf
        hw = width * 0.5
        if horizontal:
            pts = [
                (cx - hw, cy, cz),
                (cx - hw, cy, cz + depth * 0.85),
                (cx - hw * 0.85, cy, cz + depth),
                (cx + hw * 0.85, cy, cz + depth),
                (cx + hw, cy, cz + depth * 0.85),
                (cx + hw, cy, cz),
            ]
        else:
            pts = [
                (cx, cy - hw, cz),
                (cx, cy - hw, cz + depth * 0.85),
                (cx, cy - hw * 0.85, cz + depth),
                (cx, cy + hw * 0.85, cz + depth),
                (cx, cy + hw, cz + depth * 0.85),
                (cx, cy + hw, cz),
            ]
        return self.tube_gltf(pts, r, mat_key, segs=10)

    def finish(self, name, col, parent=None):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        mesh = bpy.data.meshes.new(name + '_Mesh')
        self.bm.to_mesh(mesh)
        self.bm.free()
        for m in self.mat_list:
            mesh.materials.append(m)
        obj = bpy.data.objects.new(name, mesh)
        link_object(obj, col)
        set_smooth_shading(obj)
        if parent is not None:
            obj.parent = parent
        return obj


def _make_empty(name, col, parent=None):
    obj = bpy.data.objects.new(name, None)
    link_object(obj, col)
    if parent is not None:
        obj.parent = parent
    return obj


# ---------------------------------------------------------------------------
# 1. HV PPE Locker (`public/models/ppe-locker.glb`)
#    Matches footprint: width=1.38, height=2.06, depth=0.62, facing +Z
#    Dynamic child nodes: PpeLockerSuit, PpeLockerGloves, PpeLockerBoots
# ---------------------------------------------------------------------------
def build_ppe_locker(mats, col):
    root = _make_empty('PpeLockerRoot', col)
    b = HardSurfaceBuilder(mats)

    # Heavy recessed steel kickplate plinth + leveling pads
    b.box((0, 0.055, -0.02), (1.32, 0.11, 0.56), 'steel_dark', bevel=0.005)
    for fx in (-0.60, 0.60):
        for fz in (-0.24, 0.24):
            b.cyl((fx, 0.012, fz), 0.032, 0.032, 0.024, 'rubber_black', segs=12)

    # Outer marine-teal powder-coated steel cabinet shell (open front recess for clear gear visibility)
    b.box((0, 1.08, -0.27), (1.38, 1.95, 0.07), 'teal_locker', bevel=0.008)      # Back wall
    b.box((-0.655, 1.08, 0.0), (0.07, 1.95, 0.62), 'teal_locker', bevel=0.008)    # Left side wall
    b.box((0.655, 1.08, 0.0), (0.07, 1.95, 0.62), 'teal_locker', bevel=0.008)     # Right side wall
    b.box((0, 2.025, 0.0), (1.38, 0.075, 0.64), 'teal_locker', bevel=0.008)       # Top canopy crown
    b.box((0, 0.135, 0.0), (1.34, 0.055, 0.60), 'teal_locker', bevel=0.006)       # Floor deck inside locker

    # Dark interior backing & central vertical divider separating Suit bay (left) and Glove/Tool bay (right)
    b.box((0, 1.08, -0.225), (1.24, 1.84, 0.02), 'teal_dark', bevel=0.002)
    b.box((0.06, 1.28, 0.0), (0.032, 1.38, 0.52), 'steel_dark', bevel=0.004)      # Upper bay divider

    # Perforated galvanized middle shelf (Y=0.60) & upper hood shelf (Y=1.62)
    b.box((0, 0.60, 0.01), (1.24, 0.036, 0.54), 'steel_light', bevel=0.004)
    b.box((-0.29, 1.58, 0.01), (0.64, 0.032, 0.52), 'steel_light', bevel=0.004)
    b.box((0.36, 1.48, 0.01), (0.56, 0.032, 0.52), 'steel_light', bevel=0.004)
    b.box((0.36, 1.02, 0.01), (0.56, 0.032, 0.52), 'steel_light', bevel=0.004)

    # Chrome coat hanger rod + interior overhead LED light bar
    b.cyl((-0.29, 1.50, 0.06), 0.012, 0.012, 0.62, 'chrome', segs=14, axis='x')
    b.box((0, 1.975, 0.12), (1.06, 0.024, 0.055), 'steel_dark', bevel=0.004)
    b.box((0, 1.960, 0.12), (0.98, 0.012, 0.034), 'led_strip', bevel=0.002)

    # Swing-open framed glass-and-louver marine doors parked ajar at +/-108 deg on side hinges!
    for sx in (-1.0, 1.0):
        # Heavy stainless knuckle hinges (3 per side)
        for hy in (0.34, 1.08, 1.82):
            b.cyl((sx * 0.692, hy, 0.305), 0.012, 0.012, 0.075, 'chrome', segs=12)
        # Side ventilation louvers punched into exterior flanks
        for ly in (1.72, 1.77, 1.82, 1.87, 0.24, 0.29, 0.34):
            b.box((sx * 0.692, ly, 0.0), (0.012, 0.022, 0.36), 'steel_dark', bevel=0.002)
        # Slim vertical front door frame stiles + safety yellow edge warning accent
        b.box((sx * 0.635, 1.08, 0.305), (0.042, 1.92, 0.032), 'steel_mid', bevel=0.005)
        b.box((sx * 0.612, 1.08, 0.322), (0.012, 1.86, 0.008), 'safety_yellow', bevel=0.002)
        # Stainless pull handle + quarter-turn marine latch mounted on front frame cheek
        b.handle_u((sx * 0.635, 1.12, 0.322), 0.14, 0.038, mat_key='chrome', r=0.007, horizontal=False)

    # Pneumatic Class-2 glove air-inflator pump resting permanently on upper right shelf
    b.cyl((0.48, 1.57, 0.06), 0.052, 0.048, 0.14, 'steel_dark', segs=16, bevel_caps=0.005)
    b.cyl((0.48, 1.66, 0.06), 0.056, 0.056, 0.036, 'safety_red', segs=16, bevel_caps=0.004)
    b.box((0.24, 1.54, 0.08), (0.18, 0.09, 0.16), 'safety_yellow', bevel=0.006)  # Arc-flash checklist pouch

    b.finish('PpeLockerCabinet', col, parent=root)

    # Dynamic Node 1: Hanging 40 cal/cm² Arc-Flash Suit Coat + Emerald-Visor Switching Hood
    s_b = HardSurfaceBuilder(mats)
    # Coat hanger hook & bar
    s_b.tube_gltf([(-0.29, 1.50, 0.06), (-0.29, 1.46, 0.06), (-0.48, 1.40, 0.06)], 0.005, 'chrome', segs=8)
    s_b.tube_gltf([(-0.29, 1.46, 0.06), (-0.10, 1.40, 0.06)], 0.005, 'chrome', segs=8)
    # Sculpted hanging khaki Nomex switching parka + reflective bands + hanging sleeves
    s_b.box((-0.29, 1.08, 0.06), (0.44, 0.68, 0.16), 'arc_khaki', bevel=0.032, segs=3)
    s_b.box((-0.29, 1.08, 0.142), (0.065, 0.62, 0.018), 'steel_dark', bevel=0.004)
    for ry in (0.94, 1.24):
        s_b.box((-0.29, ry, 0.06), (0.455, 0.045, 0.172), 'safety_yellow', bevel=0.006)
        s_b.box((-0.29, ry, 0.06), (0.460, 0.018, 0.176), 'chrome', bevel=0.003)
    for ax in (-0.53, -0.05):
        s_b.cyl((ax, 1.08, 0.06), 0.062, 0.068, 0.56, 'arc_khaki', segs=16, bevel_caps=0.010)
    # Sculpted 40 cal/cm² Switching Hood + curved emerald polycarbonate visor on upper shelf (Y=1.60)
    s_b.cyl((-0.29, 1.75, 0.04), 0.155, 0.125, 0.28, 'arc_khaki', segs=22, bevel_caps=0.018)
    s_b.sphere((-0.29, 1.88, 0.04), (0.122, 0.065, 0.122), 'arc_khaki', u_segs=20, v_segs=10)
    s_b.box((-0.29, 1.76, 0.165), (0.21, 0.155, 0.035), 'steel_dark', bevel=0.010)
    s_b.box((-0.29, 1.76, 0.176), (0.185, 0.128, 0.020), 'arc_visor', bevel=0.006)
    s_b.finish('PpeLockerSuit', col, parent=root)

    # Dynamic Node 2: Pair of Sculpted 5-Finger Class 2 HV Dielectric Gauntlets on Middle Right Shelf
    g_b = HardSurfaceBuilder(mats)
    for gx in (0.24, 0.46):
        # Flared orange dielectric rubber gauntlet cuff
        g_b.cyl((gx, 1.24, 0.10), 0.058, 0.048, 0.22, 'safety_orange', segs=18, bevel_caps=0.006)
        # Cream leather outer protector palm + 5 articulated fingers pointing up/forward
        g_b.box((gx, 1.11, 0.10), (0.095, 0.095, 0.042), 'leather_tan', bevel=0.012, segs=2)
        for fi, (fx_off, flen) in enumerate([(-0.034, 0.068), (-0.012, 0.078), (0.012, 0.074), (0.034, 0.058)]):
            g_b.cyl((gx + fx_off, 1.05 - flen * 0.4, 0.105), 0.0095, 0.0075, flen, 'leather_tan', segs=8, bevel_caps=0.003)
        g_b.cyl((gx - 0.052, 1.09, 0.115), 0.011, 0.0085, 0.054, 'leather_tan', segs=8, rot_gltf=(0, 0, 0.55), bevel_caps=0.003)
        # Chrome hanging clip
        g_b.box((gx, 1.37, 0.08), (0.028, 0.045, 0.024), 'chrome', bevel=0.003)
    g_b.finish('PpeLockerGloves', col, parent=root)

    # Dynamic Node 3: Pair of 20 kV Yellow Dielectric Overboots + Rolled 15 kV Insulating Rubber Mat
    bt_b = HardSurfaceBuilder(mats)
    for bx in (-0.36, -0.14):
        bt_b.box((bx, 0.20, 0.04), (0.125, 0.055, 0.27), 'rubber_black', bevel=0.012)
        bt_b.box((bx, 0.25, 0.05), (0.118, 0.085, 0.25), 'safety_yellow', bevel=0.018)
        bt_b.cyl((bx, 0.36, -0.01), 0.062, 0.066, 0.21, 'safety_yellow', segs=18, bevel_caps=0.008)
    # Rolled ribbed 15 kV switchboard dielectric mat with black strap bands
    bt_b.cyl((0.30, 0.25, 0.05), 0.095, 0.095, 0.52, 'safety_yellow', segs=22, axis='x', bevel_caps=0.008)
    bt_b.cyl((0.30, 0.25, 0.05), 0.045, 0.045, 0.53, 'rubber_black', segs=16, axis='x')
    for sx in (0.15, 0.45):
        bt_b.cyl((sx, 0.25, 0.05), 0.099, 0.099, 0.028, 'rubber_black', segs=22, axis='x')
    bt_b.finish('PpeLockerBoots', col, parent=root)

    return root


# ---------------------------------------------------------------------------
# 2. Permit-to-Work (PTW) & ETO Desk (`public/models/permit-desk.glb`)
#    Matches footprint: width=1.44, height=0.94, depth=0.68, facing +Z
#    Beacon socket aligned with room.js `permitBeacon` at (0, 1.24, -0.18)
# ---------------------------------------------------------------------------
def build_permit_desk(mats, col):
    root = _make_empty('PermitDeskRoot', col)
    b = HardSurfaceBuilder(mats)

    # Welded heavy-duty marine console pedestals (Left 3-drawer stack + Right lockable cabinet + open center kneehole)
    # Left pedestal (X = -0.46)
    b.box((-0.46, 0.46, -0.02), (0.44, 0.84, 0.58), 'steel_dark', bevel=0.007)
    for dy in (0.18, 0.45, 0.72):
        b.box((-0.46, dy, 0.278), (0.39, 0.23, 0.024), 'steel_mid', bevel=0.005)
        b.handle_u((-0.46, dy + 0.03, 0.292), 0.14, 0.028, mat_key='chrome', r=0.0055, horizontal=True)
        b.box((-0.46, dy - 0.04, 0.292), (0.085, 0.042, 0.006), 'white_enamel', bevel=0.001)  # Label card
    b.cyl((-0.30, 0.81, 0.294), 0.011, 0.011, 0.012, 'brass', segs=12, axis='z')  # Cylinder lock

    # Right lockable cabinet pedestal (X = +0.46)
    b.box((0.46, 0.46, -0.02), (0.44, 0.84, 0.58), 'steel_dark', bevel=0.007)
    b.box((0.46, 0.46, 0.278), (0.39, 0.77, 0.024), 'steel_mid', bevel=0.005)
    b.handle_u((0.32, 0.56, 0.292), 0.14, 0.028, mat_key='chrome', r=0.0055, horizontal=False)
    for ly in (0.20, 0.25, 0.30, 0.35):
        b.box((0.46, ly, 0.294), (0.26, 0.018, 0.008), 'steel_dark', bevel=0.002)

    # Rear modesty steel panel + footrest rail + leveling feet
    b.box((0, 0.50, -0.27), (0.56, 0.74, 0.04), 'steel_dark', bevel=0.004)
    b.cyl((0, 0.14, -0.04), 0.016, 0.016, 0.56, 'chrome', segs=12, axis='x')
    for fx in (-0.64, -0.28, 0.28, 0.64):
        for fz in (-0.26, 0.22):
            b.cyl((fx, 0.022, fz), 0.026, 0.022, 0.044, 'rubber_black', segs=12)

    # Thick beveled Laminated Marine Hardwood Countertop (Y = 0.91..0.96) + Rear Cable Rail + Rubber Bumper Trim
    b.box((0, 0.925, 0.0), (1.44, 0.056, 0.68), 'wood_top', bevel=0.008, segs=3)
    b.box((0, 0.925, 0.342), (1.44, 0.052, 0.014), 'rubber_black', bevel=0.004)  # Front anti-bump edge
    b.box((0, 0.985, -0.325), (1.44, 0.072, 0.026), 'steel_dark', bevel=0.004)   # Rear sea-rail lip (keeps binders from sliding at sea!)
    for sx in (-0.708, 0.708):
        b.box((sx, 0.978, -0.01), (0.024, 0.058, 0.66), 'steel_dark', bevel=0.004)

    # Red PTW Master Logbook Ring-Binder (left-center) with cream pages & steel spine clip
    b.box((-0.26, 0.968, 0.04), (0.31, 0.026, 0.37), 'safety_red', bevel=0.004, rot_gltf=(0, 0.08, 0))
    b.box((-0.255, 0.982, 0.04), (0.285, 0.018, 0.345), 'paper_white', bevel=0.002, rot_gltf=(0, 0.08, 0))
    b.box((-0.26, 0.992, 0.04), (0.31, 0.008, 0.37), 'safety_red', bevel=0.003, rot_gltf=(0, 0.08, 0))
    b.box((-0.26, 0.999, -0.06), (0.18, 0.004, 0.055), 'white_enamel', bevel=0.001, rot_gltf=(0, 0.08, 0))

    # Yellow Sanction-for-Test (SFT) Clipboard & Permit Stack (right-center)
    b.box((0.26, 0.966, 0.04), (0.27, 0.014, 0.35), 'safety_yellow', bevel=0.003, rot_gltf=(0, -0.11, 0))
    b.box((0.26, 0.978, 0.045), (0.24, 0.012, 0.31), 'paper_white', bevel=0.001, rot_gltf=(0, -0.11, 0))
    b.box((0.275, 0.992, -0.105), (0.105, 0.018, 0.036), 'chrome', bevel=0.004, rot_gltf=(0, -0.11, 0))
    # Pen resting diagonally across SFT folder
    b.cyl((0.24, 0.992, 0.10), 0.005, 0.005, 0.15, 'steel_dark', segs=10, axis='x', rot_gltf=(0, 0.42, 0))

    # Marine Engine-Room Intercom / Desk Phone (far left)
    b.box((-0.56, 0.995, -0.12), (0.16, 0.085, 0.21), 'steel_dark', bevel=0.012, rot_gltf=(0, 0.22, 0))
    b.cyl((-0.58, 1.055, -0.12), 0.022, 0.022, 0.19, 'rubber_black', segs=14, axis='z', rot_gltf=(0, 0.22, 0))
    b.box((-0.53, 1.042, -0.09), (0.065, 0.014, 0.085), 'steel_light', bevel=0.003, rot_gltf=(0.24, 0.22, 0))

    # Pen cup + Brass safety stamp + Coffee Mug (far right)
    b.cyl((0.56, 1.005, -0.14), 0.038, 0.040, 0.10, 'steel_mid', segs=16, bevel_caps=0.004)
    b.cyl((0.55, 1.055, -0.14), 0.005, 0.005, 0.13, 'safety_red', segs=8, rot_gltf=(0.15, 0, 0.12))
    b.cyl((0.57, 1.055, -0.13), 0.005, 0.005, 0.14, 'safety_yellow', segs=8, rot_gltf=(-0.12, 0, -0.14))
    b.cyl((0.57, 1.005, 0.10), 0.040, 0.042, 0.095, 'teal_locker', segs=18, bevel_caps=0.004)

    # Industrial Signal Beacon Mast (base + fluted stainless stem + collar right beneath dynamic permitBeacon at (0, 1.24, -0.18))
    b.cyl((0, 0.968, -0.18), 0.068, 0.056, 0.032, 'steel_dark', segs=20, bevel_caps=0.005)
    b.cyl((0, 1.08, -0.18), 0.016, 0.020, 0.21, 'chrome', segs=16)
    b.cyl((0, 1.185, -0.18), 0.048, 0.052, 0.034, 'steel_dark', segs=20, bevel_caps=0.004)
    # Protective stainless wire guard arches around beacon globe
    for ang_deg in (0, 60, 120):
        rad = math.radians(ang_deg)
        ca, sa = math.cos(rad), math.sin(rad)
        pts = [
            (0.056 * ca, 1.195, -0.18 + 0.056 * sa),
            (0.066 * ca, 1.245, -0.18 + 0.066 * sa),
            (0.044 * ca, 1.298, -0.18 + 0.044 * sa),
            (0.0, 1.312, -0.18),
            (-0.044 * ca, 1.298, -0.18 - 0.044 * sa),
            (-0.066 * ca, 1.245, -0.18 - 0.066 * sa),
            (-0.056 * ca, 1.195, -0.18 - 0.056 * sa),
        ]
        b.tube_gltf(pts, 0.0038, 'chrome', segs=6)

    b.finish('PermitDeskAssembly', col, parent=root)
    return root


# ---------------------------------------------------------------------------
# 3. Proving Unit & 5 kV Megger Bench (`public/models/test-bench.glb`)
#    Matches footprint: width=1.58, height=0.90, depth=0.68, facing +Z
#    Proving unit aligned with dynamic `provingLed` at (-0.42, 1.17, 0.11)
# ---------------------------------------------------------------------------
def build_test_bench(mats, col):
    root = _make_empty('TestBenchRoot', col)
    b = HardSurfaceBuilder(mats)

    # Welded tubular steel workbench frame with bolted floor flanges & cross stretchers
    for lx in (-0.70, 0.70):
        for lz in (-0.26, 0.26):
            b.box((lx, 0.44, lz), (0.056, 0.86, 0.056), 'steel_dark', bevel=0.006)
            b.box((lx, 0.012, lz), (0.095, 0.022, 0.095), 'steel_mid', bevel=0.004)  # Deck bolt flange
        b.box((lx, 0.22, 0), (0.042, 0.042, 0.52), 'steel_dark', bevel=0.004)        # Side stretcher
        b.box((lx, 0.84, 0), (0.042, 0.048, 0.52), 'steel_dark', bevel=0.004)        # Upper apron
    b.box((0, 0.22, -0.26), (1.40, 0.042, 0.042), 'steel_dark', bevel=0.004)
    b.box((0, 0.84, 0.26), (1.40, 0.048, 0.042), 'steel_dark', bevel=0.004)
    b.box((0, 0.84, -0.26), (1.40, 0.048, 0.042), 'steel_dark', bevel=0.004)

    # Lower Galvanized Storage Shelf (Y=0.25) with Pelican carry case & coiled HV lead reel
    b.box((0, 0.25, 0), (1.36, 0.032, 0.50), 'steel_light', bevel=0.004)
    b.box((-0.34, 0.36, 0.0), (0.44, 0.18, 0.34), 'steel_dark', bevel=0.012)        # Hard instrument transport case
    for rx in (-0.48, -0.20):
        b.box((rx, 0.36, 0.175), (0.036, 0.065, 0.014), 'safety_yellow', bevel=0.003)  # Case latches
    b.cyl((0.32, 0.31, 0.0), 0.135, 0.135, 0.085, 'rubber_black', segs=22, bevel_caps=0.006)  # Coiled test lead drum
    b.cyl((0.32, 0.31, 0.0), 0.06, 0.06, 0.092, 'safety_red', segs=16)

    # Heavy Beveled Benchtop (Y = 0.895..0.94) + Green Anti-Static ESD Mat + Rear Power Strip Riser
    b.box((0, 0.90, 0), (1.58, 0.064, 0.68), 'steel_mid', bevel=0.007, segs=2)
    b.box((0, 0.938, 0.02), (1.44, 0.014, 0.54), 'esd_green', bevel=0.004)
    b.box((0, 0.995, -0.31), (1.54, 0.12, 0.048), 'steel_dark', bevel=0.005)        # Rear power distribution rail
    for sx in (-0.52, -0.38, 0.38, 0.52):
        b.box((sx, 1.00, -0.282), (0.068, 0.068, 0.014), 'white_enamel', bevel=0.003)  # Marine Schuko sockets

    # 1. 6.6 kV High-Voltage Proving Unit at (-0.42, 0.945..1.16, 0.04)
    b.box((-0.42, 1.052, 0.04), (0.31, 0.21, 0.22), 'steel_dark', bevel=0.014, segs=3)
    # Protective yellow elastomer corner shock bumpers
    for bx in (-0.568, -0.272):
        b.box((bx, 1.052, 0.04), (0.028, 0.222, 0.232), 'safety_yellow', bevel=0.008)
    # Recessed brushed-steel faceplate + twin ceramic HV proving sockets + rotary range knob + brass handle
    b.box((-0.42, 1.052, 0.152), (0.25, 0.165, 0.012), 'steel_light', bevel=0.003)
    for px in (-0.48, -0.36):
        b.cyl((px, 1.075, 0.164), 0.020, 0.016, 0.028, 'ceramic_white', segs=16, axis='z', bevel_caps=0.003)
        b.cyl((px, 1.075, 0.172), 0.008, 0.008, 0.020, 'brass', segs=12, axis='z')
    b.cyl((-0.42, 1.005, 0.166), 0.022, 0.018, 0.022, 'rubber_black', segs=16, axis='z', bevel_caps=0.003)
    b.handle_u((-0.42, 1.16, 0.04), 0.16, 0.036, mat_key='chrome', r=0.006, horizontal=True)
    # Bezel mount collar for dynamic provingLed at (-0.42, 1.17, 0.11)
    b.cyl((-0.42, 1.162, 0.11), 0.026, 0.022, 0.016, 'steel_light', segs=14)

    # 2. Ruggedized 5 kV Digital Megger / Polarization Index (PI) Insulation Tester at (0.44, 0.945..1.18, -0.02)
    b.box((0.44, 1.06, -0.02), (0.39, 0.225, 0.30), 'safety_yellow', bevel=0.016, segs=3)
    # Molded black rubber corner shock bumpers + heavy lid latches
    for bx in (0.252, 0.628):
        for bz in (-0.162, 0.122):
            b.box((bx, 1.06, bz), (0.036, 0.236, 0.036), 'rubber_black', bevel=0.008)
    # Recessed dark control console deck (angled slightly toward operator on top + front LCD face)
    b.box((0.44, 1.176, -0.02), (0.34, 0.018, 0.25), 'steel_dark', bevel=0.004)
    # Front backlit digital PI/Megger LCD display bezel + screen
    b.box((0.44, 1.088, 0.132), (0.26, 0.135, 0.016), 'steel_dark', bevel=0.004)
    b.box((0.44, 1.092, 0.141), (0.22, 0.102, 0.008), 'lcd_green', bevel=0.002)
    # Top rotary voltage selector dial (500V / 1kV / 2.5kV / 5kV) + tactile buttons
    b.cyl((0.36, 1.196, 0.01), 0.034, 0.028, 0.026, 'rubber_black', segs=18, bevel_caps=0.004)
    b.box((0.36, 1.211, 0.01), (0.008, 0.008, 0.048), 'white_enamel', bevel=0.001)
    for bi, (bx, bmat) in enumerate([(0.49, 'safety_red'), (0.55, 'safety_green'), (0.49, 'steel_light'), (0.55, 'steel_light')]):
        bz = -0.04 if bi < 2 else 0.025
        b.cyl((bx, 1.192, bz), 0.014, 0.013, 0.016, bmat, segs=12, bevel_caps=0.002)
    # 3 Shrouded 5 kV HV Banana Terminals (LINE Red / GUARD Blue / EARTH Black) + Coiled Insulated Leads
    for tx, tmat in ((0.33, 'safety_red'), (0.44, 'cable_blue'), (0.55, 'rubber_black')):
        b.cyl((tx, 1.196, -0.095), 0.016, 0.014, 0.028, tmat, segs=14, bevel_caps=0.003)
        b.cyl((tx, 1.212, -0.095), 0.006, 0.006, 0.010, 'brass', segs=10)
    # Coiled red HV test lead draped cleanly onto the ESD mat beside the Megger
    b.tube_gltf([
        (0.33, 1.20, -0.095), (0.28, 1.18, -0.16), (0.20, 0.99, -0.14),
        (0.14, 0.955, -0.05), (0.16, 0.955, 0.04), (0.08, 0.955, 0.06),
    ], 0.0065, 'safety_red', segs=10)
    b.tube_gltf([
        (0.55, 1.20, -0.095), (0.62, 1.16, -0.15), (0.68, 0.97, -0.08),
        (0.67, 0.955, 0.06), (0.62, 0.955, 0.14),
    ], 0.0065, 'rubber_black', segs=10)

    # 3. 6.6 kV Capacitive HV Proving Wand resting in twin rubber V-cradles at bench front
    for cx in (-0.28, 0.24):
        b.box((cx, 0.962, 0.20), (0.042, 0.042, 0.058), 'rubber_black', bevel=0.005)
    b.cyl((-0.02, 0.985, 0.20), 0.016, 0.013, 0.72, 'safety_yellow', segs=16, axis='x', bevel_caps=0.003)
    b.cyl((-0.34, 0.985, 0.20), 0.021, 0.021, 0.20, 'rubber_black', segs=16, axis='x', bevel_caps=0.004)  # Knurled grip
    b.cyl((-0.23, 0.985, 0.20), 0.036, 0.036, 0.016, 'safety_red', segs=18, axis='x', bevel_caps=0.003)    # Hand-guard disc
    b.cyl((0.36, 0.985, 0.20), 0.024, 0.020, 0.075, 'steel_dark', segs=16, axis='x', bevel_caps=0.003)     # Sensor head
    b.cyl((0.43, 0.985, 0.20), 0.007, 0.004, 0.095, 'chrome', segs=12, axis='x')                           # Contact probe tip

    b.finish('TestBenchAssembly', col, parent=root)
    return root


# ---------------------------------------------------------------------------
# 4. LOTO Key Box & Tool Board (`public/models/key-board.glb`)
#    Matches footprint: width=1.58, height=1.98, depth=0.68, facing +Z
#    Aligned with dynamic `keyBoxLed` at (-0.38, 1.22, 0.14)
# ---------------------------------------------------------------------------
def build_key_board(mats, col):
    root = _make_empty('KeyBoardRoot', col)
    b = HardSurfaceBuilder(mats)

    # Heavy welded tubular steel bench frame + lower steel shelf + bolted deck flanges
    for lx in (-0.70, 0.70):
        for lz in (-0.26, 0.26):
            b.box((lx, 0.44, lz), (0.056, 0.86, 0.056), 'steel_dark', bevel=0.006)
            b.box((lx, 0.012, lz), (0.095, 0.022, 0.095), 'steel_mid', bevel=0.004)
        b.box((lx, 0.22, 0), (0.042, 0.042, 0.52), 'steel_dark', bevel=0.004)
    b.box((0, 0.22, -0.26), (1.40, 0.042, 0.042), 'steel_dark', bevel=0.004)
    b.box((0, 0.25, 0), (1.36, 0.032, 0.50), 'steel_light', bevel=0.004)
    # Lockout tag & hasp organizer bin on lower shelf
    b.box((0.28, 0.34, 0.0), (0.42, 0.14, 0.30), 'safety_yellow', bevel=0.008)
    b.box((-0.36, 0.33, 0.0), (0.36, 0.12, 0.26), 'safety_red', bevel=0.008)

    # Beveled steel benchtop + green rubber mat pad
    b.box((0, 0.90, 0), (1.58, 0.068, 0.68), 'steel_mid', bevel=0.007, segs=2)
    b.box((0, 0.938, 0.03), (1.42, 0.012, 0.52), 'rubber_black', bevel=0.004)

    # Framed Heavy Steel Tool Pegboard rising behind bench (Y = 0.94..2.02, Z = -0.28)
    b.box((0, 1.48, -0.295), (1.54, 1.08, 0.044), 'steel_dark', bevel=0.006)
    # C-channel brushed steel perimeter trim frame
    b.box((0, 2.01, -0.272), (1.56, 0.042, 0.056), 'steel_light', bevel=0.005)
    b.box((0, 0.955, -0.272), (1.56, 0.042, 0.056), 'steel_light', bevel=0.005)
    for sx in (-0.76, 0.76):
        b.box((sx, 1.48, -0.272), (0.042, 1.09, 0.056), 'steel_light', bevel=0.005)

    # 1. Group LOTO Red Steel Key Lockbox at (-0.38, 0.94..1.20, 0.06)
    b.box((-0.38, 1.07, 0.06), (0.36, 0.25, 0.24), 'safety_red', bevel=0.012, segs=3)
    # Recessed viewing window frame on front face + acrylic glass + internal brass key rack bar
    b.box((-0.38, 1.08, 0.180), (0.24, 0.13, 0.014), 'steel_dark', bevel=0.003)
    b.box((-0.38, 1.08, 0.186), (0.21, 0.105, 0.006), 'glass_clear', bevel=0.001)
    # Top carrying handle + multi-padlock clasp rail along front lid lip
    b.handle_u((-0.38, 1.20, 0.03), 0.14, 0.032, mat_key='chrome', r=0.006, horizontal=True)
    b.box((-0.38, 1.185, 0.185), (0.32, 0.022, 0.024), 'chrome', bevel=0.003)
    # Status beacon collar aligned with room.js `keyBoxLed` at (-0.38, 1.22, 0.14)
    b.cyl((-0.38, 1.202, 0.14), 0.024, 0.020, 0.018, 'steel_dark', segs=14)

    # 2. Shadow-Board Row of 6 LOTO Padlocks + Brass Castell Keys + Danger Tags on Pegboard
    for i in range(6):
        px = -0.58 + i * 0.125
        # Peg hook
        b.cyl((px, 1.84, -0.245), 0.005, 0.005, 0.06, 'chrome', segs=8, axis='z')
        # Padlock shackle + body
        pmat = 'safety_red' if i < 4 else 'safety_yellow'
        b.tube_gltf([
            (px - 0.014, 1.815, -0.228), (px - 0.014, 1.855, -0.228),
            (px, 1.868, -0.228), (px + 0.014, 1.855, -0.228), (px + 0.014, 1.815, -0.228)
        ], 0.0042, 'chrome', segs=8)
        b.box((px, 1.785, -0.228), (0.046, 0.056, 0.022), pmat, bevel=0.005)
        # Hanging brass Castell trapped key below
        b.cyl((px, 1.62, -0.245), 0.005, 0.005, 0.055, 'chrome', segs=8, axis='z')
        b.cyl((px, 1.59, -0.226), 0.018, 0.018, 0.008, 'brass', segs=14, axis='z')
        b.box((px, 1.545, -0.226), (0.012, 0.062, 0.008), 'brass', bevel=0.002)

    # 3. Wall-Mounted VCB Racking Crank Handle (right half of pegboard)
    b.cyl((0.36, 1.44, -0.225), 0.013, 0.013, 0.48, 'chrome', segs=14)                    # Main hex shaft
    b.cyl((0.36, 1.20, -0.225), 0.022, 0.022, 0.055, 'steel_dark', segs=6)                # Hex drive socket
    b.box((0.44, 1.67, -0.225), (0.17, 0.026, 0.022), 'chrome', bevel=0.005)              # Crank arm
    b.cyl((0.52, 1.67, -0.165), 0.016, 0.016, 0.11, 'rubber_black', segs=14, axis='z', bevel_caps=0.004)  # Grip
    # Twin horizontal wall brackets + Fiberglass Earth / Proving Stick
    for bx in (-0.18, 0.48):
        b.box((bx, 1.76, -0.245), (0.026, 0.048, 0.075), 'steel_light', bevel=0.004)
    b.cyl((0.18, 1.76, -0.215), 0.016, 0.016, 1.04, 'safety_yellow', segs=16, axis='x', bevel_caps=0.003)
    b.cyl((-0.26, 1.76, -0.215), 0.022, 0.022, 0.16, 'rubber_black', segs=14, axis='x')
    b.cyl((0.72, 1.76, -0.215), 0.012, 0.008, 0.08, 'copper', segs=12, axis='x')          # Earth clamp jaw tip

    # Lockout danger tags tray on benchtop right
    b.box((0.34, 0.968, 0.05), (0.32, 0.045, 0.24), 'steel_dark', bevel=0.006)
    for tx in (0.24, 0.34, 0.44):
        b.box((tx, 0.995, 0.05), (0.072, 0.012, 0.145), 'white_enamel', bevel=0.002)
        b.box((tx, 1.003, 0.01), (0.068, 0.004, 0.042), 'safety_red', bevel=0.001)

    b.finish('KeyBoardAssembly', col, parent=root)
    return root


# ---------------------------------------------------------------------------
# 5. VCB Diagnostic Workbench (`public/models/vcb-workbench.glb`)
#    Matches footprint: width=1.52, height=1.92, depth=0.68, facing +Z
#    Keeps tabletop center (0, 0.946, 0.04) open for `workbench-tools.glb`!
# ---------------------------------------------------------------------------
def build_vcb_workbench(mats, col):
    root = _make_empty('VcbWorkbenchRoot', col)
    b = HardSurfaceBuilder(mats)

    # Heavy welded tubular maintenance frame with bolted footplates
    for lx in (-0.68, 0.68):
        for lz in (-0.27, 0.27):
            b.box((lx, 0.44, lz), (0.058, 0.86, 0.058), 'steel_dark', bevel=0.006)
            b.box((lx, 0.012, lz), (0.098, 0.022, 0.098), 'steel_mid', bevel=0.004)
        b.box((lx, 0.22, 0), (0.044, 0.044, 0.54), 'steel_dark', bevel=0.004)
    b.box((0, 0.22, -0.27), (1.36, 0.044, 0.044), 'steel_dark', bevel=0.004)

    # Red Heavy-Duty Under-Bench 3-Drawer Mechanic's Tool Chest (tucked under left half)
    b.box((-0.34, 0.56, 0.0), (0.58, 0.58, 0.52), 'safety_red', bevel=0.008)
    for dy in (0.37, 0.56, 0.75):
        b.box((-0.34, dy, 0.268), (0.52, 0.16, 0.022), 'safety_red', bevel=0.005)
        b.box((-0.34, dy + 0.045, 0.284), (0.44, 0.022, 0.016), 'chrome', bevel=0.003)   # Full-width chrome drawer pull

    # Lower Galvanized Steel Shelf (right half + full base) with spare VCB tulip/insulator crate
    b.box((0, 0.25, 0.0), (1.34, 0.032, 0.52), 'steel_light', bevel=0.004)
    b.box((0.32, 0.38, 0.0), (0.46, 0.22, 0.36), 'steel_mid', bevel=0.010)
    b.cyl((0.24, 0.51, 0.0), 0.048, 0.048, 0.08, 'copper', segs=16, bevel_caps=0.005)
    b.cyl((0.40, 0.51, 0.0), 0.048, 0.048, 0.08, 'ceramic_white', segs=16, bevel_caps=0.005)

    # Heavy Beveled Steel Benchtop (Y = 0.895..0.935) + Framed Green Phenolic ESD Mat (Y = 0.942)
    b.box((0, 0.90, 0), (1.52, 0.068, 0.68), 'steel_mid', bevel=0.007, segs=2)
    b.box((0, 0.938, 0.02), (1.36, 0.014, 0.54), 'esd_green', bevel=0.004)
    # ESD wrist-strap grounding button + coiled cord on far-right edge (clear of tools)
    b.cyl((0.64, 0.948, 0.24), 0.014, 0.014, 0.010, 'brass', segs=12)
    b.tube_gltf([(0.64, 0.950, 0.24), (0.68, 0.950, 0.26), (0.71, 0.89, 0.26)], 0.004, 'safety_yellow', segs=8)

    # Framed Steel Perforated Backboard (Y = 0.94..1.90, Z = -0.30) + Overhead Task Light Canopy
    b.box((0, 1.42, -0.305), (1.48, 0.94, 0.042), 'steel_dark', bevel=0.006)
    for sx in (-0.73, 0.73):
        b.box((sx, 1.44, -0.28), (0.042, 0.98, 0.056), 'steel_light', bevel=0.005)
    b.box((0, 1.90, -0.20), (1.50, 0.046, 0.24), 'steel_mid', bevel=0.006)                # Overhead LED hood overhang
    b.box((0, 1.872, -0.15), (1.28, 0.014, 0.065), 'led_strip', bevel=0.002)              # Warm workbench task LED bar

    # Hanging Diagnostic Tools on Pegboard (digital vernier caliper + 4 open-end wrenches + small parts bins)
    for i in range(4):
        wx = -0.52 + i * 0.11
        wlen = 0.24 - i * 0.025
        b.box((wx, 1.52, -0.268), (0.022, wlen, 0.009), 'chrome', bevel=0.003)
        b.cyl((wx, 1.52 + wlen * 0.5, -0.268), 0.020, 0.020, 0.012, 'chrome', segs=12, axis='z')
        b.cyl((wx, 1.52 - wlen * 0.5, -0.268), 0.018, 0.018, 0.012, 'chrome', segs=12, axis='z')
    # Row of 5 wall-mounted blue/red/yellow small-parts fastener bins along lower backboard
    for i, bmat in enumerate(('safety_red', 'safety_yellow', 'teal_locker', 'safety_yellow', 'safety_red')):
        bx = -0.52 + i * 0.26
        b.box((bx, 1.14, -0.22), (0.20, 0.11, 0.13), bmat, bevel=0.006)

    b.finish('VcbWorkbenchAssembly', col, parent=root)
    return root


# ---------------------------------------------------------------------------
# 6. Marine Switchroom Architecture & Industrial Detailing (`public/models/room-architecture.glb`)
#    World-origin assembly (0, 0, 0) complementing walls/deck/trays in `room.js`
# ---------------------------------------------------------------------------
def build_room_architecture(mats, col):
    root = _make_empty('RoomArchitectureRoot', col)
    b = HardSurfaceBuilder(mats)

    H = 3.45

    # 1. Coved Heavy Rubber / Steel Bulkhead Baseboard Kickplates around room perimeter
    b.box((-5.11, 0.055, 2.0), (0.055, 0.11, 9.55), 'steel_dark', bevel=0.008)    # Port baseboard
    b.box((5.11, 0.055, 2.0), (0.055, 0.11, 9.55), 'steel_dark', bevel=0.008)     # Starboard baseboard
    b.box((0.0, 0.055, -2.71), (10.22, 0.11, 0.055), 'steel_dark', bevel=0.008)   # Forward baseboard
    # Aft baseboard split cleanly around watertight door opening (X in [-0.72..0.72])
    b.box((-2.95, 0.055, 6.71), (4.42, 0.11, 0.055), 'steel_dark', bevel=0.008)
    b.box((2.95, 0.055, 6.71), (4.42, 0.11, 0.055), 'steel_dark', bevel=0.008)

    # 2. Structural Marine Steel Beam Gusset Knees (bolted flanges at Port & Starboard deckhead)
    for bz in (-2.1, -0.3, 1.5, 3.5, 5.5):
        for sx in (-1.0, 1.0):
            # Angled steel knee bracket under beam ends
            b.box((sx * 4.96, H - 0.24, bz), (0.34, 0.24, 0.09), 'steel_mid', bevel=0.006)
            b.box((sx * 5.10, H - 0.30, bz), (0.04, 0.38, 0.16), 'steel_dark', bevel=0.004)
            # Flanged corner bolt bosses
            for by_off in (-0.12, 0.10):
                b.cyl((sx * 5.07, H - 0.30 + by_off, bz), 0.012, 0.012, 0.025, 'chrome', segs=6, axis='x')

    # 3. Overhead Industrial Vapor-Tight Marine LED Luminaires (9 fixtures with cast housings & clips)
    for lx in (-3.1, 0.0, 3.1):
        for lz in (-1.75, 1.45, 4.45):
            # Cast aluminum luminaire housing with beveled chamfer + hanging rods
            b.box((lx, H - 0.165, lz), (1.58, 0.068, 0.21), 'steel_dark', bevel=0.010)
            b.box((lx, H - 0.205, lz), (1.48, 0.026, 0.135), 'led_strip', bevel=0.006)
            for hx in (-0.62, 0.62):
                b.cyl((lx + hx, H - 0.075, lz), 0.010, 0.010, 0.15, 'steel_light', segs=8)
                # Stainless diffuser retaining clips
                for cz in (-0.095, 0.095):
                    b.box((lx + hx * 0.65, H - 0.19, lz + cz), (0.026, 0.042, 0.014), 'chrome', bevel=0.002)

    # 4. Marine Industrial Bulkhead Piping & Electrical Conduit Runs (Upper Port, Starboard & Forward Bulkheads)
    # Red CO2 Fire-Suppression Header Pipe + Grey Compressed Instrument-Air Pipe along Port & Starboard walls (Y = 2.74 & 2.92)
    for sx in (-1.0, 1.0):
        px = sx * 5.05
        b.cyl((px, 2.92, 2.0), 0.032, 0.032, 9.20, 'safety_red', segs=14, axis='z')
        b.cyl((px, 2.76, 2.0), 0.024, 0.024, 9.20, 'pipe_grey', segs=14, axis='z')
        # Bolted pipe flange unions & steel wall-saddle clamps every 2.0 m
        for pz in (-2.0, 0.0, 2.0, 4.0, 6.0):
            b.cyl((px, 2.92, pz), 0.052, 0.052, 0.026, 'steel_dark', segs=14, axis='z', bevel_caps=0.003)
            b.cyl((px, 2.76, pz), 0.042, 0.042, 0.022, 'steel_mid', segs=14, axis='z', bevel_caps=0.003)
            b.box((sx * 5.09, 2.84, pz), (0.08, 0.26, 0.035), 'steel_dark', bevel=0.003)
        # Drop conduit & sealed marine junction box near forward & aft corners
        for jz in (-2.25, 5.15):
            b.box((sx * 5.06, 1.85, jz), (0.11, 0.26, 0.22), 'steel_mid', bevel=0.008)
            b.box((sx * 5.00, 1.85, jz), (0.018, 0.22, 0.18), 'steel_light', bevel=0.004)
            b.cyl((sx * 5.07, 2.38, jz), 0.014, 0.014, 0.80, 'steel_light', segs=10)
            b.cyl((sx * 5.07, 1.70, jz - 0.05), 0.012, 0.012, 0.032, 'brass', segs=10)  # Cable gland
            b.cyl((sx * 5.07, 1.70, jz + 0.05), 0.012, 0.012, 0.032, 'brass', segs=10)

    # Corner Pressure Gauge & Isolation Handwheel on Starboard CO2 Header (near aft entry)
    b.cyl((4.98, 2.92, 5.45), 0.048, 0.048, 0.028, 'brass', segs=16, axis='x')
    b.cyl((4.96, 2.92, 5.45), 0.038, 0.038, 0.010, 'white_enamel', segs=16, axis='x')

    # 5. Detailed Bulkhead First-Aid Cabinet at (1.06, 2.02, 6.70) facing -Z into switchroom
    b.box((1.06, 2.02, 6.66), (0.36, 0.40, 0.14), 'safety_green', bevel=0.010, segs=3)
    b.box((1.06, 2.02, 6.588), (0.32, 0.36, 0.016), 'safety_green', bevel=0.005)
    b.box((1.06, 2.02, 6.578), (0.165, 0.048, 0.008), 'white_enamel', bevel=0.002)
    b.box((1.06, 2.02, 6.578), (0.048, 0.165, 0.008), 'white_enamel', bevel=0.002)
    b.box((0.91, 2.02, 6.582), (0.016, 0.068, 0.018), 'chrome', bevel=0.003)  # Cabinet door latch

    # 6. Heavy Bolted Steel & Yellow-Reflective Trolley Wheel Stops at Park & Maintenance Zones
    # (Matches TROLLEY_PARK_POS=(3.60, -0.35) and MAINTENANCE_ZONE_POS=(-3.45, -1.55) with z - 0.50)
    for wx, wz in ((3.60, -0.85), (-3.45, -2.05)):
        b.box((wx, 0.024, wz), (0.82, 0.046, 0.095), 'rubber_black', bevel=0.012, segs=2)
        for sx_off in (-0.24, 0.0, 0.24):
            b.box((wx + sx_off, 0.047, wz), (0.12, 0.006, 0.072), 'safety_yellow', bevel=0.002)
        for bx_off in (-0.34, 0.34):
            b.cyl((wx + bx_off, 0.048, wz), 0.012, 0.012, 0.014, 'chrome', segs=6)

    b.finish('RoomArchitectureDetails', col, parent=root)
    return root


# ---------------------------------------------------------------------------
# Export Helper (Draco-Compressed glTF 2.0 `.glb` per Asset Collection)
# ---------------------------------------------------------------------------
def export_collection_glb(col_name, out_filename, use_draco=True):
    col = bpy.data.collections[col_name]
    bpy.ops.object.select_all(action='DESELECT')
    total_tris = 0
    for obj in col.all_objects:
        obj.select_set(True)
        if obj.type == 'MESH':
            total_tris += sum(len(p.vertices) - 2 for p in obj.data.polygons)

    out_path = os.path.join(REPO_ROOT, 'public', 'models', out_filename)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials='EXPORT',
        export_draco_mesh_compression_enable=bool(use_draco),
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    size_kb = os.path.getsize(out_path) / 1024.0
    print(f'[build_room_props]   {out_filename}: {total_tris} tris -> {size_kb:.1f} KB (draco={use_draco})')
    return total_tris, size_kb


def main():
    clear_scene()
    tex = build_prop_textures()
    mats = build_materials(tex)

    builders = [
        ('PpeLocker', 'ppe-locker.glb', build_ppe_locker),
        ('PermitDesk', 'permit-desk.glb', build_permit_desk),
        ('TestBench', 'test-bench.glb', build_test_bench),
        ('KeyBoard', 'key-board.glb', build_key_board),
        ('VcbWorkbench', 'vcb-workbench.glb', build_vcb_workbench),
        ('RoomArchitecture', 'room-architecture.glb', build_room_architecture),
    ]

    grand_tris = 0
    for col_name, out_glb, fn in builders:
        col = ensure_collection(col_name)
        fn(mats, col)
        tris, _ = export_collection_glb(col_name, out_glb, use_draco=True)
        grand_tris += tris

    blend_out = os.path.join(REPO_ROOT, 'assets-src', 'blender', 'room_props.blend')
    save_blend(blend_out)
    print(f'[build_room_props] Total room stations + architecture triangles: {grand_tris}')
    print(f'[build_room_props] Saved editable scene: {blend_out}')


if __name__ == '__main__':
    main()
