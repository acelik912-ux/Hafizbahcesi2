# Blender (arka planda, GitHub Actions uzerinde) ile kayisi agaci: gercek 3B model + Cycles ile film kalitesine yakin goruntu.
# Kullanim: blender -b -P render_agac.py -- cikti.png
import bpy, bmesh, math, random, sys
from mathutils import Vector
random.seed(11)
OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.samples = 40; scn.cycles.use_denoising = True
scn.render.resolution_x, scn.render.resolution_y = 1080, 1920
scn.view_settings.view_transform = 'Filmic' if 'Filmic' in [i.identifier for i in scn.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Standard'

def mat(name, color, rough=0.5, sss=0.0, coat=0.0, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    for k, v in (('Subsurface Weight', sss), ('Coat Weight', coat)):
        if k in b.inputs: b.inputs[k].default_value = v
    if 'Subsurface Radius' in b.inputs and sss: b.inputs['Subsurface Radius'].default_value = (0.4, 0.5, 0.2)
    return m

# --- dunya: Nishita gokyuzu + gunes
w = bpy.data.worlds.new('W'); scn.world = w; w.use_nodes = True
sky = w.node_tree.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(24); sky.sun_rotation = math.radians(200); sky.sun_size = math.radians(1.6)
w.node_tree.links.new(sky.outputs['Color'], w.node_tree.nodes['Background'].inputs['Color']); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.1

# --- zemin: cimen
bpy.ops.mesh.primitive_plane_add(size=300); g = bpy.context.object; g.name = 'Cimen'
gm = mat('Cimen', (0.10, 0.28, 0.05), 0.9); g.data.materials.append(gm)
nt = gm.node_tree; n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 60; bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.6
nt.links.new(n.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal'])
ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.06, 0.20, 0.03, 1); ramp.color_ramp.elements[1].color = (0.22, 0.42, 0.08, 1)
n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 3; nt.links.new(n2.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])

# --- govde + dallar (egrilmis, ince uca dogru daralan kavisler)
wood = mat('Odun', (0.20, 0.10, 0.05), 0.8)
tips = []
def branch(p, d, L, r, depth):
    pts = [p]; cur = p.copy(); dd = d.copy()
    for k in range(4):
        dd = (dd + Vector((random.uniform(-.25, .25), random.uniform(-.25, .25), random.uniform(0.0, .12)))).normalized()
        cur = cur + dd * (L / 4); pts.append(cur.copy())
    cv = bpy.data.curves.new('b', 'CURVE'); cv.dimensions = '3D'; cv.bevel_depth = r; cv.bevel_resolution = 3; cv.use_fill_caps = True
    sp = cv.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, q in enumerate(pts): sp.points[i].co = (q.x, q.y, q.z, 1); sp.points[i].radius = 1.0 - 0.55 * i / (len(pts) - 1)
    o = bpy.data.objects.new('b', cv); bpy.context.collection.objects.link(o); cv.materials.append(wood)
    if depth == 0: tips.append((cur.copy(), dd.copy())); return
    for k in range(2 if depth > 1 else 3):
        nd = (dd + Vector((random.uniform(-.8, .8), random.uniform(-.8, .8), random.uniform(0.05, .6)))).normalized()
        branch(cur, nd, L * 0.72, r * 0.6, depth - 1)
    tips.append((cur.copy(), dd.copy()))
branch(Vector((0, 0, 0)), Vector((0.05, 0.0, 1)), 1.9, 0.20, 0)       # govde
top = Vector((0.1, 0.0, 1.9))
for s in (-1, 1): branch(top, Vector((s * 0.55, random.uniform(-.2, .2), 1)).normalized(), 1.4, 0.12, 3)

# --- yapraklar: tek mesh, uc yesil tonu
leafm = [mat('Y%d' % i, c, 0.45, 0.25) for i, c in enumerate([(0.10, 0.30, 0.05), (0.16, 0.38, 0.07), (0.24, 0.47, 0.09)])]
me = bpy.data.meshes.new('Yaprak'); bm = bmesh.new()
crown_c = Vector((0.1, 0, 3.7)); crown_r = Vector((2.1, 2.0, 1.7))
def leaf(c, nrm, size):
    nrm = nrm.normalized(); t1 = nrm.cross(Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))).normalized(); t2 = nrm.cross(t1)
    L = size; Wd = size * 0.38
    pts = [c, c + t2 * L * 0.3 + t1 * Wd * 0.8, c + t2 * L * 0.7 + t1 * Wd, c + t2 * L, c + t2 * L * 0.7 - t1 * Wd, c + t2 * L * 0.3 - t1 * Wd * 0.8]
    vs = [bm.verts.new(p) for p in pts]; f = bm.faces.new(vs); f.material_index = random.randrange(3); f.smooth = True
for _ in range(9500):
    u = Vector((random.gauss(0, 1), random.gauss(0, 1), random.gauss(0, 1))).normalized(); rad = random.random() ** 0.4 * 0.5 + 0.5
    c = crown_c + Vector((u.x * crown_r.x, u.y * crown_r.y, u.z * crown_r.z)) * rad
    leaf(c, u + Vector((random.uniform(-.5, .5), random.uniform(-.5, .5), random.uniform(-.5, .5))), random.uniform(0.28, 0.42))
bm.to_mesh(me); bm.free(); lo = bpy.data.objects.new('Yaprak', me); bpy.context.collection.objects.link(lo)
for m in leafm: me.materials.append(m)

# --- meyveler
fm = mat('Kayisi', (0.95, 0.38, 0.06), 0.35, 0.3, 0.25)
for k in range(22):
    u = Vector((random.gauss(0, 1), random.gauss(0, 1), random.gauss(0, .7) - 0.1)).normalized()
    c = crown_c + Vector((u.x * crown_r.x, u.y * crown_r.y, u.z * crown_r.z)) * 0.93
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=random.uniform(0.2, 0.26), location=c); fo = bpy.context.object; fo.scale.z = 0.92; bpy.ops.object.shade_smooth(); fo.data.materials.append(fm)

# --- kamera: agacin altindan, tacin icine dogru bakis
cam = bpy.data.cameras.new('K'); cam.lens = 22; co = bpy.data.objects.new('K', cam); bpy.context.collection.objects.link(co); scn.camera = co
co.location = Vector((0.3, -4.6, 0.7)); d = Vector((0.1, 0, 3.6)) - co.location; co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
bpy.ops.render.render(write_still=False); scn.render.filepath = OUT; bpy.ops.render.render(write_still=True)
print('TAMAM', OUT)
