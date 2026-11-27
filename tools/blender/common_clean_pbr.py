"""
Shared clean non-grainy PBR material library and hard-surface BMesh helpers
for Blender 5.3+ -> Godot 4.7 uncompressed glTF (.glb) asset authoring.
"""

import math
import os
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector


def reset_clean_scene():
    """Reset the active Blender scene safely (compatible with Blender MCP sandbox)."""
    bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    return scene


def ensure_collection(name, parent=None):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        target = parent if parent is not None else bpy.context.scene.collection
        target.children.link(col)
    return col


def make_empty(name, location=(0.0, 0.0, 0.0), col=None, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = 'PLAIN_AXES'
    obj.empty_display_size = 0.08
    obj.location = location
    target = col if col is not None else bpy.context.scene.collection
    target.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def _make_clean_mat(
    name,
    base_color,
    metallic=0.0,
    roughness=0.42,
    coat_weight=0.0,
    coat_roughness=0.14,
    alpha=1.0,
    emission=None,
    emission_strength=0.0,
):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    out.location = (300, 0)
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = (*base_color[:3], 1.0)
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
        bsdf.inputs['Emission Color'].default_value = (*emission[:3], 1.0)
        bsdf.inputs['Emission Strength'].default_value = float(emission_strength)
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat


def build_clean_material_library():
    """Return a dict of clean non-grainy marine PBR materials (no 128px noise normal maps)."""
    specs = {
        'grey_panel':   ('MarineSwitchgearGrey',   (0.70, 0.72, 0.74), 0.0,  0.42, 0.14, 0.16, 1.0, None, 0.0),
        'grey_trim':    ('MarineSwitchgearTrim',   (0.55, 0.58, 0.61), 0.0,  0.40, 0.12, 0.18, 1.0, None, 0.0),
        'slate_skid':   ('MarineSlateSkid',        (0.14, 0.18, 0.22), 0.0,  0.46, 0.10, 0.20, 1.0, None, 0.0),
        'navy_kick':    ('MarineNavyKickplate',    (0.06, 0.12, 0.24), 0.0,  0.44, 0.12, 0.18, 1.0, None, 0.0),
        'teal_cabinet': ('MarineTealCabinet',      (0.05, 0.24, 0.28), 0.0,  0.42, 0.15, 0.16, 1.0, None, 0.0),
        'dark_fascia':  ('DarkCharcoalFascia',     (0.11, 0.13, 0.15), 0.0,  0.48, 0.05, 0.25, 1.0, None, 0.0),
        'yellow':       ('SafetyYellowEnamel',     (0.88, 0.62, 0.04), 0.0,  0.36, 0.20, 0.16, 1.0, None, 0.0),
        'red':          ('SafetyRedEnamel',        (0.68, 0.08, 0.06), 0.0,  0.36, 0.22, 0.16, 1.0, None, 0.0),
        'green':        ('SafetyGreenEnamel',      (0.06, 0.44, 0.18), 0.0,  0.38, 0.18, 0.16, 1.0, None, 0.0),
        'epoxy':        ('CastEpoxyMaroon',        (0.28, 0.05, 0.04), 0.0,  0.24, 0.55, 0.12, 1.0, None, 0.0),
        'galv':         ('GalvRoofSteel',          (0.66, 0.69, 0.72), 0.88, 0.30, 0.0,  0.15, 1.0, None, 0.0),
        'stainless':    ('BrushedStainless',       (0.78, 0.81, 0.84), 0.94, 0.24, 0.0,  0.15, 1.0, None, 0.0),
        'brass':        ('MachinedBrass',          (0.80, 0.58, 0.16), 0.94, 0.22, 0.0,  0.15, 1.0, None, 0.0),
        'copper':       ('ElectrolyticCopper',     (0.78, 0.38, 0.16), 0.96, 0.22, 0.0,  0.15, 1.0, None, 0.0),
        'silver':       ('SilverPlatedContact',    (0.86, 0.88, 0.90), 0.96, 0.18, 0.0,  0.15, 1.0, None, 0.0),
        'rubber':       ('SmoothBlackRubber',      (0.04, 0.045, 0.05), 0.0, 0.72, 0.0,  0.20, 1.0, None, 0.0),
        'porcelain':    ('PorcelainInsulator',     (0.90, 0.89, 0.86), 0.0,  0.16, 0.65, 0.10, 1.0, None, 0.0),
        'glass':        ('ClearInspectionGlass',   (0.78, 0.88, 0.94), 0.0,  0.05, 1.0,  0.04, 0.28, None, 0.0),
        'relay_screen': ('RelayScreenDark',        (0.05, 0.08, 0.10), 0.0,  0.18, 0.40, 0.10, 1.0, (0.04, 0.18, 0.14), 0.35),
        'lamp_amber':   ('LampAmberGlow',          (0.92, 0.56, 0.06), 0.0,  0.20, 0.50, 0.10, 1.0, (0.95, 0.55, 0.05), 1.4),
        'lamp_red':     ('LampRedGlow',            (0.86, 0.10, 0.08), 0.0,  0.20, 0.50, 0.10, 1.0, (0.92, 0.10, 0.08), 1.4),
        'lamp_green':   ('LampGreenGlow',          (0.08, 0.78, 0.28), 0.0,  0.20, 0.50, 0.10, 1.0, (0.08, 0.85, 0.30), 1.4),
        'white_label':  ('LabelWhite',             (0.92, 0.93, 0.94), 0.0,  0.45, 0.0,  0.15, 1.0, None, 0.0),
    }
    return {k: _make_clean_mat(*v) for k, v in specs.items()}


class CleanHardSurfaceBuilder:
    """
    Accumulates multi-material hard-surface parts in Blender world space (Z-up, front=-Y)
    and produces crisp smooth-shaded meshes with clean box UVs.
    """

    def __init__(self, mats):
        self.mats = mats
        self.bm = bmesh.new()
        self.mat_keys = []
        self.mat_idx = {}

    def _slot(self, mat_key):
        if mat_key not in self.mat_idx:
            self.mat_idx[mat_key] = len(self.mat_keys)
            self.mat_keys.append(mat_key)
        return self.mat_idx[mat_key]

    def _apply_xform(self, verts, center, rot_euler=(0.0, 0.0, 0.0)):
        rot_m = Euler(rot_euler, 'XYZ').to_matrix().to_4x4()
        xf = Matrix.Translation(Vector(center)) @ rot_m
        bmesh.ops.transform(self.bm, matrix=xf, verts=verts)

    def box(self, center, size, mat_key, bevel=0.0, segs=1, rot_euler=(0.0, 0.0, 0.0)):
        slot = self._slot(mat_key)
        ret = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = ret['verts']
        sx, sy, sz = size
        for v in verts:
            v.co.x *= sx
            v.co.y *= sy
            v.co.z *= sz
        if bevel > 0.0:
            edges = list({e for v in verts if v.is_valid for e in v.link_edges})
            b_ret = bmesh.ops.bevel(
                self.bm,
                geom=edges,
                offset=min(bevel, min(sx, sy, sz) * 0.45),
                segments=max(1, segs),
                profile=0.5,
                affect='EDGES',
                clamp_overlap=True,
            )
            verts = [v for v in (set(verts) | set(b_ret.get('verts', []))) if v.is_valid]
        faces = list({f for v in verts if v.is_valid for f in v.link_faces})
        for f in faces:
            f.material_index = slot
        self._apply_xform(verts, center, rot_euler)
        return verts

    def cyl(self, center, radius_bottom, radius_top, height, mat_key, segs=20, axis='z', rot_euler=(0.0, 0.0, 0.0), bevel_caps=0.0):
        slot = self._slot(mat_key)
        ret = bmesh.ops.create_cone(
            self.bm,
            cap_ends=True,
            cap_tris=False,
            segments=segs,
            radius1=radius_bottom,
            radius2=radius_top,
            depth=height,
        )
        verts = ret['verts']
        if axis == 'x':
            bmesh.ops.rotate(self.bm, verts=verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2.0, 3, 'Y'))
        elif axis == 'y':
            bmesh.ops.rotate(self.bm, verts=verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2.0, 3, 'X'))
        if bevel_caps > 0.0:
            cap_edges = [e for v in verts if v.is_valid for e in v.link_edges if len(e.link_faces) == 2]
            cap_edges = [e for e in set(cap_edges) if abs(e.link_faces[0].normal.dot(e.link_faces[1].normal)) < 0.35]
            if cap_edges:
                b_ret = bmesh.ops.bevel(
                    self.bm,
                    geom=cap_edges,
                    offset=bevel_caps,
                    segments=2,
                    profile=0.5,
                    affect='EDGES',
                    clamp_overlap=True,
                )
                verts = [v for v in (set(verts) | set(b_ret.get('verts', []))) if v.is_valid]
        faces = list({f for v in verts if v.is_valid for f in v.link_faces})
        for f in faces:
            f.material_index = slot
        self._apply_xform(verts, center, rot_euler)
        return verts

    def torus_ring(self, center, major_r, minor_r, mat_key, major_segs=24, minor_segs=10, axis='y', rot_euler=(0.0, 0.0, 0.0), arc=2.0 * math.pi):
        """Create a closed or open torus ring around the chosen axis."""
        pts = []
        steps = major_segs
        closed = abs(arc - 2.0 * math.pi) < 1e-4
        count = steps if closed else steps + 1
        for i in range(count):
            a = (arc * i) / steps
            if axis == 'z':
                pts.append((major_r * math.cos(a), major_r * math.sin(a), 0.0))
            elif axis == 'x':
                pts.append((0.0, major_r * math.cos(a), major_r * math.sin(a)))
            else:  # y
                pts.append((major_r * math.cos(a), 0.0, major_r * math.sin(a)))
        verts = self.tube(pts, minor_r, mat_key, segs=minor_segs, closed=closed, cap_ends=not closed)
        if any(abs(r) > 1e-5 for r in rot_euler) or any(abs(c) > 1e-5 for c in center):
            self._apply_xform(verts, center, rot_euler)
        return verts

    def tube(self, points, radius, mat_key, segs=12, closed=False, cap_ends=True):
        """Sweep a circular profile along a 3D polyline in world coordinates."""
        slot = self._slot(mat_key)
        pts = [Vector(p) for p in points]
        n = len(pts)
        if n < 2:
            return []

        rings = []
        all_verts = []
        for idx, p in enumerate(pts):
            if closed:
                tangent = (pts[(idx + 1) % n] - pts[(idx - 1) % n]).normalized()
            elif idx == 0:
                tangent = (pts[1] - pts[0]).normalized()
            elif idx == n - 1:
                tangent = (pts[-1] - pts[-2]).normalized()
            else:
                tangent = (pts[idx + 1] - pts[idx - 1]).normalized()
            if tangent.length < 1e-6:
                tangent = Vector((0, 0, 1))
            ref = Vector((0, 0, 1)) if abs(tangent.z) < 0.92 else Vector((1, 0, 0))
            binorm = tangent.cross(ref).normalized()
            norm = binorm.cross(tangent).normalized()

            ring = []
            for s in range(segs):
                ang = (2.0 * math.pi * s) / segs
                offset = (norm * math.cos(ang) + binorm * math.sin(ang)) * radius
                v = self.bm.verts.new(p + offset)
                ring.append(v)
                all_verts.append(v)
            rings.append(ring)

        ring_count = n if closed else n - 1
        for i in range(ring_count):
            r0 = rings[i]
            r1 = rings[(i + 1) % n]
            for s in range(segs):
                s_next = (s + 1) % segs
                f = self.bm.faces.new((r0[s], r0[s_next], r1[s_next], r1[s]))
                f.material_index = slot

        if not closed and cap_ends:
            f0 = self.bm.faces.new(list(reversed(rings[0])))
            f0.material_index = slot
            f1 = self.bm.faces.new(rings[-1])
            f1.material_index = slot

        return all_verts

    def handle_u(self, center, span, depth, radius=0.006, mat_key='stainless', axis='z', face_normal=(0, -1, 0)):
        """Build a clean U-shaped cabinet pull handle protruding along face_normal."""
        cx, cy, cz = center
        nx, ny, nz = face_normal
        if axis == 'z':
            pts = [
                (cx, cy, cz - span * 0.5),
                (cx + nx * depth, cy + ny * depth, cz - span * 0.5),
                (cx + nx * depth, cy + ny * depth, cz + span * 0.5),
                (cx, cy, cz + span * 0.5),
            ]
        else:
            pts = [
                (cx - span * 0.5, cy, cz),
                (cx - span * 0.5 + nx * depth, cy + ny * depth, cz + nz * depth),
                (cx + span * 0.5 + nx * depth, cy + ny * depth, cz + nz * depth),
                (cx + span * 0.5, cy, cz),
            ]
        return self.tube(pts, radius, mat_key, segs=10)

    def finish(self, name, col, parent=None, origin=(0.0, 0.0, 0.0), parent_is_at_origin=False):
        """Create mesh object with geometry shifted by -origin. Set parent_is_at_origin=True when *parent* already sits at *origin*."""
        ox, oy, oz = origin
        if abs(ox) > 1e-6 or abs(oy) > 1e-6 or abs(oz) > 1e-6:
            bmesh.ops.translate(self.bm, verts=self.bm.verts, vec=(-ox, -oy, -oz))

        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)

        uv_layer = self.bm.loops.layers.uv.verify()
        for f in self.bm.faces:
            n = f.normal
            ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
            for loop in f.loops:
                co = loop.vert.co
                if az >= ax and az >= ay:
                    loop[uv_layer].uv = (co.x * 1.5, co.y * 1.5)
                elif ay >= ax:
                    loop[uv_layer].uv = (co.x * 1.5, co.z * 1.5)
                else:
                    loop[uv_layer].uv = (co.y * 1.5, co.z * 1.5)

        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()

        for key in self.mat_keys:
            mesh.materials.append(self.mats[key])

        if len(mesh.polygons) > 0:
            mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
        mesh.update()

        obj = bpy.data.objects.new(name, mesh)
        obj.location = (0.0, 0.0, 0.0) if parent_is_at_origin else (ox, oy, oz)
        col.objects.link(obj)
        if parent is not None:
            obj.parent = parent

        wn = obj.modifiers.new(name='WeightedNormal', type='WEIGHTED_NORMAL')
        wn.keep_sharp = True
        return obj


def export_collection_uncompressed_glb(col, out_path):
    """Export all objects in *col* to an uncompressed glTF 2.0 .glb for Godot 4.7."""
    objs = list(col.all_objects)
    total_tris = 0
    first_obj = None
    for obj in objs:
        if first_obj is None:
            first_obj = obj
        if obj.type == 'MESH':
            total_tris += sum(max(1, len(p.vertices) - 2) for p in obj.data.polygons)

    abs_path = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)

    override_kwargs = {}
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
    if first_obj is not None:
        bpy.context.view_layer.objects.active = first_obj
        override_kwargs['active_object'] = first_obj

    def _do_export():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objs:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=abs_path,
            export_format='GLB',
            use_selection=True,
            export_yup=True,
            export_apply=True,
            export_texcoords=True,
            export_normals=True,
            export_tangents=False,
            export_materials='EXPORT',
            export_draco_mesh_compression_enable=False,
        )

    if override_kwargs:
        with bpy.context.temp_override(**override_kwargs):
            _do_export()
    else:
        _do_export()

    return total_tris, os.path.getsize(abs_path)
