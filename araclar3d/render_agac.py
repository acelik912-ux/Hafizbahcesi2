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
scn.render.film_transparent = True; scn.render.image_settings.file_format = 'PNG'; scn.render.image_settings.color_mode = 'RGBA'
ids = [i.identifier for i in scn.view_settings.bl_rna.properties['view_transform'].enum_items]
scn.view_settings.view_transform = 'AgX' if 'AgX' in ids else ('Filmic' if 'Filmic' in ids else 'Standard')
scn.view_settings.exposure = -0.4

def mat(name, color, rough=0.5, sss=0.0, coat=0.0, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    for k, v in (('Subsurface Weight', sss), ('Coat Weight', coat)):
        if k in b.inputs: b.inputs[k].default_value = v
    if 'Subsurface Radius' in b.inputs and sss: b.inputs['Subsurface Radius'].default_value = (0.4, 0.5, 0.2)
    return m

# --- dunya: Nishita gokyuzu + gunes
w = bpy.data.worlds.new('W'); scn.world = w; w.use_nodes = True
sky = w.node_tree.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(24); sky.sun_rotation = math.radians(200); sky.sun_size = math.radians(1.6); sky.sun_intensity = 0.30; sky.air_density = 1.0; sky.dust_density = 0.6
w.node_tree.links.new(sky.outputs['Color'], w.node_tree.nodes['Background'].inputs['Color']); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7

# --- zemin: cimen
bpy.ops.mesh.primitive_plane_add(size=300); g = bpy.context.object; g.name = 'Cimen'; g.is_shadow_catcher = True
gm = mat('Cimen', (0.10, 0.28, 0.05), 0.9); g.data.materials.append(gm)
nt = gm.node_tree; n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 60; bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.6
nt.links.new(n.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal'])
ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.06, 0.20, 0.03, 1); ramp.color_ramp.elements[1].color = (0.22, 0.42, 0.08, 1)
n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 3; nt.links.new(n2.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])

# --- govde + dallar (egrilmis, ince uca dogru daralan kavisler)
wood = mat('Odun', (0.09, 0.045, 0.025), 0.9)
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
branch(Vector((0, 0, 0)), Vector((0.05, 0.0, 1)), 1.9, 0.34, 0)       # govde
top = Vector((0.1, 0.0, 1.9))
for s in (-1, 1): branch(top, Vector((s * 0.55, random.uniform(-.2, .2), 1)).normalized(), 1.4, 0.2, 3)

# --- yapraklar: tek mesh, uc yesil tonu
def leafmat(i, base, tip):
    m = mat('Y%d' % i, base, 0.5, 0.15); nt = m.node_tree; b = nt.nodes['Principled BSDF']
    uv = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(uv.outputs['UV'], sep.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (*base, 1); ramp.color_ramp.elements[1].color = (*tip, 1)
    nt.links.new(sep.outputs['Y'], ramp.inputs['Fac'])
    sub = nt.nodes.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = 0.5; nt.links.new(sep.outputs['X'], sub.inputs[0])
    ab = nt.nodes.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'; nt.links.new(sub.outputs[0], ab.inputs[0])
    vr = nt.nodes.new('ShaderNodeValToRGB'); vr.color_ramp.elements[0].position = 0.0; vr.color_ramp.elements[0].color = (1, 1, 1, 1); vr.color_ramp.elements[1].position = 0.045; vr.color_ramp.elements[1].color = (0, 0, 0, 1)
    nt.links.new(ab.outputs[0], vr.inputs['Fac'])
    mix = nt.nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MIX'; mix.inputs['Color2'].default_value = (0.55, 0.62, 0.22, 1)
    nt.links.new(vr.outputs['Color'], mix.inputs['Fac']); nt.links.new(ramp.outputs['Color'], mix.inputs['Color1'])
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'tint'
    mul = nt.nodes.new('ShaderNodeMixRGB'); mul.blend_type = 'MULTIPLY'; mul.inputs['Fac'].default_value = 1.0
    nt.links.new(mix.outputs['Color'], mul.inputs['Color1']); nt.links.new(vc.outputs['Color'], mul.inputs['Color2']); nt.links.new(mul.outputs['Color'], b.inputs['Base Color'])
    return m
leafm = [leafmat(0, (0.05, 0.17, 0.03), (0.15, 0.36, 0.06)), leafmat(1, (0.07, 0.21, 0.04), (0.20, 0.42, 0.07)), leafmat(2, (0.10, 0.26, 0.05), (0.27, 0.48, 0.09))]
me = bpy.data.meshes.new('Yaprak'); bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); tl = bm.loops.layers.color.new('tint')
crown_c = Vector((0.1, 0, 3.7)); crown_r = Vector((2.1, 2.0, 1.7))
def leaf(c, nrm, size, dark=1.0):
    nrm = nrm.normalized(); t1 = nrm.cross(Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))).normalized(); t2 = nrm.cross(t1)
    L = size; Wd = size * 0.36
    pts = [c, c + t2 * L * 0.22 + t1 * Wd * 0.75, c + t2 * L * 0.62 + t1 * Wd, c + t2 * L, c + t2 * L * 0.62 - t1 * Wd, c + t2 * L * 0.22 - t1 * Wd * 0.75]
    m = c + t2 * L * 0.5 + nrm * L * random.uniform(0.04, 0.12)                       # orta damar hafif yukari: yaprak katlanir
    vs = [bm.verts.new(p) for p in pts]; vm = bm.verts.new(m)
    uvs = [(0.5, 0), (0.1, 0.22), (0.0, 0.62), (0.5, 1), (1.0, 0.62), (0.9, 0.22)]; tn = random.uniform(0.75, 1.15) * dark; mi = random.randrange(3)
    for k in range(6):
        f = bm.faces.new([vs[k], vs[(k + 1) % 6], vm]); f.material_index = mi; f.smooth = True
        for lp, q in zip(f.loops, [uvs[k], uvs[(k + 1) % 6], (0.5, 0.5)]): lp[uvl].uv = q; lp[tl] = (tn, tn * 0.98, tn * 0.95, 1)
for _ in range(13000):
    u = Vector((random.gauss(0, 1), random.gauss(0, 1), random.gauss(0, 1))).normalized(); rad = random.random() ** 0.4 * 0.5 + 0.5
    c = crown_c + Vector((u.x * crown_r.x, u.y * crown_r.y, u.z * crown_r.z)) * rad
    leaf(c, u + Vector((random.uniform(-.5, .5), random.uniform(-.5, .5), random.uniform(-.5, .5))), random.uniform(0.21, 0.33), 0.5 + 0.7 * rad)
bm.to_mesh(me); bm.free(); lo = bpy.data.objects.new('Yaprak', me); bpy.context.collection.objects.link(lo)
for m in leafm: me.materials.append(m)

# --- meyveler
fm = mat('Kayisi', (0.80, 0.22, 0.02), 0.35, 0.25, 0.3)
for k in range(22):
    u = Vector((random.gauss(0, 1), random.gauss(0, 1), random.gauss(0, .7) - 0.1)).normalized()
    c = crown_c + Vector((u.x * crown_r.x, u.y * crown_r.y, u.z * crown_r.z)) * 0.93
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=random.uniform(0.2, 0.26), location=c); fo = bpy.context.object; fo.scale.z = 0.92; bpy.ops.object.shade_smooth(); fo.data.materials.append(fm)

# --- kamera: agacin altindan, tacin icine dogru bakis
cam = bpy.data.cameras.new('K'); cam.lens = 20; co = bpy.data.objects.new('K', cam); bpy.context.collection.objects.link(co); scn.camera = co
co.location = Vector((0.4, -3.4, 0.9)); d = Vector((0.1, 0, 3.9)) - co.location; co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
scn.render.filepath = OUT; bpy.ops.render.render(write_still=True)
print('TAMAM', OUT)
