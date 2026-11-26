"""
Render a custom marine HV switchroom equirectangular HDR environment map
(`public/env/switchroom_studio.hdr`) using Blender Cycles panoramic rendering,
plus save the editable source scene at `assets-src/blender/switchroom_hdri.blend`.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import bpy
from common_pbr import (
    assign_material,
    clear_scene,
    ensure_collection,
    link_object,
    make_principled_material,
    save_blend,
)


def create_box(name, size, location, mat, col):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, mat)
    link_object(obj, col)
    return obj


def build_switchroom_hdri_scene():
    scene = clear_scene()
    col = ensure_collection('SwitchroomHDRI')

    # Render engine: Cycles CPU panoramic equirectangular HDR
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 32
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.02
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 0
    scene.cycles.volume_bounces = 0
    scene.cycles.use_denoising = False

    scene.render.resolution_x = 512
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'HDR'
    scene.render.image_settings.color_mode = 'RGB'

    # Dark subtle ambient world outside chamber (no leaks)
    world = bpy.data.worlds.new('SwitchroomWorld')
    scene.world = world
    if world.node_tree is None:
        world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (0.04, 0.05, 0.065, 1.0)
        bg.inputs['Strength'].default_value = 0.25

    # Chamber shell materials (authentic marine engine control / switchroom palette)
    deck_mat = make_principled_material(
        'DeckBounce', base_color=(0.14, 0.17, 0.20, 1.0), metallic=0.28, roughness=0.62
    )
    bulkhead_upper = make_principled_material(
        'BulkheadUpper', base_color=(0.62, 0.67, 0.72, 1.0), metallic=0.10, roughness=0.58
    )
    bulkhead_dado = make_principled_material(
        'BulkheadDado', base_color=(0.24, 0.30, 0.36, 1.0), metallic=0.18, roughness=0.52
    )
    teal_stripe = make_principled_material(
        'MarineTealBand', base_color=(0.06, 0.28, 0.32, 1.0), metallic=0.12, roughness=0.45
    )
    ceiling_mat = make_principled_material(
        'OverheadDeckhead', base_color=(0.26, 0.30, 0.35, 1.0), metallic=0.35, roughness=0.55
    )
    girder_mat = make_principled_material(
        'SteelGirder', base_color=(0.12, 0.15, 0.19, 1.0), metallic=0.65, roughness=0.42
    )
    panel_dark = make_principled_material(
        'SwitchboardBank', base_color=(0.28, 0.33, 0.38, 1.0), metallic=0.42, roughness=0.38
    )

    # Emissive fixture materials (produce realistic studio-grade softbox/fluorescent reflections)
    led_cool = make_principled_material(
        'FluorescentCool5200K',
        base_color=(0.94, 0.97, 1.0, 1.0),
        roughness=0.2,
        emission_color=(0.90, 0.96, 1.0, 1.0),
        emission_strength=11.5,
    )
    led_warm_fill = make_principled_material(
        'TaskWarm3600K',
        base_color=(1.0, 0.90, 0.76, 1.0),
        roughness=0.2,
        emission_color=(1.0, 0.88, 0.72, 1.0),
        emission_strength=5.2,
    )
    status_accent = make_principled_material(
        'InstrumentAccent',
        base_color=(0.25, 0.78, 0.82, 1.0),
        roughness=0.2,
        emission_color=(0.22, 0.75, 0.80, 1.0),
        emission_strength=2.6,
    )
    safety_amber = make_principled_material(
        'SafetyBeaconWarm',
        base_color=(0.98, 0.72, 0.22, 1.0),
        roughness=0.2,
        emission_color=(0.98, 0.70, 0.20, 1.0),
        emission_strength=2.2,
    )

    # Room dimensions (Blender Z-up: X=width 10.6m, Y=depth 9.8m, Z=height 3.5m)
    W, D, H = 10.6, 9.8, 3.5
    wall_t = 0.2

    # Deck & ceiling
    create_box('Deck', (W, D, wall_t), (0.0, 0.0, -wall_t * 0.5), deck_mat, col)
    create_box('Ceiling', (W, D, wall_t), (0.0, 0.0, H + wall_t * 0.5), ceiling_mat, col)

    # Four bulkheads (upper + lower dado + marine teal band)
    # North/South (Y = +/- D/2)
    for sign, label in ((1, 'Fwd'), (-1, 'Aft')):
        y_pos = sign * (D * 0.5 + wall_t * 0.5)
        create_box(f'WallUpper_{label}', (W, wall_t, H * 0.72), (0.0, y_pos, H * 0.64), bulkhead_upper, col)
        create_box(f'WallDado_{label}', (W, wall_t, H * 0.28), (0.0, y_pos, H * 0.14), bulkhead_dado, col)
        create_box(f'WallBand_{label}', (W, wall_t + 0.02, 0.10), (0.0, sign * (D * 0.5 - 0.01), H * 0.28), teal_stripe, col)

    # Port/Starboard (X = +/- W/2)
    for sign, label in ((-1, 'Port'), (1, 'Stbd')):
        x_pos = sign * (W * 0.5 + wall_t * 0.5)
        create_box(f'WallUpper_{label}', (wall_t, D, H * 0.72), (x_pos, 0.0, H * 0.64), bulkhead_upper, col)
        create_box(f'WallDado_{label}', (wall_t, D, H * 0.28), (x_pos, 0.0, H * 0.14), bulkhead_dado, col)
        create_box(f'WallBand_{label}', (wall_t + 0.02, D, 0.10), (sign * (W * 0.5 - 0.01), 0.0, H * 0.28), teal_stripe, col)

    # Overhead steel structural girders (creates crisp industrial reflection contrast on glossy metals)
    for y_g in (-3.2, -1.0, 1.2, 3.4):
        create_box(f'Girder_{y_g:+.1f}', (W - 0.2, 0.18, 0.24), (0.0, y_g, H - 0.12), girder_mat, col)
    for x_rib in (-3.6, 0.0, 3.6):
        create_box(f'LongitudinalRib_{x_rib:+.1f}', (0.14, D - 0.2, 0.16), (x_rib, 0.0, H - 0.08), girder_mat, col)

    # Simulated switchboard bank silhouette along forward side (grounds forward reflection horizon)
    create_box('SwitchboardSilhouette', (5.4, 1.2, 2.3), (0.0, 2.6, 1.15), panel_dark, col)

    # Twin rows of industrial marine LED overhead troffers (8 linear fixtures)
    for ix, lx in enumerate((-2.4, 2.4)):
        for iy, ly in enumerate((-3.0, -1.0, 1.0, 3.0)):
            create_box(f'Housing_{ix}_{iy}', (0.42, 1.38, 0.08), (lx, ly, H - 0.05), girder_mat, col)
            create_box(f'LEDStrip_{ix}_{iy}', (0.34, 1.28, 0.03), (lx, ly, H - 0.10), led_cool, col)

    # Center-aisle broad overhead soft bounce panel (keeps top-of-helmet & metal bevel highlights clean)
    create_box('CenterTroffer_A', (1.2, 2.2, 0.03), (0.0, -0.4, H - 0.09), led_cool, col)
    create_box('CenterTroffer_B', (1.2, 2.0, 0.03), (0.0, 2.2, H - 0.09), led_cool, col)

    # Warm desk & workbench task fill strips on port and starboard walls
    create_box('StbdTaskLight', (0.06, 2.0, 0.22), (W * 0.5 - 0.08, -0.6, 2.15), led_warm_fill, col)
    create_box('PortTaskLight', (0.06, 2.2, 0.22), (-W * 0.5 + 0.08, 0.8, 2.15), led_warm_fill, col)

    # Subtle cyan/amber marine instrument accents for rich metallic rim sheen
    create_box('InstrumentGlow', (2.6, 0.04, 0.24), (0.0, 1.98, 1.85), status_accent, col)
    create_box('WarningAccent', (0.65, 0.04, 0.18), (-3.0, -D * 0.5 + 0.08, 2.35), safety_amber, col)

    # Panoramic equirectangular camera centered at eye height (1.65 m)
    cam_data = bpy.data.cameras.new('HDRICamera')
    cam_data.type = 'PANO'
    if hasattr(cam_data, 'panorama_type'):
        cam_data.panorama_type = 'EQUIRECTANGULAR'
    elif hasattr(cam_data, 'cycles') and hasattr(cam_data.cycles, 'panorama_type'):
        cam_data.cycles.panorama_type = 'EQUIRECTANGULAR'
    cam_obj = bpy.data.objects.new('HDRICamera', cam_data)
    cam_obj.location = (0.0, -0.6, 1.65)
    cam_obj.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    link_object(cam_obj, col)
    scene.camera = cam_obj

    return scene


def main():
    scene = build_switchroom_hdri_scene()
    blend_out = os.path.join(REPO_ROOT, 'assets-src', 'blender', 'switchroom_hdri.blend')
    hdr_out = os.path.join(REPO_ROOT, 'public', 'env', 'switchroom_studio.hdr')

    os.makedirs(os.path.dirname(hdr_out), exist_ok=True)
    save_blend(blend_out)
    print(f'[render_hdri] Saved source scene: {blend_out}')

    scene.render.filepath = hdr_out
    bpy.ops.render.render(write_still=True)
    if not os.path.exists(hdr_out):
        raise RuntimeError(f'Expected HDR output missing at {hdr_out}')
    size_kb = os.path.getsize(hdr_out) / 1024.0
    print(f'[render_hdri] Rendered equirectangular HDRI: {hdr_out} ({size_kb:.1f} KB)')


if __name__ == '__main__':
    main()
