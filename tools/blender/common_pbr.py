"""
Shared Blender 5.2+ PBR, bevel/weighted-normal, UV unwrap, and glTF/Draco export utilities
for the 3D Marine HV Switchboard Simulator asset pipeline.
"""

import math
import os
import bpy


def clear_scene():
    """Reset the active Blender scene to an empty deterministic state."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    return scene


def ensure_collection(name, parent=None):
    """Get or create a named collection linked under parent (or scene root)."""
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        target = parent if parent is not None else bpy.context.scene.collection
        target.children.link(col)
    return col


def link_object(obj, collection=None):
    """Link object exclusively into the given collection (or scene collection)."""
    target = collection if collection is not None else bpy.context.scene.collection
    if obj.name not in target.objects:
        target.objects.link(obj)
    for col in list(obj.users_collection):
        if col != target:
            col.objects.unlink(obj)
    return obj


def set_smooth_shading(obj):
    """Mark all polygons on a mesh object smooth-shaded (Blender 5.x compatible)."""
    if obj.type != 'MESH' or obj.data is None:
        return
    mesh = obj.data
    if len(mesh.polygons) > 0:
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    mesh.update()


def add_bevel_and_weighted_normal(obj, width=0.006, segments=3, angle_limit_deg=30.0):
    """Attach angle-weighted Bevel and WeightedNormal modifiers for crisp specular edges."""
    if obj.type != 'MESH':
        return obj
    set_smooth_shading(obj)

    bevel = obj.modifiers.new(name='Bevel', type='BEVEL')
    bevel.width = width
    bevel.segments = segments
    bevel.limit_method = 'ANGLE'
    bevel.angle_limit = math.radians(angle_limit_deg)
    bevel.harden_normals = False
    bevel.use_clamp_overlap = True

    wn = obj.modifiers.new(name='WeightedNormal', type='WEIGHTED_NORMAL')
    wn.keep_sharp = True
    return obj


def make_principled_material(
    name,
    base_color=(0.5, 0.5, 0.5, 1.0),
    metallic=0.0,
    roughness=0.5,
    coat_weight=0.0,
    coat_roughness=0.15,
    emission_color=None,
    emission_strength=0.0,
    bump_noise_scale=0.0,
    bump_strength=0.0,
):
    """Create a Blender 5.x Principled BSDF material with optional procedural micro-bump."""
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    out.location = (400, 0)

    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (100, 0)
    bsdf.inputs['Base Color'].default_value = tuple(base_color)
    bsdf.inputs['Metallic'].default_value = float(metallic)
    bsdf.inputs['Roughness'].default_value = float(roughness)

    if 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = float(coat_weight)
    if 'Coat Roughness' in bsdf.inputs:
        bsdf.inputs['Coat Roughness'].default_value = float(coat_roughness)

    if emission_color is not None and emission_strength > 0.0:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = tuple(emission_color)
        if 'Emission Strength' in bsdf.inputs:
            bsdf.inputs['Emission Strength'].default_value = float(emission_strength)

    if bump_noise_scale > 0.0 and bump_strength > 0.0:
        tex_coord = nodes.new('ShaderNodeTexCoord')
        tex_coord.location = (-600, -180)
        noise = nodes.new('ShaderNodeTexNoise')
        noise.location = (-380, -180)
        noise.inputs['Scale'].default_value = float(bump_noise_scale)
        noise.inputs['Detail'].default_value = 6.0
        noise.inputs['Roughness'].default_value = 0.6

        bump = nodes.new('ShaderNodeBump')
        bump.location = (-140, -180)
        bump.inputs['Strength'].default_value = float(bump_strength)
        bump.inputs['Distance'].default_value = 0.004

        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat


def assign_material(obj, mat):
    """Assign a single material to slot 0 of a mesh object."""
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def smart_uv_unwrap(obj, angle_limit_deg=66.0, island_margin=0.02):
    """Perform a clean Smart UV Project on a mesh object."""
    if obj.type != 'MESH':
        return
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(angle_limit_deg),
        island_margin=island_margin,
    )
    bpy.ops.object.mode_set(mode='OBJECT')


def save_blend(filepath):
    """Save the current Blender scene as a clean editable .blend source file."""
    abs_path = os.path.abspath(filepath)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=abs_path, compress=True)
    return abs_path


def export_glb(filepath, use_draco=True, compression_level=6, selected_only=False):
    """Export scene (or selection) to glTF 2.0 binary .glb with optional Draco compression."""
    abs_path = os.path.abspath(filepath)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)

    kwargs = dict(
        filepath=abs_path,
        export_format='GLB',
        use_selection=selected_only,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials='EXPORT',
        export_yup=True,
        export_draco_mesh_compression_enable=bool(use_draco),
        export_draco_mesh_compression_level=int(compression_level),
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    bpy.ops.export_scene.gltf(**kwargs)
    return abs_path
