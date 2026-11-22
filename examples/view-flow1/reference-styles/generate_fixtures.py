"""Generate two original cross-section demonstration GLBs with the standard library."""

import json
from math import hypot
from pathlib import Path
from struct import pack


def quad(a, b, c, d):
    return (a, b, c), (a, c, d)


def panel(corners, z):
    points = [(*point, z) for point in corners]
    return [(points[0], points[i], points[i + 1]) for i in range(1, len(points) - 1)]


def normal(a, b, c):
    u, v = ([p[i] - a[i] for i in range(3)] for p in (b, c))
    vector = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
    length = hypot(*vector)
    return tuple(value / length for value in vector)


def material(name, color, roughness):
    result = {"name": name, "pbrMetallicRoughness": {
        "baseColorFactor": color, "metallicFactor": .08, "roughnessFactor": roughness,
    }}
    if color[3] < 1:
        result["alphaMode"] = "BLEND"
    return result


def write_glb(filename, outline, panels):
    back, front = -.34, .38
    lining = [face for polygon in panels for face in panel(polygon, back)]
    glass = [face for polygon in panels for face in panel(polygon, front)]
    sides = []
    for a, b in zip(outline, outline[1:] + outline[:1]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = hypot(dx, dy)
        edge = (dy * .075 / length, -dx * .075 / length)
        outer_a, outer_b = [(p[0] + edge[0], p[1] + edge[1]) for p in (a, b)]
        inner_a, inner_b = [(p[0] - edge[0], p[1] - edge[1]) for p in (a, b)]
        sides.extend(quad((*outer_a, back), (*outer_b, back), (*outer_b, front), (*outer_a, front)))
        sides.extend(quad((*outer_a, front), (*outer_b, front), (*inner_b, front), (*inner_a, front)))

    doc = {"asset": {"version": "2.0"}, "scene": 0, "scenes": [{"nodes": [0, 1, 2]}],
           "nodes": [], "meshes": [], "accessors": [], "bufferViews": [], "materials": [
               material("Dark satin lining", [.026, .043, .061, 1], .74),
               material("Machined housing", [.12, .21, .29, 1], .48),
               material("Translucent inspection cover", [.03, .13, .20, .19], .38),
           ]}
    binary = bytearray()
    for index, (name, triangles) in enumerate([
        ("Interior lining", lining), ("Housing and rim", sides), ("Translucent cover", glass),
    ]):
        count = len(triangles) * 3
        vertices = [point for triangle in triangles for point in triangle]
        normals = [normal(*triangle) for triangle in triangles for _ in range(3)]
        for values in (vertices, normals):
            start = len(binary)
            for value in values:
                binary.extend(pack("<3f", *value))
            view = len(doc["bufferViews"])
            doc["bufferViews"].append({"buffer": 0, "byteOffset": start, "byteLength": len(binary) - start})
            accessor = {"bufferView": view, "componentType": 5126, "count": count, "type": "VEC3"}
            if values is vertices:
                accessor.update(min=[min(p[i] for p in values) for i in range(3)],
                                max=[max(p[i] for p in values) for i in range(3)])
            doc["accessors"].append(accessor)
        doc["nodes"].append({"name": name, "mesh": index})
        doc["meshes"].append({"primitives": [{
            "attributes": {"POSITION": index * 2, "NORMAL": index * 2 + 1}, "material": index,
        }]})

    doc["buffers"] = [{"byteLength": len(binary)}]
    gltf = json.dumps(doc, separators=(",", ":")).encode()
    gltf += b" " * (-len(gltf) % 4)
    header = pack("<4sII", b"glTF", 2, 28 + len(gltf) + len(binary))
    Path(__file__).with_name(filename).write_bytes(
        header + pack("<I4s", len(gltf), b"JSON") + gltf + pack("<I4s", len(binary), b"BIN\x00") + binary,
    )


if __name__ == "__main__":
    junction = [(-3.2, -1.48), (-1.56, -1.48), (.64, -.54), (3.2, -.54), (3.2, .54),
                (.64, .54), (-1.56, 1.48), (-3.2, 1.48), (-3.2, .58), (-1.56, .58),
                (-1.56, -.58), (-3.2, -.58)]
    write_glb("junction.glb", junction, [[junction[i] for i in indices] for indices in (
        (0, 1, 10, 11), (1, 2, 5, 6), (2, 3, 4, 5), (6, 7, 8, 9),
    )])

    chamber = [(-3.22, -.45), (-2.54, -.45), (-1.91, -1.30), (-1.67, -1.52), (1.55, -1.52),
               (2.00, -1.23), (2.60, -.48), (3.22, -.48), (3.22, .48), (2.60, .48), (2.00, 1.23),
               (1.55, 1.52), (-1.67, 1.52), (-1.91, 1.30), (-2.54, .45), (-3.22, .45)]
    write_glb("recirculation.glb", chamber,
              [[(0, 0), a, b] for a, b in zip(chamber, chamber[1:] + chamber[:1])])
