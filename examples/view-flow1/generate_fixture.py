"""Generate the original cutaway fixture with Blender --background --python."""

from math import cos, pi, radians, sin
from pathlib import Path

import bpy


def metal(name, color, roughness, metallic, alpha=1):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, alpha)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if alpha < 1:
        shader.inputs["Alpha"].default_value = alpha
        material.surface_render_method = "BLENDED"
        material.use_backface_culling = True
    return material


def tube(name, x0, x1, inner, outer, wall, lining, edge, front=False):
    # Blender -Y becomes the viewer-facing +Z after glTF export.
    sides = 32
    angle = [(pi if front else 0) + pi * i / sides for i in range(sides + 1)]
    vertices = [
        (x, radius * sin(a), -radius * cos(a))
        for x, radius in [(x0, outer), (x1, outer), (x0, inner), (x1, inner)]
        for a in angle
    ]
    ring_size = sides + 1
    faces = []
    for i in range(sides):
        a, b, c, d = [i + j * ring_size for j in range(4)]
        faces.extend([(a, a + 1, b + 1, b), (c, d, d + 1, c + 1),
                      (a, c, c + 1, a + 1), (b, b + 1, d + 1, d)])
    faces.extend([(0, ring_size, 3 * ring_size, 2 * ring_size),
                  (sides, sides + 2 * ring_size, sides + 3 * ring_size, sides + ring_size)])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for material in (wall, lining, edge):
        mesh.materials.append(material)
    for face in mesh.polygons:
        face.material_index = min(face.index % 4, 2) if face.index < sides * 4 else 2
        face.use_smooth = face.material_index < 2
    return obj


def cylinder(name, radius, depth, position, rotation, material, vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=position, rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return obj


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 361
steel = metal("Blue steel", (.16, .24, .33), .42, .24)
liner = metal("Satin slate bore", (.026, .043, .061), .73, .06)
cut = metal("Machined section", (.16, .24, .30), .48, .23)
collar = metal("Coupling blue", (.12, .22, .31), .37, .22)
brass = metal("Valve disc amber", (.64, .25, .06), .39, .26)
jacket = metal("Translucent pipe jacket", (.035, .13, .18), .37, .03, alpha=.26)

for direction, name in [(-1, "Inlet"), (1, "Outlet")]:
    lo, hi = sorted((direction * .08, direction * 2.94))
    tube(f"{name} cutaway shell", lo, hi, .46, .54, steel, liner, cut)
    lo, hi = sorted((direction * .29, direction * 2.70))
    tube(f"{name} translucent jacket", lo, hi, .496, .54, jacket, jacket, jacket, front=True)
    for position, half_width, radius in [(.20, .09, .64), (2.74, .105, .65), (2.90, .045, .60)]:
        center = direction * position
        tube(f"{name} coupling {position}", center - half_width, center + half_width,
             .458, radius, collar, liner, cut)
    for angle in [pi / 6, pi / 2, 5 * pi / 6]:
        cylinder(f"{name} coupling bolt", .046, .055,
                 (direction * 2.63, .594 * sin(angle), -.594 * cos(angle)),
                 (0, pi / 2, 0), cut, vertices=6)

tube("Valve seat", -.10, .025, .442, .575, brass, brass, brass)
cylinder("Hinge pin", .062, .49, (.04, .11, .425), (pi / 2, 0, 0), cut)
pivot = bpy.data.objects.new("Flap hinge", None)
bpy.context.collection.objects.link(pivot)
pivot.location = (.04, 0, .425)
flap = cylinder("Check valve flap", .433, .058, (0, 0, -.425), (0, pi / 2, 0), brass, 48)
flap.parent = pivot
bevel = flap.modifiers.new("Machined disc edge", "BEVEL")
bevel.width = .014
bevel.segments = 2

for frame, angle in [(1, 0), (12, 0), (31, 84), (151, 84), (172, 0), (361, 0)]:
    pivot.rotation_euler.y = -radians(angle)
    pivot.keyframe_insert(data_path="rotation_euler", frame=frame)
pivot.animation_data.action.name = "Valve_OpenClose"
scene.frame_set(1)

bpy.ops.export_scene.gltf(
    filepath=str(Path(__file__).with_name("synthetic-valve.glb")),
    export_format="GLB", export_yup=True, export_apply=True,
    export_frame_range=True, export_anim_slide_to_zero=True,
)
