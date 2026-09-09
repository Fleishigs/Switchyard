"""Restricted font and geometry conversions for Switchyard."""
import sys
from pathlib import Path

family, source, target, output = sys.argv[1:]
if family == "font":
    from fontTools.ttLib import TTFont
    if target not in ("woff", "woff2", "sfnt"):
        raise ValueError("Unsupported font output")
    with TTFont(source) as font:
        font.flavor = None if target == "sfnt" else target
        if target == "sfnt":
            output = str(Path(output).with_suffix(".otf" if font.sfntVersion == "OTTO" else ".ttf"))
        font.save(output)
elif family == "mesh":
    import trimesh
    if target not in ("stl", "obj", "ply", "off", "glb"):
        raise ValueError("Unsupported mesh output")
    scene = trimesh.load_scene(source, allow_remote=False)
    if not scene.geometry:
        raise ValueError("The file contains no supported geometry")
    if target == "glb":
        scene.export(output, file_type="glb")
    else:
        mesh = scene.to_mesh()
        mesh.export(output, file_type=target)
else:
    raise ValueError("Unsupported conversion family")
print(output)
