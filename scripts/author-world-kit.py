# Authors the Tumbleworks world kit in Blender: storybook mechanical village templates and
# marble-run mechanism parts. Rebuilds assets/world-3d/village-kit.blend, public/models/world-kit.glb,
# public/models/world-kit.json (compact runtime format, see assets/world-3d/README.md) and the
# review sheet output/current/world-3d/kit-review.png. Run from the repository root:
#   '/mnt/d/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --threads 2 \
#       --python "$(wslpath -w scripts/author-world-kit.py)"
# Append -- --skip-review to preserve existing preview images during a geometry-only rebuild.
# Authoring space is Blender Z-up with the front of each template facing -Y; the exports convert
# to Three.js Y-up as (x, z, -y). Every template stands on z = 0, centred on the origin.
import bmesh, bpy, gzip, json, math, os, sys
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Append -- --stage <dir> to write every output (blend, GLB, JSON, stats, reviews) under one staging
# directory instead of the live asset paths; integration then copies the reviewed files into place.
STAGE = sys.argv[sys.argv.index('--stage') + 1] if '--stage' in sys.argv else None
BLEND = os.path.join(STAGE, 'village-kit.blend') if STAGE else os.path.join(ROOT, 'assets', 'world-3d', 'village-kit.blend')
GLB = os.path.join(STAGE, 'world-kit.glb') if STAGE else os.path.join(ROOT, 'public', 'models', 'world-kit.glb')
JSON_OUT = os.path.join(STAGE, 'world-kit.json') if STAGE else os.path.join(ROOT, 'public', 'models', 'world-kit.json')
STATS = os.path.join(STAGE, 'kit-stats.json') if STAGE else os.path.join(ROOT, 'assets', 'world-3d', 'kit-stats.json')
REVIEW = os.path.join(STAGE, 'kit-review.png') if STAGE else os.path.join(ROOT, 'output', 'current', 'world-3d', 'kit-review.png')
# Templates kept editable in the .blend and the GLB but left out of the packed runtime file. The audit
# found no scene, plan or reward composition referencing them: the Mill village drives the compiler's
# own bucket wheel from the mill's axle bracket, and no plan uses the static helix channel.
RUNTIME_RETIRED = {'mechanism-spiral', 'mill-rotor'}
GRID = 0.004          # authoring snap; keeps quantized coordinates low-entropy
POSITION_SCALE = 250  # 1 / GRID
TAU = math.tau

# ---------------------------------------------------------------- palette (sRGB hex, converted once)
PALETTE_SRGB = {
    'cream': 0xf3e3c3, 'plaster': 0xe9d9c0, 'timber': 0x5a3d2b, 'oak': 0x9a6f4c, 'pine': 0xc49a6c,
    'terracotta': 0xc8694a, 'teal': 0x4f8a86, 'slate': 0x5f6f8f, 'copper': 0xb8724f, 'brass': 0xd4a84b,
    'iron': 0x4a5058, 'steel': 0x8a939c, 'stone': 0x9fa8a3, 'stone_dark': 0x76807c, 'mortar': 0xc5c9bf,
    'window': 0x2f4d5a, 'glass': 0xbfe3df, 'leaf': 0x4f8f5c, 'leaf_light': 0x72a865, 'leaf_dark': 0x3b6e4a,
    'trunk': 0x6b4a33, 'hull': 0xd9534f, 'hull_dark': 0x8f2f2d, 'deck': 0xd8b98a, 'white': 0xf6f1e6,
    'red': 0xd5473b, 'rope': 0xd8c7a1, 'water': 0x4e9ba4, 'gold': 0xf2cf6b, 'face': 0xfbf4df, 'dark': 0x2a2e33,
}
def srgb_to_linear(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
PALETTE = {k: tuple(round(srgb_to_linear((v >> s) & 255), 5) for s in (16, 8, 0)) for k, v in PALETTE_SRGB.items()}
PALETTE_SRGB_F = {k: tuple(((v >> s) & 255) / 255.0 for s in (16, 8, 0)) for k, v in PALETTE_SRGB.items()}  # the bmesh byte layer stores sRGB
PALETTE_INDEX = {k: i for i, k in enumerate(PALETTE)}

def snap(v): return round(round(v / GRID) * GRID, 6)

# ---------------------------------------------------------------- mesh builder
class Build:
    """Accumulates coloured pieces into one bmesh. Pieces are built in local space and placed with a matrix."""
    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new('Color')
        self.glass = self.bm.faces.layers.int.new('glass')  # 1 on faces that take the glass material slot

    def add(self, piece, color, matrix=Matrix.Identity(4), glass=False, bevel=0.0, segments=1):
        """piece: a bmesh in local space; copies its geometry in, coloured and transformed."""
        if bevel > 0:
            bmesh.ops.bevel(piece, geom=[e for e in piece.edges if e.calc_face_angle(0) > 0.3], offset=bevel,
                            segments=segments, profile=0.7, affect='EDGES', clamp_overlap=True)
        piece.transform(matrix)
        piece.verts.index_update()  # hand-built pieces have no indices until asked
        for v in piece.verts: v.co = Vector((snap(v.co.x), snap(v.co.y), snap(v.co.z)))
        rgb = PALETTE_SRGB_F[color]
        count = len(self.bm.verts)
        verts = [self.bm.verts.new(v.co) for v in piece.verts]
        for f in piece.faces:
            try:
                nf = self.bm.faces.new([verts[v.index] for v in f.verts])
            except ValueError:
                continue
            nf.smooth = False
            for loop in nf.loops: loop[self.col] = (*rgb, 1.0)
            nf[self.glass] = 1 if glass else 0
        piece.free()

    def box(self, w, d, h, color, x=0, y=0, z=0, bevel=0.0, rz=0.0, glass=False, ry=0.0, rx=0.0, open_faces=()):
        """Box with its base centre at (x, y, z); z is up."""
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
        # Flush timber joints share the neighbouring member's solid volume; omit buried caps.
        if open_faces:
            bm.normal_update()
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if any(f.normal[axis] * sign > 0.9 for axis, sign in open_faces)], context='FACES_ONLY')
        bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts); bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
        m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')
        self.add(bm, color, m, glass=glass, bevel=bevel)

    def cbox(self, w, d, h, color, matrix, bevel=0.0):
        """Box centred on its own origin, placed by matrix."""
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
        self.add(bm, color, matrix, bevel=bevel)

    def cylinder(self, r, h, color, x=0, y=0, z=0, segments=12, axis='Z', r2=None, bevel=0.0, glass=False):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r, radius2=r if r2 is None else r2, depth=h)
        rot = {'Z': Matrix.Identity(4), 'X': Matrix.Rotation(math.pi / 2, 4, 'Y'), 'Y': Matrix.Rotation(math.pi / 2, 4, 'X')}[axis]
        self.add(bm, color, Matrix.Translation((x, y, z)) @ rot, bevel=bevel, glass=glass)

    def prism(self, points, depth, color, matrix=Matrix.Identity(4), axis='Y', bevel=0.0, glass=False):
        """Extrudes a closed 2D polygon (in the XZ plane when axis is Y, centred along the axis) by depth."""
        bm = bmesh.new()
        if axis == 'Y': verts = [bm.verts.new((px, -depth / 2, pz)) for px, pz in points]
        else: verts = [bm.verts.new((-depth / 2, px, pz)) for px, pz in points]
        f = bm.faces.new(verts)
        res = bmesh.ops.extrude_face_region(bm, geom=[f])
        moved = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0, depth, 0) if axis == 'Y' else (depth, 0, 0), verts=moved)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        self.add(bm, color, matrix, bevel=bevel, glass=glass)

    def sweep(self, profile, frames, color, cap=True, matrix=Matrix.Identity(4)):
        """Sweeps a closed 2D profile (u, v) through frames [(origin, u_axis, v_axis)]; profile edges connect in order."""
        bm = bmesh.new(); rings = []
        for o, u, v in frames:
            rings.append([bm.verts.new(o + u * pu + v * pv) for pu, pv in profile])
        n = len(profile)
        for a, b in zip(rings, rings[1:]):
            for i in range(n):
                bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
        if cap:
            bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        self.add(bm, color, matrix)

    def lathe(self, profile, color, segments=16, x=0, y=0, z=0, closed=True, phase=0.0):
        """Revolves a closed (r, z) polygon around the local Z axis; r must stay > 0 for a clean ring."""
        bm = bmesh.new(); rings = []
        for i in range(segments):
            a = TAU * i / segments + phase; c, s = math.cos(a), math.sin(a)
            rings.append([bm.verts.new((r * c, r * s, pz)) for r, pz in profile])
        n = len(profile)
        for i in range(segments):
            a, b = rings[i], rings[(i + 1) % segments]
            for j in range(n if closed else n - 1):
                k = (j + 1) % n
                if profile[j][0] == 0 and profile[k][0] == 0: continue
                bm.faces.new((a[j], b[j], b[k], a[k]))
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        self.add(bm, color, Matrix.Translation((x, y, z)))

    def icosphere(self, r, color, x=0, y=0, z=0, sz=1.0, subdivisions=1):
        bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=r)
        self.add(bm, color, Matrix.Translation((x, y, z)) @ Matrix.Diagonal((1, 1, sz, 1)))

    def finish(self, name, parent=None, origin=(0, 0, 0)):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-6)
        mesh = bpy.data.meshes.new(name)
        self.bm.verts.index_update(); self.bm.faces.index_update()
        for f in self.bm.faces: f.material_index = f[self.glass]
        self.bm.to_mesh(mesh); self.bm.free()
        mesh.color_attributes.active_color = mesh.color_attributes['Color']; mesh.color_attributes.render_color_index = 0
        mesh.materials.append(SOLID); mesh.materials.append(GLASS)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        if parent is not None:
            obj.parent = parent
            obj.location = origin
        return obj

# ---------------------------------------------------------------- shared shapes
def U_PROFILE(width, depth, wall):
    """Open channel cross-section in (u, v): u across, v up. Outer bottom at v = 0."""
    hw = width / 2
    return [(-hw, 0), (hw, 0), (hw, depth), (hw - wall, depth), (hw - wall, wall), (-hw + wall, wall), (-hw + wall, depth), (-hw, depth)]

def frames_line(a, b, up=Vector((0, 0, 1))):
    d = (b - a).normalized(); u = d.cross(up).normalized(); v = u.cross(d).normalized()
    return [(a, u, v), (b, u, v)]

def roof_profile(half_span, pitch_height, thickness, overhang):
    """Thick chevron: a pitched roof slab seen end-on, apex at (0, pitch_height), eaves overhanging the span."""
    s = half_span + overhang
    slope = pitch_height / half_span
    drop = overhang * slope
    return [(-s, -drop), (0, pitch_height), (s, -drop), (s, -drop + thickness), (0, pitch_height + thickness), (-s, -drop + thickness)]

def arch_ring(radius, thickness, segments=8):
    outer = [(math.cos(TAU / 2 * i / segments) * (radius + thickness), math.sin(TAU / 2 * i / segments) * (radius + thickness)) for i in range(segments + 1)]
    inner = [(math.cos(TAU / 2 * i / segments) * radius, math.sin(TAU / 2 * i / segments) * radius) for i in reversed(range(segments + 1))]
    return outer + inner

def gear_profile(teeth, r_in, r_out):
    pts = []
    for i in range(teeth):
        a0 = TAU * i / teeth; step = TAU / teeth
        for frac, r in ((0.0, r_in), (0.2, r_in), (0.3, r_out), (0.6, r_out), (0.7, r_in)):
            a = a0 + frac * step; pts.append((math.cos(a) * r, math.sin(a) * r))
    return pts

# ---------------------------------------------------------------- template details
def windows(b, wall_face_y, positions, w=0.34, h=0.42, frame='timber', wall_thick=0.04):
    """Recessed window: pane flush with the wall, thick frame and sill standing proud, lintel above."""
    for x, z in positions:
        y = wall_face_y
        b.box(w, 0.03, h, 'window', x, y - 0.015, z)                      # pane
        # Jambs end at the lintel; the crossbar ends at the vertical mullion.
        b.box(0.06, wall_thick * 2.5, h + 0.04, frame, x - w / 2 - 0.03, y - 0.05, z - 0.04, open_faces=((2, 1),))
        b.box(0.06, wall_thick * 2.5, h + 0.04, frame, x + w / 2 + 0.03, y - 0.05, z - 0.04, open_faces=((2, 1),))
        b.box(w + 0.12, wall_thick * 2.5, 0.06, frame, x, y - 0.05, z + h)
        b.box(w + 0.2, 0.14, 0.06, 'pine', x, y - 0.07, z - 0.08)          # sill
        # Mullions sit four snap cells in front of the pane, below the outer frame.
        b.box(0.03, 0.02, h, frame, x, y - 0.036, z)
        for side in (-1, 1):
            b.box((w - 0.032) / 2, 0.02, 0.03, frame, x + side * (w + 0.032) / 4, y - 0.036, z + h / 2, open_faces=((0, -side),))

def door(b, wall_face_y, x, width=0.46, height=0.74, frame='timber', leaf='oak', leaf_offset=0.015, frame_depth=0.1):
    y = wall_face_y
    b.box(width, 0.03, height, leaf, x, y - leaf_offset, 0.02)
    b.box(0.05, 0.03, 0.06, 'brass', x + width / 2 - 0.1, y - 0.03, 0.42)
    b.box(0.06, frame_depth, height - 0.008, frame, x - width / 2 - 0.03, y - 0.05, 0.008)
    b.box(0.06, frame_depth, height - 0.008, frame, x + width / 2 + 0.03, y - 0.05, 0.008)
    b.prism(arch_ring(width / 2 + 0.0, 0.06), frame_depth, frame, Matrix.Translation((x, y - 0.05, height)))
    # curved doorstep: half disc, bevelled
    bm = bmesh.new(); pts = [(math.cos(math.pi * i / 8) * (width / 2 + 0.22), -math.sin(math.pi * i / 8) * (width / 2 + 0.22)) for i in range(9)]
    # Trim buried feet above the plinth underside without moving the step's top.
    verts = [bm.verts.new((px, py, 0.004)) for px, py in pts]
    f = bm.faces.new(verts); res = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=(0, 0, 0.096), verts=[g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    b.add(bm, 'stone', Matrix.Translation((x, y, 0)), bevel=0.03)

def timber_frame(b, w, d, h, face_y, color='timber'):
    """Horizontal beams and diagonal braces on the front wall, posts at the corners of the whole body."""
    t = 0.07
    # Beams fit between the corner posts rather than doubling their front faces.
    for z in (0.0, h * 0.5, h - t):
        foot = 0.008 if z == 0 else 0
        b.box(w - 2 * t + 0.016, 0.06, t - foot, color, 0, face_y - 0.02, z + foot)
    # The outer timber faces must clear the plaster after snapping to the 4 mm grid.
    for x in (-w / 2 + t / 2 - 0.008, w / 2 - t / 2 + 0.008):
        for y in (-d / 2 + t / 2 - 0.02, d / 2 - t / 2 + 0.02):
            b.box(t, t, h - 0.008, color, x, y, 0.008)
    for y in (-d / 2 + t / 2 - 0.012, d / 2 - t / 2 + 0.012):
        b.box(w + 0.04, t, 0.05, color, 0, y, h * 0.5)
    # Brace faces sit inside the post and beam faces after 4 mm snapping.
    for sx in (-1, 1):
        b.box(0.06, 0.034, 0.5, color, sx * (w / 2 - 0.22), face_y - 0.025, h * 0.5 + 0.02, ry=sx * 0.6)

def chimney(b, x, y, z, color='stone'):
    b.box(0.28, 0.28, 0.75, color, x, y, z, bevel=0.02)
    b.box(0.36, 0.36, 0.08, 'stone_dark', x, y, z + 0.72)
    b.box(0.14, 0.14, 0.12, 'dark', x, y, z + 0.8)

# ---------------------------------------------------------------- templates
def house_a():
    b = Build(); w, d, h = 1.8, 1.6, 1.25
    b.box(w + 0.3, d + 0.3, 0.14, 'stone', 0, 0, 0, bevel=0.03)              # plinth
    b.box(w, d, h, 'cream', 0, 0, 0.1, bevel=0.04)                            # body
    timber_frame(b, w, d, h, -d / 2 + 0.03)
    windows(b, -d / 2, [(-0.5, 0.65), (0.5, 0.65)])
    windows(b, -d / 2, [(0.5, 0.2)], w=0.3, h=0.3)
    # The tall leaf overlaps the window corner; its face must remain in front of the pane.
    door(b, -d / 2, -0.5, leaf_offset=0.023, frame_depth=0.116)
    # side windows
    b.box(0.03, 0.3, 0.4, 'window', -w / 2 - 0.0, 0.1, 0.7)
    b.box(0.03, 0.3, 0.4, 'window', w / 2 + 0.0, 0.1, 0.7)
    for sx in (-1, 1):
        b.box(0.1, 0.42, 0.06, 'timber', sx * (w / 2 + 0.02), 0.1, 1.1); b.box(0.1, 0.42, 0.06, 'timber', sx * (w / 2 + 0.02), 0.1, 0.66)
    # upper storey gable in plaster inside the roof
    b.prism(roof_profile(w / 2 + 0.1, 0.9, 0.16, 0.22), d + 0.5, 'terracotta', Matrix.Translation((0, 0, h + 0.1)))
    b.prism([(-w / 2 - 0.02, 0), (w / 2 + 0.02, 0), (0, 0.88)], d - 0.02, 'plaster', Matrix.Translation((0, 0, h + 0.1)))
    b.box(w * 0.9, 0.06, 0.05, 'timber', 0, -d / 2 - 0.0, h + 0.5)
    b.box(0.26, 0.03, 0.3, 'window', 0, -d / 2 - 0.0, h + 0.3)
    b.box(0.34, 0.08, 0.05, 'timber', 0, -d / 2 - 0.02, h + 0.6); b.box(0.34, 0.08, 0.05, 'timber', 0, -d / 2 - 0.02, h + 0.26)
    b.box(0.14, d + 0.56, 0.1, 'oak', 0, 0, h + 1.0, bevel=0.02)           # ridge beam
    chimney(b, 0.55, 0.3, h + 0.5)
    return b.finish('house-a')

def house_b():
    b = Build(); w, d, h = 1.5, 1.7, 1.75
    b.box(w + 0.26, d + 0.26, 0.12, 'stone_dark', 0, 0, 0, bevel=0.03)
    b.box(w, d, h, 'plaster', 0, 0, 0.08, bevel=0.04)
    timber_frame(b, w, d, h, -d / 2 + 0.03, color='oak')
    windows(b, -d / 2, [(-0.38, 1.15), (0.38, 1.15), (0.4, 0.55)], frame='oak')
    door(b, -d / 2, -0.38, frame='oak', leaf='teal')
    b.box(0.03, 0.3, 0.4, 'window', -w / 2, 0.15, 1.1); b.box(0.03, 0.3, 0.4, 'window', w / 2, 0.15, 1.1)
    # gable runs along x: roof profile in the YZ plane
    b.prism(roof_profile(d / 2 + 0.05, 0.95, 0.16, 0.24), w + 0.5, 'teal', Matrix.Translation((0, 0, h + 0.08)), axis='X')
    b.prism([(-d / 2, 0), (d / 2, 0), (0, 0.93)], w - 0.02, 'cream', Matrix.Translation((0, 0, h + 0.08)), axis='X')
    b.box(w + 0.56, 0.14, 0.1, 'timber', 0, 0, h + 1.03, bevel=0.02)
    # dormer window on the front slope
    b.box(0.5, 0.5, 0.42, 'plaster', 0, -d / 2 - 0.0, h + 0.33)
    b.box(0.26, 0.03, 0.26, 'window', 0, -d / 2 - 0.26, h + 0.4)
    b.prism(roof_profile(0.3, 0.22, 0.1, 0.08), 0.62, 'teal', Matrix.Translation((0, -d / 2 - 0.0, h + 0.75)))
    chimney(b, -0.45, 0.25, h + 0.6, color='stone_dark')
    return b.finish('house-b')

def tree_a():
    b = Build()
    b.cylinder(0.15, 0.95, 'trunk', 0, 0, 0.45, segments=7, r2=0.1)
    b.cylinder(0.3, 0.1, 'leaf_dark', 0, 0, 0.0, segments=7, r2=0.14)   # root flare
    b.icosphere(0.74, 'leaf', 0, 0, 1.25, sz=0.78)
    b.icosphere(0.56, 'leaf_light', 0.24, -0.16, 1.78, sz=0.82)
    b.icosphere(0.42, 'leaf_dark', -0.34, 0.26, 1.5, sz=0.9)
    b.icosphere(0.3, 'leaf_light', -0.1, -0.4, 1.95, sz=0.9)
    return b.finish('tree-a')

def paddle_wheel(radius, width, color_rim='oak', color_paddle='pine', paddles=8, hub='iron'):
    """Rotor geometry centred on its axle. The axle runs along Blender Y (Three Z), so the wheel faces the
    game camera and spins about its local Three z axis."""
    b = Build(); rim = 0.1
    for side in (-1, 1):
        y = side * (width / 2 - 0.03)
        for half in (0, math.pi):
            b.prism(arch_ring(radius - rim, rim, 8), 0.06, color_rim, Matrix.Translation((0, y, 0)) @ Matrix.Rotation(half, 4, 'Y'))
        for i in range(4):
            # Recess the crossing spokes behind the rim on distinct real planes.
            b.cbox(0.07, 0.044 - i * 0.008, (radius - rim) * 2, color_rim, Matrix.Translation((0, y, 0)) @ Matrix.Rotation(TAU * i / 8, 4, 'Y'))
    for i in range(paddles):
        m = Matrix.Rotation(TAU * i / paddles + TAU / 16, 4, 'Y') @ Matrix.Translation((0, 0, radius - 0.17))
        b.cbox(0.04, width - 0.14, 0.3, color_paddle, m)
        b.cbox(0.12, width - 0.148, 0.04, color_paddle, m @ Matrix.Translation((0.04, 0, -0.17)))  # lip that catches the marble
    b.cylinder(0.08, width + 0.3, hub, 0, 0, 0, segments=8, axis='Y')
    for side in (-1, 1): b.cylinder(0.2, 0.1, hub, 0, side * (width / 2 - 0.03), 0, segments=8, axis='Y')
    return b

def mill():
    b = Build(); w, d, h = 1.9, 1.8, 1.4; bx = -0.45
    b.box(w + 0.3, d + 0.3, 0.14, 'stone_dark', bx, 0, 0, bevel=0.03)
    b.box(w, d, h, 'stone', bx, 0, 0.1, bevel=0.04)
    for z in (0.35, 0.75, 1.15):                                            # stone courses
        b.box(w + 0.04, d + 0.04, 0.04, 'mortar', bx, 0, z)
    windows(b, -d / 2, [(bx - 0.5, 0.7), (bx + 0.5, 0.7)], w=0.3, h=0.36, frame='oak')
    door(b, -d / 2, bx, frame='oak', leaf='pine')
    b.prism(roof_profile(w / 2 + 0.1, 0.8, 0.16, 0.22), d + 0.5, 'terracotta', Matrix.Translation((bx, 0, h + 0.1)))
    b.prism([(-w / 2, 0), (w / 2, 0), (0, 0.78)], d - 0.02, 'plaster', Matrix.Translation((bx, 0, h + 0.1)))
    b.box(0.14, d + 0.56, 0.1, 'oak', bx, 0, h + 0.9, bevel=0.02)
    chimney(b, bx - 0.55, 0.3, h + 0.55, color='stone_dark')
    # wheel on the +x gable side, in front of the wall so the whole disc shows; axle bracket, chute and pit
    wx = w / 2 + bx + 0.62
    b.box(0.5, 0.12, 1.2, 'timber', wx, 0.42, 0.1); b.box(0.5, 0.12, 1.2, 'timber', wx, -0.42, 0.1)
    b.box(0.55, 0.12, 0.12, 'timber', wx - 0.525, 0.42, 1.2); b.box(0.55, 0.12, 0.12, 'timber', wx - 0.525, -0.42, 1.2)  # ties back to the wall
    b.cylinder(0.07, 1.0, 'iron', wx, 0, 1.05, segments=8, axis='Y')
    chute = U_PROFILE(0.36, 0.16, 0.04)
    b.sweep(chute, frames_line(Vector((wx - 0.9, -0.6, 2.25)), Vector((wx + 0.25, -0.6, 1.95))), 'pine')
    b.box(0.08, 0.08, 1.9, 'timber', wx + 0.2, -0.6, 0)
    b.box(2.0, 1.0, 0.152, 'stone_dark', wx, 0, 0.008, bevel=0.03)             # wheel pit kerb
    mill_obj = b.finish('mill')
    rotor = paddle_wheel(0.92, 0.5)
    rotor.finish('mill-rotor', parent=mill_obj, origin=(wx, 0, 1.05))
    return mill_obj

def clock():
    b = Build(); s = 1.3
    b.box(s + 0.4, s + 0.4, 0.14, 'stone', 0, 0, 0, bevel=0.03)
    b.box(s, s, 3.0, 'plaster', 0, 0, 0.1, bevel=0.05)
    for z in (1.0, 2.0): b.box(s + 0.08, s + 0.08, 0.1, 'stone', 0, 0, z)
    door(b, -s / 2, 0, width=0.5, height=0.8, frame='timber', leaf='slate')
    windows(b, -s / 2, [(0, 1.3), (0, 2.1)], w=0.26, h=0.4)
    for sx in (-1, 1):
        b.box(0.03, 0.26, 0.4, 'window', sx * s / 2, 0, 1.4); b.box(0.03, 0.26, 0.4, 'window', sx * s / 2, 0, 2.2)
    # clock housing: wider band with the face on the front
    b.box(s + 0.3, s + 0.3, 0.9, 'cream', 0, 0, 3.1, bevel=0.04)
    for z in (3.1, 3.95): b.box(s + 0.4, s + 0.4, 0.07, 'timber', 0, 0, z)
    b.cylinder(0.42, 0.06, 'brass', 0, -(s + 0.3) / 2 - 0.0, 3.55, segments=20, axis='Y')
    b.cylinder(0.36, 0.08, 'face', 0, -(s + 0.3) / 2 - 0.0, 3.55, segments=20, axis='Y')
    for i in range(12):
        a = TAU * i / 12
        b.box(0.04, 0.03, 0.08 if i % 3 == 0 else 0.05, 'dark', math.sin(a) * 0.3, -(s + 0.3) / 2 - 0.08, 3.55 + math.cos(a) * 0.3 - 0.03, ry=-a)
    b.cylinder(0.12, 0.3, 'brass', 0, (s + 0.3) / 2 + 0.0, 3.55, segments=8, axis='Y')       # bell housing at the back
    # roof: steep pyramid with a finial
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=4, radius1=(s + 0.5) / math.sqrt(2) * 1.0, radius2=0.05, depth=1.1)
    b.add(bm, 'slate', Matrix.Translation((0, 0, 4.55)) @ Matrix.Rotation(math.pi / 4, 4, 'Z'))
    b.cylinder(0.05, 0.4, 'brass', 0, 0, 5.1, segments=6); b.icosphere(0.1, 'gold', 0, 0, 5.3)
    obj = b.finish('clock')
    hand = Build()
    hand.box(0.05, 0.03, 0.3, 'dark', 0, -0.02, -0.06)
    hand.box(0.05, 0.03, 0.196, 'dark', 0.024, -0.02, -0.05, rz=0, ry=math.pi / 2)
    hand.cylinder(0.05, 0.04, 'brass', 0, -0.02, 0, segments=8, axis='Y')
    hand.finish('clock-hand', parent=obj, origin=(0, -(s + 0.3) / 2 - 0.04, 3.55))
    return obj

def greenhouse():
    b = Build(); w, d, h, ridge = 2.8, 2.2, 1.1, 0.8
    b.box(w + 0.2, d + 0.2, 0.3, 'stone', 0, 0, 0, bevel=0.03)
    b.box(w - 0.024, d - 0.024, 0.35, 'mortar', 0, 0, 0.28)
    posts_x = [-w / 2 + 0.04 + i * (w - 0.08) / 4 for i in range(5)]
    for x in posts_x:
        b.box(0.08, 0.08, h, 'white', x, -d / 2 + 0.04, 0.6); b.box(0.08, 0.08, h, 'white', x, d / 2 - 0.04, 0.6)
        # rafters up both slopes
        for sy in (-1, 1):
            L = math.hypot(d / 2, ridge)
            b.box(0.07, L, 0.07, 'white', x, sy * d / 4, 0.6 + h + ridge / 2, rx=-sy * math.atan2(ridge, d / 2))
    for y in (-d / 2 + 0.04, d / 2 - 0.04):
        for left, right in zip(posts_x, posts_x[1:]):
            b.box(right - left - 0.08, 0.08, 0.08, 'white', (left + right) / 2, y, 0.6 + h - 0.08)
    for x in (-w / 2 + 0.04, w / 2 - 0.04):
        b.box(0.08, d - 0.16, 0.08, 'white', x, 0, 0.6 + h - 0.08); b.box(0.08, 0.08, h - 0.08, 'white', x, 0, 0.6)
        b.box(0.08, 0.08, ridge, 'white', x, 0, 0.6 + h)
    b.box(w + 0.1, 0.1, 0.1, 'teal', 0, 0, 0.6 + h + ridge, bevel=0.02)   # ridge cap
    # single-sided glass panes: outward-facing quads only
    def pane(verts, normal_out):
        bm = bmesh.new(); vs = [bm.verts.new(v) for v in verts]; f = bm.faces.new(vs)
        f.normal_update()
        if f.normal.dot(normal_out) < 0: f.normal_flip()
        b.add(bm, 'glass', glass=True)
    # Glass is seated inside the structural frame rather than sharing its outer face.
    glass_w, glass_d = w - 0.016, d - 0.016
    z0, z1 = 0.6, 0.6 + h
    pane([(-glass_w / 2, -glass_d / 2, z0), (glass_w / 2, -glass_d / 2, z0), (glass_w / 2, -glass_d / 2, z1), (-glass_w / 2, -glass_d / 2, z1)], Vector((0, -1, 0)))
    pane([(-glass_w / 2, glass_d / 2, z0), (glass_w / 2, glass_d / 2, z0), (glass_w / 2, glass_d / 2, z1), (-glass_w / 2, glass_d / 2, z1)], Vector((0, 1, 0)))
    for sx in (-1, 1):
        x = sx * glass_w / 2
        pane([(x, -glass_d / 2, z0), (x, glass_d / 2, z0), (x, glass_d / 2, z1), (x, -glass_d / 2, z1)], Vector((sx, 0, 0)))
        pane([(x, -glass_d / 2, z1), (x, glass_d / 2, z1), (x, 0, z1 + ridge)], Vector((sx, 0, 0)))
    for sy in (-1, 1):
        y = sy * glass_d / 2
        pane([(-glass_w / 2, y, z1), (glass_w / 2, y, z1), (glass_w / 2, 0, z1 + ridge), (-glass_w / 2, 0, z1 + ridge)], Vector((0, sy, 0.6)))
    door(b, -d / 2 - 0.008, 0, width=0.44, height=0.9, frame='white', leaf='teal')
    # planters inside and out
    for x in (-0.9, 0.9):
        b.box(0.5, 0.3, 0.25, 'terracotta', x, -d / 2 - 0.35, 0.3, bevel=0.02); b.icosphere(0.2, 'leaf_light', x, -d / 2 - 0.35, 0.65)
    return b.finish('greenhouse')

def bridge():
    b = Build(); L, W, H, r = 4.0, 1.5, 0.95, 1.1
    n = 10
    arch = [(math.cos(math.pi * i / n) * r, math.sin(math.pi * i / n) * r) for i in range(n + 1)]  # from +x over to -x
    poly = [(-L / 2, 0), (-L / 2, H), (-L / 2 + 0.6, H + 0.25), (L / 2 - 0.6, H + 0.25), (L / 2, H), (L / 2, 0)] + arch
    b.prism(poly, W, 'stone', bevel=0.0)
    shadow = [(max(-L / 2 + 0.008, min(L / 2 - 0.008, x)), z) for x, z in poly]
    b.prism(shadow, W - 0.2, 'stone_dark', Matrix.Translation((0, 0, -0.03)))  # inset ends, inner shadow band under the arch
    # parapets with capstones and posts
    for sy in (-1, 1):
        y = sy * (W / 2 - 0.1)
        for i in range(7):
            x = -L / 2 + 0.15 + i * (L - 0.3) / 6
            z = H + 0.25 - abs(x) / (L / 2) * 0.25 * (1 if abs(x) > L / 2 - 0.6 else 0) * 0
            b.box(0.22, 0.22, 0.55, 'stone', x, y, H + 0.2 - max(0, abs(x) - (L / 2 - 0.6)) * 0.4, bevel=0.03)
        b.box(L - 0.3, 0.12, 0.3, 'mortar', 0, y, H + 0.4)
        b.box(L - 0.2, 0.2, 0.08, 'stone_dark', 0, y, H + 0.68, bevel=0.02)
    # One continuous cobble crown, with no coincident copies.
    b.box(L - 1.4, W - 0.6, 0.04, 'mortar', 0, 0, H + 0.25)
    # keystone and voussoir marks
    b.box(0.26, W + 0.04, 0.26, 'mortar', 0, 0, r - 0.05)
    return b.finish('bridge')

def boat():
    b = Build()
    stations = [(-1.5, 0.08, 0.55), (-1.1, 0.5, 0.42), (-0.4, 0.62, 0.38), (0.4, 0.6, 0.38), (1.0, 0.44, 0.44), (1.5, 0.08, 0.72)]  # x, half width, keel depth below deck
    deck_z = 0.7
    bm = bmesh.new(); rings = []
    for x, hw, kd in stations:
        ring = [bm.verts.new((x, -hw, deck_z)), bm.verts.new((x, -hw * 0.9, deck_z - kd * 0.55)), bm.verts.new((x, -hw * 0.35, deck_z - kd)),
                bm.verts.new((x, hw * 0.35, deck_z - kd)), bm.verts.new((x, hw * 0.9, deck_z - kd * 0.55)), bm.verts.new((x, hw, deck_z))]
        rings.append(ring)
    for a, c in zip(rings, rings[1:]):
        for i in range(5): bm.faces.new((a[i], a[i + 1], c[i + 1], c[i]))
    bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bm.faces.new([r[0] for r in rings] + [r[5] for r in reversed(rings)])  # deck
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    b.add(bm, 'hull')
    # waterline band and gunwale
    # Cap the gunwale beyond the hull ends, not on their exposed end planes.
    rim_stations = [(x + (-0.004 if x == -1.5 else 0.004 if x == 1.5 else 0), hw) for x, hw, _ in stations]
    for side in (-1, 1):
        b.sweep([(-0.03, 0), (0.03, 0), (0.03, 0.08), (-0.03, 0.08)],
                [(Vector((x, side * (hw + 0.02), deck_z - 0.04)), Vector((0, 1, 0)), Vector((0, 0, 1))) for x, hw in rim_stations], 'hull_dark', cap=True)
    b.box(2.3, 0.9, 0.06, 'deck', -0.1, 0, deck_z)
    b.box(0.9, 0.7, 0.55, 'cream', -0.55, 0, deck_z + 0.06, bevel=0.03)   # cabin
    b.box(0.26, 0.03, 0.22, 'window', -0.55, -0.35 - 0.0, deck_z + 0.28); b.box(0.26, 0.03, 0.22, 'window', -0.55, 0.35, deck_z + 0.28)
    b.box(0.03, 0.3, 0.22, 'window', -0.1, 0, deck_z + 0.28)
    b.prism(roof_profile(0.42, 0.14, 0.08, 0.08), 1.0, 'teal', Matrix.Translation((-0.55, 0, deck_z + 0.6)), axis='X')
    b.cylinder(0.11, 0.6, 'red', -0.95, 0.15, deck_z + 0.06, segments=10, r2=0.13); b.box(0.3, 0.3, 0.05, 'dark', -0.95, 0.15, deck_z + 0.64)
    b.cylinder(0.05, 1.5, 'oak', 0.5, 0, deck_z + 0.05, segments=6)        # mast
    b.box(0.5, 0.03, 0.26, 'gold', 0.75, 0, deck_z + 1.2)                   # pennant
    b.box(0.08, 0.08, 0.6, 'oak', 1.25, 0, deck_z + 0.04); b.icosphere(0.08, 'brass', 1.25, 0, deck_z + 0.66)
    for x in (-1.0, 0.0, 0.9): b.cylinder(0.14, 0.12, 'oak', x, -0.5, deck_z + 0.2, segments=8, axis='Y')  # fenders
    return b.finish('boat')

def glassworks():
    b = Build()
    b.box(2.0, 2.0, 0.16, 'stone_dark', 0, 0, 0, bevel=0.03)
    b.lathe([(0.85, 0.1), (0.72, 2.6), (0.6, 2.6), (0.7, 0.1)], 'stone', segments=8, phase=TAU / 16)   # tapered octagonal shaft, flat to the front
    for z in (0.9, 1.7): b.lathe([(0.84 - z * 0.05, z), (0.84 - z * 0.05, z + 0.08), (0.7, z + 0.08), (0.7, z)], 'mortar', segments=8, phase=TAU / 16)
    door(b, -0.76, 0, width=0.44, height=0.8, frame='timber', leaf='copper')
    windows(b, -0.71, [(0, 1.5)], w=0.26, h=0.5)
    b.lathe([(1.0, 2.6), (1.0, 2.75), (0.7, 2.75), (0.7, 2.6)], 'copper', segments=8)   # gallery ring
    # lantern: posts and single-sided glass panes around an octagon
    R, z0, z1 = 0.78, 2.75, 3.95
    for i in range(8):
        a0, a1 = TAU * i / 8, TAU * (i + 1) / 8
        p0 = (math.cos(a0) * R, math.sin(a0) * R); p1 = (math.cos(a1) * R, math.sin(a1) * R)
        b.box(0.1, 0.1, z1 - z0, 'copper', p0[0], p0[1], z0, rz=a0)
        bm = bmesh.new(); vs = [bm.verts.new((p0[0], p0[1], z0)), bm.verts.new((p1[0], p1[1], z0)), bm.verts.new((p1[0], p1[1], z1)), bm.verts.new((p0[0], p0[1], z1))]
        f = bm.faces.new(vs)
        if f.normal.dot(Vector((math.cos((a0 + a1) / 2), math.sin((a0 + a1) / 2), 0))) < 0: f.normal_flip()
        b.add(bm, 'glass', glass=True)
    b.lathe([(0.9, z1), (0.9, z1 + 0.12), (0.2, z1 + 0.12), (0.2, z1)], 'copper', segments=8)
    b.lathe([(0.96, z1 + 0.1), (0.05, z1 + 0.95), (0.05, z1 + 0.95), (0.96, z1 + 0.1)], 'copper', segments=8)  # conical roof shell
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=8, radius1=0.98, radius2=0.04, depth=0.9); b.add(bm, 'copper', Matrix.Translation((0, 0, z1 + 0.55)))
    b.cylinder(0.05, 0.4, 'brass', 0, 0, z1 + 0.95, segments=6); b.icosphere(0.09, 'gold', 0, 0, z1 + 1.35)
    # furnace chimney stack beside the tower, with a glowing mouth
    b.cylinder(0.24, 3.4, 'stone_dark', 1.0, 0.6, 0.1, segments=8, r2=0.2); b.cylinder(0.28, 0.14, 'copper', 1.0, 0.6, 3.5, segments=8)
    b.box(0.6, 0.5, 0.6, 'stone', 1.0, 0.0, 0.1, bevel=0.03); b.box(0.3, 0.05, 0.22, 'gold', 1.0, -0.25, 0.2)
    return b.finish('glassworks')

def mechanism_wheel():
    b = Build(); width = 0.9
    for sy in (-1, 1):
        y = sy * (width / 2 + 0.08)
        b.box(0.9, 0.14, 0.12, 'oak', 0, y, 0, bevel=0.02)
        b.box(0.12, 0.1, 1.0, 'timber', -0.3, y, 0.1, ry=0.3); b.box(0.12, 0.092, 1.0, 'timber', 0.3, y, 0.1, ry=-0.3)
        b.box(0.2, 0.16, 0.16, 'iron', 0, y, 1.0)
    b.cylinder(0.06, width + 0.4, 'iron', 0, 0, 1.05, segments=8, axis='Y')
    b.sweep(U_PROFILE(0.36, 0.16, 0.04), frames_line(Vector((-1.0, 0.0, 1.95)), Vector((-0.5, 0.0, 1.9))), 'pine')   # feed chute
    b.box(0.08, 0.08, 1.95, 'timber', -1.0, 0.25, 0); b.box(0.08, 0.08, 1.95, 'timber', -1.0, -0.25, 0)
    b.sweep(U_PROFILE(0.36, 0.16, 0.04), frames_line(Vector((0.6, 0.0, 0.05)), Vector((1.3, 0.0, 0.0))), 'pine')   # outlet channel
    obj = b.finish('mechanism-wheel')
    paddle_wheel(0.82, width, color_rim='oak', color_paddle='steel').finish('rotor', parent=obj, origin=(0, 0, 1.05))
    return obj

def mechanism_spiral():
    b = Build(); R, turns, drop, steps = 0.7, 1.75, 2.0, 40
    frames = []
    for i in range(steps + 1):
        t = i / steps; a = TAU * turns * t
        o = Vector((math.cos(a) * R, math.sin(a) * R, 0.45 + drop * (1 - t)))
        tangent = Vector((-math.sin(a), math.cos(a), -drop / (TAU * turns * R))).normalized()
        u = Vector((math.cos(a), math.sin(a), 0)); v = u.cross(tangent).normalized(); u = tangent.cross(v).normalized()
        frames.append((o, u, v))
    b.sweep(U_PROFILE(0.42, 0.2, 0.04), frames, 'pine')
    b.cylinder(0.16, 0.45 + drop + 0.4, 'iron', 0, 0, 0, segments=8)
    b.cylinder(0.5, 0.1, 'iron', 0, 0, 0, segments=8, r2=0.3)
    for i in range(6):                                                     # brackets from the post to the channel
        t = (i + 0.5) / 6; a = TAU * turns * t
        b.box(R - 0.2, 0.06, 0.06, 'iron', math.cos(a) * (R / 2 + 0.05), math.sin(a) * (R / 2 + 0.05), 0.45 + drop * (1 - t) - 0.06, rz=a)
    b.box(0.3, 0.3, 0.08, 'brass', 0, 0, 0.45 + drop + 0.4)
    return b.finish('mechanism-spiral')

def mechanism_seesaw():
    b = Build()
    b.box(1.0, 0.5, 0.1, 'oak', 0, 0, 0, bevel=0.02)
    for sx in (-1, 1): b.box(0.1, 0.42 if sx < 0 else 0.404, 0.55, 'timber', sx * 0.18, 0, 0.08, ry=-sx * 0.3)
    b.box(0.5, 0.552, 0.1, 'iron', 0, 0, 0.5)
    obj = b.finish('mechanism-seesaw')
    lever = Build()
    lever.box(2.2, 0.36, 0.08, 'pine', 0, 0, 0.0, bevel=0.015)
    lever.cylinder(0.07, 0.56, 'iron', 0, 0, 0.0, segments=8, axis='Y')
    for sx in (-1, 1):
        lever.box(0.06, 0.36, 0.1, 'timber', sx * 1.07, 0, 0.08)
        lever.box(0.44, 0.05, 0.1, 'timber', sx * 0.82, -0.17, 0.08); lever.box(0.44, 0.05, 0.1, 'timber', sx * 0.82, 0.17, 0.08)
    lever.finish('lever', parent=obj, origin=(0, 0, 0.62))
    return obj

def mechanism_channel():
    b = Build()
    b.sweep(U_PROFILE(0.42, 0.2, 0.04), frames_line(Vector((-1.0, 0, 0.3)), Vector((1.0, 0, 0.3))), 'pine')
    for x in (-0.7, 0.7): b.box(0.1, 0.5, 0.3, 'timber', x, 0, 0); b.box(0.12, 0.08, 0.056, 'iron', x, 0, 0.304)
    return b.finish('mechanism-channel')

def mechanism_funnel():
    b = Build()
    b.lathe([(0.6, 1.15), (0.14, 0.45), (0.14, 0.1), (0.2, 0.1), (0.2, 0.42), (0.66, 1.12), (0.66, 1.2), (0.6, 1.2)], 'steel', segments=16)
    for i in range(3):
        a = TAU * i / 3
        b.box(0.06, 0.06, 1.042, 'iron', math.cos(a) * 0.5, math.sin(a) * 0.5, 0.008, rz=a)
    b.lathe([(0.5, 0.0), (0.58, 0.0), (0.58, 0.08), (0.5, 0.08)], 'iron', segments=16)
    return b.finish('mechanism-funnel')

def mechanism_gear():
    b = Build()
    b.prism(gear_profile(12, 0.42, 0.5), 0.14, 'brass', Matrix.Rotation(math.pi / 2, 4, 'X'))
    b.cylinder(0.3, 0.16, 'brass', 0, 0, 0, segments=12, axis='Y')
    b.cylinder(0.08, 0.3, 'iron', 0, 0, 0, segments=8, axis='Y')
    for i in range(4):
        a = TAU * i / 4
        b.box(0.1, 0.12, 0.3, 'brass', math.cos(a) * 0.15, 0, math.sin(a) * 0.15, ry=-a)
    return b.finish('mechanism-gear')

def warehouse():
    """Quayside store: long boarded shed, gable ends on ±x, loading door and hoist on the -Y front."""
    b = Build(); w, d, h = 3.0, 1.7, 1.45
    b.box(w + 0.3, d + 0.3, 0.14, 'stone_dark', 0, 0, 0, bevel=0.03)                 # plinth
    b.box(w, d, h, 'pine', 0, 0, 0.1, bevel=0.03)                                      # boarded body
    for x in (-1.3, -0.7, 0.7, 1.3):                                                   # battens, clear of the door and windows
        b.box(0.07, 0.06, h - 0.04, 'timber', x, -d / 2 - 0.0, 0.12)
        b.box(0.07, 0.06, h - 0.04, 'timber', x, d / 2 + 0.0, 0.12)
    for sx in (-1, 1):                                                                 # corner posts and gable braces
        b.box(0.092, d + 0.06, 0.1, 'timber', sx * (w / 2 - 0.05), 0, h + 0.02)
        for y in (-d / 2 + 0.05 - 0.012, d / 2 - 0.05 + 0.012):
            b.box(0.1, 0.1, h, 'timber', sx * (w / 2 - 0.05 + 0.012), y, 0.1)
    # double loading door, leaves standing proud of the boards, iron straps
    dw, dh = 0.96, 1.08
    for sx in (-1, 1):
        b.box(dw / 2 - 0.02, 0.03, dh, 'teal', sx * (dw / 4 + 0.01), -d / 2 - 0.015, 0.12)
        b.box(dw / 2 - 0.1, 0.02, 0.06, 'iron', sx * (dw / 4 + 0.01), -d / 2 - 0.04, 0.42)
        b.box(dw / 2 - 0.1, 0.02, 0.06, 'iron', sx * (dw / 4 + 0.01), -d / 2 - 0.04, 0.92)
    b.box(0.07, 0.1, dh, 'timber', -dw / 2 - 0.035, -d / 2 - 0.05, 0.1)
    b.box(0.07, 0.1, dh, 'timber', dw / 2 + 0.035, -d / 2 - 0.05, 0.1)
    b.box(dw + 0.14, 0.1, 0.08, 'timber', 0, -d / 2 - 0.05, dh + 0.1)
    windows(b, -d / 2, [(-1.0, 1.0), (1.0, 1.0)], w=0.28, h=0.26)
    # slate roof along x, plaster gables, ridge board
    b.prism(roof_profile(d / 2 + 0.08, 0.72, 0.14, 0.22), w + 0.44, 'slate', Matrix.Translation((0, 0, h + 0.1)), axis='X')
    b.prism([(-d / 2 - 0.02, 0), (d / 2 + 0.02, 0), (0, 0.7)], w - 0.02, 'plaster', Matrix.Translation((0, 0, h + 0.1)), axis='X')
    b.box(w + 0.5, 0.12, 0.08, 'timber', 0, 0, h + 0.84, bevel=0.02)
    # hoist: beam resting on the door lintel under the eaves, pulley, rope and a crate waiting on the quay
    b.box(0.1, 1.0, 0.08, 'oak', 0, -d / 2 - 0.4, dh + 0.18)
    b.cylinder(0.1, 0.06, 'iron', 0, -d / 2 - 0.84, dh + 0.14, segments=8, axis='X')
    b.box(0.025, 0.025, 0.9, 'rope', 0, -d / 2 - 0.84, 0.32)
    b.box(0.44, 0.44, 0.34, 'oak', 0, -d / 2 - 0.84, 0, bevel=0.015)
    b.box(0.46, 0.05, 0.05, 'timber', 0, -d / 2 - 1.065, 0.14); b.box(0.46, 0.05, 0.05, 'timber', 0, -d / 2 - 0.615, 0.14)
    b.cylinder(0.17, 0.4, 'oak', 1.28, -d / 2 - 0.42, 0, segments=10)                    # barrel
    b.cylinder(0.175, 0.04, 'iron', 1.28, -d / 2 - 0.42, 0.1, segments=10); b.cylinder(0.175, 0.04, 'iron', 1.28, -d / 2 - 0.42, 0.28, segments=10)
    return b.finish('warehouse')

def willow():
    """Weeping tree: leaning trunk, a bell-shaped canopy that drops past its branch line, hanging fronds."""
    b = Build()
    b.cylinder(0.3, 0.2, 'trunk', 0, 0, 0, segments=7, r2=0.16)
    b.cylinder(0.16, 1.3, 'trunk', 0.04, 0, 0.18, segments=7, r2=0.1)
    b.cylinder(0.1, 0.5, 'trunk', 0.3, -0.1, 1.2, segments=6, r2=0.06)                 # leaning limb
    # Domed crown from the trunk axis, then a skirt that hangs below the branch line.
    canopy = [(0.08, 2.2), (0.55, 2.12), (1.0, 1.9), (1.3, 1.5), (1.22, 0.85), (1.0, 0.85), (1.06, 1.4), (0.92, 1.7), (0.5, 1.9), (0.08, 1.95)]
    b.lathe(canopy, 'leaf_light', segments=10, phase=TAU / 20)
    b.icosphere(0.5, 'leaf', 0.3, -0.15, 2.0, sz=0.6)
    for i in range(9):                                                                # flat fronds trailing below the skirt
        a = TAU * i / 9 + 0.3
        b.box(0.05, 0.16, 0.55, 'leaf_dark', math.cos(a) * 1.1, math.sin(a) * 1.1, 0.38, rz=a)
    return b.finish('willow')

# ---------------------------------------------------------------- materials
def make_materials():
    solid = bpy.data.materials.new('world-solid'); solid.use_nodes = True
    nodes = solid.node_tree.nodes; bsdf = nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = 0.8
    attr = nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Color'
    solid.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    glass = bpy.data.materials.new('world-glass'); glass.use_nodes = True
    nodes = glass.node_tree.nodes; bsdf = nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = 0.1; bsdf.inputs['Alpha'].default_value = 0.45
    attr = nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Color'
    glass.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    glass.surface_render_method = 'BLENDED'; glass.use_backface_culling = True
    return solid, glass

# ---------------------------------------------------------------- export helpers
def to_three(v): return (v.x, v.z, -v.y)

def compact_mesh(obj, name, model, part=None):
    mesh = obj.data; mesh.calc_loop_triangles()
    col = mesh.color_attributes['Color']
    key_index = {}; positions = []; normals = []; colors = []; indices = []
    for tri in mesh.loop_triangles:
        n = tri.normal
        nq = tuple(int(round(c * 127)) for c in to_three(n))
        for li, vi in zip(tri.loops, tri.vertices):
            c = col.data[li].color
            best = min(PALETTE.items(), key=lambda kv: sum((a - b) ** 2 for a, b in zip(kv[1], c)))[0]
            ci = PALETTE_INDEX[best]
            p = tuple(int(round(c * POSITION_SCALE)) for c in to_three(mesh.vertices[vi].co))
            key = (p, nq, ci)
            idx = key_index.get(key)
            if idx is None:
                idx = len(positions) // 3; key_index[key] = idx
                positions.extend(p); normals.extend(nq); colors.append(ci)
            indices.append(idx)
    entry = {'name': name, 'model': model, 'positions': positions, 'normals': normals, 'colors': colors, 'indices': indices}
    if part:
        entry['part'] = part; entry['pivot'] = [round(c, 4) + 0.0 for c in to_three(Vector(obj.location))]
    return entry, len(mesh.loop_triangles)

def main():
    global SOLID, GLASS
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 2
    SOLID, GLASS = make_materials()
    roots = [f() for f in (house_a, house_b, tree_a, mill, clock, greenhouse, bridge, boat, glassworks,
                           mechanism_wheel, mechanism_spiral, mechanism_seesaw, mechanism_channel, mechanism_funnel, mechanism_gear,
                           warehouse, willow)]
    # readback sanity: the first house wall colour should round-trip through the byte colour attribute
    probe = roots[0].data.color_attributes['Color'].data[0]
    print('COLOR-PROBE linear', tuple(round(c, 3) for c in probe.color[:3]), 'srgb', tuple(round(c, 3) for c in probe.color_srgb[:3]))

    # compact JSON + stats
    meshes = []; stats = {}
    for root in roots:
        entry, tris = compact_mesh(root, root.name, root.name); stats[root.name] = {'triangles': tris}
        if root.name in RUNTIME_RETIRED: stats[root.name]['retired'] = True
        else: meshes.append(entry)
        for child in root.children:
            part = {'rotor': 'rotor', 'lever': 'lever', 'mill-rotor': 'rotor', 'clock-hand': 'hand'}.get(child.name, child.name)
            centry, ctris = compact_mesh(child, child.name if child.name not in ('rotor', 'lever') else f'{root.name}-{child.name}', root.name, part)
            stats[root.name][child.name] = ctris
            if child.name in RUNTIME_RETIRED: stats[root.name][child.name + '-retired'] = True
            else: meshes.append(centry); stats[root.name]['triangles'] += ctris
    stats['runtime-retired'] = sorted(RUNTIME_RETIRED)
    kit = {'version': 1, 'positionScale': POSITION_SCALE, 'normalScale': 127, 'palette': [list(PALETTE[k]) for k in PALETTE],
           'paletteNames': list(PALETTE), 'meshes': meshes}
    os.makedirs(os.path.dirname(JSON_OUT), exist_ok=True); os.makedirs(os.path.dirname(STATS), exist_ok=True)
    text = json.dumps(kit, separators=(',', ':'))
    with open(JSON_OUT, 'w') as f: f.write(text)
    total_tris = sum(len(m['indices']) // 3 for m in meshes)
    # size experiments for the loader owner: scale 100, and without normals (shared by position+colour only)
    def variant(scale, with_normals):
        ms = []
        for m in meshes:
            n = len(m['colors']); remap = {}; pos = []; nrm = []; cols = []; idx = []
            for i in m['indices']:
                p = tuple(int(round(m['positions'][3 * i + k] * scale / POSITION_SCALE)) for k in range(3))
                key = (p, tuple(m['normals'][3 * i:3 * i + 3]) if with_normals else None, m['colors'][i])
                j = remap.get(key)
                if j is None:
                    j = len(cols); remap[key] = j; pos.extend(p); cols.append(m['colors'][i])
                    if with_normals: nrm.extend(m['normals'][3 * i:3 * i + 3])
                idx.append(j)
            ms.append({'positions': pos, 'normals': nrm, 'colors': cols, 'indices': idx})
        t = json.dumps(ms, separators=(',', ':')).encode(); return {'bytes': len(t), 'gzip': len(gzip.compress(t, 9)), 'vertices': sum(len(m['colors']) for m in ms)}
    experiments = {'scale250_normals': variant(250, True), 'scale100_normals': variant(100, True), 'scale250_flat_on_load': variant(250, False), 'scale100_flat_on_load': variant(100, False)}
    stats_out = {'experiments': experiments, 'triangles': total_tris, 'templates': stats, 'json_bytes': len(text), 'json_gzip_bytes': len(gzip.compress(text.encode(), 9)),
                 'vertices': sum(len(m['positions']) // 3 for m in meshes)}

    # GLB: everything at the origin, as authored
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True, export_texcoords=False,
                              export_normals=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                              export_materials='EXPORT', export_yup=True, export_image_format='NONE')
    with open(GLB, 'rb') as f: glb = f.read()
    stats_out['glb_bytes'] = len(glb); stats_out['glb_gzip_bytes'] = len(gzip.compress(glb, 9))
    with open(STATS, 'w') as f: json.dump(stats_out, f, indent=1)
    print('KIT-STATS', json.dumps(stats_out))

    # review grid, contact sheet, editable file
    cols = 5; pitch = 5.2
    for i, root in enumerate(roots):
        root.location = ((i % cols - 2) * pitch, -(i // cols - 1) * pitch, 0)
    for i, root in enumerate(roots):
        label = bpy.data.objects.new(f'label-{root.name}', None); label.empty_display_size = 0.1
        label.location = (root.location.x, root.location.y - 2.2, 0); scene.collection.objects.link(label)
    skip_review = '--skip-review' in sys.argv
    render_review(scene, render=not skip_review)
    cam = scene.camera
    for label, at, target in (('houses', (-6.2, -4.5, 6.5), (-7.8, 5.2, 1.3)), ('mill', (11.5, -2.0, 6.5), (5.6, 5.2, 1.5)), ('mechanisms', (0.0, -21.0, 11.0), (0.0, -5.2, 0.8)), ('harbour-kit', (-6.0, -17.0, 6.0), (-7.8, -10.4, 1.0))):
        cam.location = at; cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = REVIEW.replace('kit-review', f'kit-closeup-{label}')
        if not skip_review: bpy.ops.render.render(write_still=True)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    if STAGE: os.makedirs(STAGE, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups next to the source
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    print('KIT-DONE')

def render_review(scene, render=True):
    cam_data = bpy.data.cameras.new('review-camera'); cam_data.lens = 50
    cam = bpy.data.objects.new('review-camera', cam_data); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = (17, -26, 23)
    # frame the grid: aim at its centre
    target = Vector((0, -0.5, 1.0)); direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    light = bpy.data.lights.new('sun', 'SUN'); light.energy = 3; sun = bpy.data.objects.new('sun', light); scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(15), math.radians(-30))
    ground = bpy.data.meshes.new('ground'); bmg = bmesh.new(); bmesh.ops.create_grid(bmg, x_segments=1, y_segments=1, size=20); bmg.to_mesh(ground); bmg.free()
    g = bpy.data.objects.new('review-ground', ground); g.location = (0, -0.5, -0.02); scene.collection.objects.link(g)
    scene.render.engine = 'BLENDER_WORKBENCH'
    sh = scene.display.shading; sh.light = 'STUDIO'; sh.color_type = 'VERTEX'; sh.show_shadows = True; sh.show_cavity = True
    sh.cavity_type = 'BOTH'; sh.show_object_outline = True; sh.shadow_intensity = 0.35
    scene.display.render_aa = '8'
    scene.render.resolution_x = 1800; scene.render.resolution_y = 1100; scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new('review-world'); scene.world.color = (0.62, 0.72, 0.78)
    os.makedirs(os.path.dirname(REVIEW), exist_ok=True)
    scene.render.filepath = REVIEW; scene.render.image_settings.file_format = 'PNG'
    if render: bpy.ops.render.render(write_still=True)

if __name__ == '__main__':
    try:
        main()
    except Exception:
        import traceback; traceback.print_exc(); sys.exit(1)
