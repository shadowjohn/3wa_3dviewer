"""Bake the original 1F pickup-zone diorama as three meter-scale GLBs."""

from math import pi, radians, sin
from pathlib import Path

import bpy


FPS = 30
END_FRAME = 481
OUTPUT = Path(__file__).parent


def xyz(location):
    x, y, z = location
    return (x, -z, y)


def material(name, color, roughness=.75, metallic=0, glow=0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if glow:
        shader.inputs["Emission Color"].default_value = (*color, 1)
        shader.inputs["Emission Strength"].default_value = glow
    return result


def node(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = xyz(location)
    return obj


def mesh(name, points, faces, paint, parent, position=(0, 0, 0), bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(vertex) for vertex in points], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = xyz(position)
    data.materials.append(paint)
    if bevel:
        edge = obj.modifiers.new("Rounded edges", "BEVEL")
        edge.width = bevel
        edge.segments = 2
        normals = obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
        normals.keep_sharp = True
    return obj


def box(name, position, size, paint, parent=None, bevel=0):
    x, y, z = (value / 2 for value in size)
    points = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z),
              (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    faces = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4),
             (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return mesh(name, points, faces, paint, parent, position, bevel)


def hull(name, profile, width, paint, parent, bevel=0, side=0):
    # The profile is counterclockwise in the +X, +Y plane.
    count = len(profile)
    points = [(x, y, side + z) for z in (-width / 2, width / 2) for x, y in profile]
    faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
    faces.extend((i, (i + 1) % count, (i + 1) % count + count, i + count)
                 for i in range(count))
    return mesh(name, points, faces, paint, parent, bevel=bevel)


def round_part(name, position, size, paint, parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, location=xyz(position))
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.scale = (size[0], size[2], size[1])
    obj.data.materials.append(paint)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def wheel(name, position, radius, width, paint, parent):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=radius, depth=width, location=xyz(position), rotation=(pi / 2, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.data.materials.append(paint)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return obj


def merge_static_materials():
    by_material = {}
    for obj in bpy.context.scene.objects:
        by_material.setdefault(obj.data.materials[0].name, []).append(obj)
    for name, objects in by_material.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.context.object.name = name


def stage():
    road = material("Asphalt", (.039, .065, .078))
    concrete = material("Concrete platform", (.29, .35, .37))
    tile = material("Platform joints", (.19, .24, .26))
    trim = material("Architectural shadow", (.105, .15, .17))
    roof = material("Canopy structure", (.50, .58, .60), .55, .14)
    fascia = material("Brushed edge", (.65, .73, .75), .55, .16)
    white = material("Lane paint", (.86, .89, .86))
    yellow = material("Curb safety paint", (.96, .57, .085))
    ruby = material("First-floor pick-up marker", (.36, .039, .065))
    sign = material("Directional wayfinding", (.025, .115, .19))
    glass = material("Station glazing", (.075, .23, .27), .2, .26)
    light = material("Canopy light strips", (.76, .93, 1), .43, 0, .9)

    box("Pick-up roadway", (0, -.10, -2.2), (74, .2, 7.9), road)
    box("Walkway", (0, .002, 4.9), (74, .32, 6.35), concrete)
    box("Curb edge", (0, .077, 1.82), (74, .155, .20), fascia)
    box("Bay", (0, .002, .73), (14, .006, 1.96), ruby)
    box("Red approach guide", (-20, .003, 1.22), (25, .006, .18), ruby)
    for x in range(-34, 35, 4):
        box("Dashed white lane marking", (x, .002, -1.8), (2.1, .006, .10), white)
        box("Curb stripe", (x, .164, 1.79), (3.75, .01, .105), yellow)
        box("Tactile strip", (x, .165, 2.15), (3.93, .012, .29), yellow)
        box("Walkway joints", (x, .164, 5.0), (.025, .010, 5.5), tile)
    for z in (2.8, 4.0, 5.2, 6.4, 7.6):
        box("Longitudinal tile seams", (0, .164, z), (74, .01, .025), tile)
    for x in (-6.95, 6.95):
        box("Bay threshold", (x, .008, .72), (.10, .006, 1.96), white)
    box("Bay edge", (0, .008, -.24), (14, .006, .11), white)
    for x in (-17, 15):
        box("Direction shaft", (x, .006, .1), (1.3, .012, .14), white)
        mesh("Direction arrowhead", [(x + .97, .008, .10), (x + .33, .008, -.27),
                                      (x + .33, .008, .47)], [(0, 1, 2)], white, None)

    for x in (-31, -21, -12, 12, 21, 31):
        for z in (4.9, 7.9):
            box("Canopy column", (x, 2.56, z), (.39, 4.9, .48), roof)
            box("Column shoe", (x, .38, z), (.49, .46, .57), trim)
    for z in (5, 7.9):
        box("Canopy beam", (0, 5.0, z), (71, .36, .28), roof)
    # Keep the demonstration berth open to the camera while retaining the canopy silhouette.
    for x in (-23, 23):
        box("Canopy wing", (x, 5.23, 6.4), (24, .24, 3.95), roof)
        box("Fascia", (x, 5.18, 4.41), (24, .29, .14), fascia)
        box("Light rail", (x, 5.006, 5.75), (23, .04, .09), light)
        box("Recessed station frontage", (x, 1.94, 7.96), (22, 3.28, .135), glass)
        for offset in range(-10, 11, 2):
            box("Window mullion", (x + offset, 1.97, 7.84), (.095, 3.18, .08), fascia)

    for x in (-10, -8, -6, 6, 8, 10):
        box("Safety bollard", (x, .58, 2.56), (.115, .84, .115), trim)
        box("Reflective bollard cap", (x, .94, 2.56), (.13, .105, .13), yellow)
    for x in (-3.35, -2.75):
        box("Zone sign post", (x, 1.35, 3.84), (.08, 2.5, .08), trim)
    box("Zone sign panel", (-3.05, 2.65, 3.84), (.86, .62, .13), sign)
    for z in (3.77, 3.91):
        box("Seven header", (-3.05, 2.82, z), (.31, .064, .018), white)
        slash = box("Seven stem", (-3.035, 2.65, z), (.062, .35, .018), white)
        slash.rotation_euler.y = -radians(24)
    merge_static_materials()


def car():
    blue = material("Metallic deep azure", (.037, .225, .44), .31, .37)
    dark_blue = material("Blue window frames", (.022, .052, .085), .43, .16)
    glass = material("Window glass", (.040, .10, .14), .20, .32)
    chrome = material("Alloy and handles", (.44, .56, .62), .32, .50)
    rubber = material("Tyres and rocker panels", (.025, .034, .04))
    seat = material("Seat upholstery", (.075, .11, .132))
    lamp = material("Headlight LED", (.73, .92, 1), .23, .1, .7)
    tail = material("Tail lights", (.95, .036, .028), .28, 0, .5)
    root = node("CAR")

    hull("Lower car body", [(-2.24, .40), (-1.99, .27), (1.91, .27), (2.26, .39),
                           (2.25, .61), (-2.22, .61)], 1.76, blue, root, .095)
    hull("Hood", [(1.03, .58), (2.24, .58), (2.10, .77), (1.18, .91)],
         1.73, blue, root, .065)
    hull("Rear quarter assembly", [(-2.19, .55), (-1.94, .48), (-.37, .56),
                                    (-.37, .91), (-1.31, .94), (-2.06, .82)],
         1.73, blue, root, .065)
    box("Driver side", (.27, .75, -.87), (1.69, .32, .09), blue, root, .035)
    box("Sill below passenger door", (.28, .47, .887), (1.54, .10, .035), dark_blue, root)
    for z in (-.52, .52):
        box("Seat cushion", (.38, .68, z), (.50, .14, .48), seat, root, .048)
        box("Seat back", (.09, .92, z), (.15, .55, .43), seat, root, .05)
        box("Headrest", (.08, 1.19, z), (.14, .17, .23), seat, root, .04)
    box("Dashboard", (.93, .86, 0), (.29, .18, 1.51), dark_blue, root, .055)
    hull("Roof shell", [(-1.18, 1.29), (.70, 1.29), (.60, 1.48), (-.94, 1.50)],
         1.48, blue, root, .055)
    hull("Windshield", [(.57, 1.29), (1.09, .91), (1.17, .96), (.66, 1.38)],
         1.49, glass, root, .023)
    hull("Rear window", [(-1.66, .91), (-1.54, .91), (-.87, 1.39), (-1.01, 1.42)],
         1.52, glass, root, .025)
    for z in (-.72, .72):
        hull("Rear quarter window", [(-1.54, .92), (-.40, .92), (-.40, 1.36), (-.96, 1.34)],
             .047, glass, root, .02, side=z)
    hull("Driver side glass", [(-.35, .91), (1.02, .91), (.58, 1.36), (-.35, 1.36)],
         .048, glass, root, .024, side=-.74)
    box("Rear bumper insert", (-2.19, .39, 0), (.15, .12, 1.48), dark_blue, root, .04)
    box("Front intake", (2.19, .50, 0), (.14, .16, 1.08), dark_blue, root, .04)
    box("Driver mirror", (1.01, 1.08, -.91), (.22, .105, .23), blue, root, .035)
    for sign in (-1, 1):
        z = sign * .64
        box("Headlight", (2.139, .66, z), (.15, .097, .37), lamp, root, .023)
        box("Tail lamp", (-2.18, .651, z), (.09, .105, .42), tail, root, .02)
        for x in (-1.43, 1.42):
            wheel("Rubber tire", (x, .331, sign * .821), .33, .25, rubber, root)
            wheel("Metal wheel face", (x, .331, sign * .952), .214, .016, chrome, root)
            wheel("Wheel hub", (x, .331, sign * .964), .077, .018, dark_blue, root)

    door = node("DOOR", (1.03, .61, .93), root)
    box("Passenger door painted panel", (-.69, .142, -.055), (1.36, .39, .12), blue, door, .045)
    hull("Passenger window", [(-1.32, .30), (0, .30), (-.45, .75), (-1.32, .75)],
         .057, glass, door, .02, side=-.177)
    box("Passenger handle", (-1.105, .225, .021), (.22, .039, .027), chrome, door, .012)
    box("Passenger mirror", (-.075, .475, .012), (.22, .105, .23), blue, door, .035)
    for seconds, angle in ((0, 0), (8.35, 0), (9.25, 62), (11.55, 62), (12.45, 0), (16, 0)):
        key(door, "rotation_euler", (0, 0, radians(angle)), seconds)


def key(obj, field, value, seconds):
    setattr(obj, field, value)
    obj.keyframe_insert(data_path=field, frame=round(seconds * FPS) + 1)


def passenger():
    navy = material("Navy trousers", (.036, .074, .127))
    shoe = material("Graphite shoes", (.045, .06, .068))
    sole = material("White sneaker soles", (.71, .76, .75))
    top = material("Coral transit jacket", (.83, .198, .081), .62)
    accent = material("Jacket seams", (.51, .084, .054), .73)
    skin = material("Skin tone", (.55, .29, .168))
    hair = material("Dark hair", (.077, .043, .032))
    bag = material("Canvas daypack", (.18, .22, .175))
    root = node("PASSENGER")
    round_part("Jacket", (0, 1.185, 0), (.232, .315, .146), top, root)
    box("Zip seam", (0, 1.203, -.145), (.021, .36, .022), accent, root, .007)
    box("Waist", (0, .925, 0), (.35, .16, .237), navy, root, .038)
    round_part("Neck", (0, 1.464, 0), (.066, .079, .066), skin, root)
    round_part("Head", (0, 1.607, -.007), (.127, .146, .112), skin, root)
    round_part("Hair", (0, 1.679, .013), (.127, .090, .107), hair, root)
    for x in (-.12, .12):
        round_part("Ear", (x, 1.60, -.001), (.025, .041, .022), skin, root)
    box("Daypack", (0, 1.20, .169), (.30, .375, .177), bag, root, .055)
    box("Daypack pocket", (0, 1.135, .26), (.21, .16, .047), accent, root, .025)

    limbs = []
    for sign, side in ((-1, "L"), (1, "R")):
        leg = node(f"LEG_{side}", (sign * .107, .865, 0), root)
        box("Trouser leg", (0, -.39, 0), (.152, .76, .182), navy, leg, .052)
        box("Sneaker", (0, -.797, -.068), (.139, .115, .266), shoe, leg, .036)
        box("Sneaker sole", (0, -.846, -.07), (.148, .038, .268), sole, leg, .014)
        arm = node(f"ARM_{side}", (sign * .224, 1.362, 0), root)
        box("Jacket sleeve", (sign * .019, -.197, 0), (.126, .402, .142), top, arm, .05)
        round_part("Hand", (sign * .024, -.423, -.001), (.059, .078, .060), skin, arm)
        limbs.append((sign, leg, arm))

    for sign, leg, arm in limbs:
        for seconds in (0, 6.25):
            key(leg, "rotation_euler", (0, 0, 0), seconds)
            key(arm, "rotation_euler", (0, 0, 0), seconds)
        for step in range(1, 17):
            seconds = 6.25 + step * .215
            swing = sign * sin(step * pi / 2)
            key(leg, "rotation_euler", (radians(27 * swing), 0, 0), seconds)
            key(arm, "rotation_euler", (radians(-18 * swing), 0, 0), seconds)
        for seconds, bend in ((9.8, 0), (10.2, 0), (10.95, sign * 20), (11.55, 0), (16, 0)):
            key(leg, "rotation_euler", (radians(bend), 0, 0), seconds)
            key(arm, "rotation_euler", (radians(-abs(bend)), 0, 0), seconds)

    # Director moves the whole object. This clip only animates the nested pose.
    key(root, "rotation_euler", (0, 0, 0), 0)
    key(root, "rotation_euler", (0, 0, 0), 10.2)
    key(root, "rotation_euler", (radians(34), 0, radians(-38)), 11.2)
    key(root, "rotation_euler", (radians(34), 0, radians(-38)), 16)
    for seconds, scale in ((0, 1), (10.2, 1), (10.9, .85), (11.55, .001), (16, .001)):
        key(root, "scale", (scale, scale, scale), seconds)


def export(filename, build, clip_name=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    if clip_name:
        scene.name = clip_name
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = END_FRAME
    build()
    scene.frame_set(1)
    path = OUTPUT / filename
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", export_yup=True, export_apply=True,
        export_animations=clip_name is not None, export_animation_mode="SCENE",
        export_anim_scene_split_object=False,
        export_frame_range=True, export_anim_slide_to_zero=True,
    )


if __name__ == "__main__":
    export("stage.glb", stage)
    export("car.glb", car, "PickupDoor")
    export("passenger.glb", passenger, "PickupPassenger")
