# Blender (arka planda, GitHub Actions) ile kayisi agaci: kubbe taclı, catallanan govdeli, parlak yaprakli, catlakli meyveli. Cikti: seffaf PNG.
import bpy, bmesh, math, random, sys
from mathutils import Vector
random.seed(21)
OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.samples = 48; scn.cycles.use_denoising = True
scn.render.resolution_x, scn.render.resolution_y = 1080, 1920
scn.render.film_transparent = True; scn.render.image_settings.file_format = 'PNG'; scn.render.image_settings.color_mode = 'RGBA'
ids = [i.identifier for i in scn.view_settings.bl_rna.properties['view_transform'].enum_items]
scn.view_settings.view_transform = 'AgX' if 'AgX' in ids else ('Filmic' if 'Filmic' in ids else 'Standard'); scn.view_settings.exposure = -1.2

def mat(name, color, rough=0.5, sss=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    for k, v in (('Subsurface Weight', sss), ('Coat Weight', coat)):
        if k in b.inputs: b.inputs[k].default_value = v
    if 'Specular IOR Level' in b.inputs: b.inputs['Specular IOR Level'].default_value = 0.25
    return m

# dunya: gokyuzu isigi + gunes (arka plan seffaf)
w = bpy.data.worlds.new('W'); scn.world = w; w.use_nodes = True
sky = w.node_tree.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(32); sky.sun_rotation = math.radians(215); sky.sun_size = math.radians(2.5); sky.sun_intensity = 0.22
w.node_tree.links.new(sky.outputs['Color'], w.node_tree.nodes['Background'].inputs['Color']); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.75
bpy.ops.mesh.primitive_plane_add(size=300); g = bpy.context.object; g.is_shadow_catcher = True; g.data.materials.append(mat('Z', (0.08, 0.2, 0.04), 0.9))

# govde + catal + dallar
wood = mat('Odun', (0.05, 0.024, 0.012), 0.9)
_n = wood.node_tree.nodes.new('ShaderNodeTexNoise'); _n.inputs['Scale'].default_value = 16; _n.inputs['Detail'].default_value = 8
_b = wood.node_tree.nodes.new('ShaderNodeBump'); _b.inputs['Strength'].default_value = 0.8
wood.node_tree.links.new(_n.outputs['Fac'], _b.inputs['Height']); wood.node_tree.links.new(_b.outputs['Normal'], wood.node_tree.nodes['Principled BSDF'].inputs['Normal'])
def curve(pts, r0, r1):
    cv = bpy.data.curves.new('b', 'CURVE'); cv.dimensions = '3D'; cv.bevel_depth = 1.0; cv.bevel_resolution = 4; cv.use_fill_caps = True
    sp = cv.splines.new('NURBS' if len(pts) > 3 else 'POLY'); sp.points.add(len(pts) - 1)
    for i, q in enumerate(pts): sp.points[i].co = (q.x, q.y, q.z, 1); sp.points[i].radius = r0 + (r1 - r0) * i / (len(pts) - 1)
    if sp.type == 'NURBS': sp.use_endpoint_u = True; sp.order_u = 3
    o = bpy.data.objects.new('b', cv); bpy.context.collection.objects.link(o); cv.materials.append(wood)
twig = []
def branch(p, d, L, r, depth):
    pts = [p]; cur = p.copy(); dd = d.copy()
    for k in range(4):
        dd = (dd + Vector((random.uniform(-.2, .2), random.uniform(-.2, .2), random.uniform(-.02, .1)))).normalized(); cur = cur + dd * (L / 4); pts.append(cur.copy())
    curve(pts, r, r * 0.62)
    if depth == 0: twig.append(cur.copy()); return
    for k in range(2):
        nd = (dd + Vector((random.uniform(-.7, .7), random.uniform(-.7, .7), random.uniform(0.0, .5)))).normalized(); branch(cur, nd, L * 0.78, r * 0.62, depth - 1)
# govde: S kivrimli, iki ana kola cataldan ayrilir
trunk = [Vector((0, 0, -0.1)), Vector((0.12, 0.02, 0.7)), Vector((-0.08, 0.0, 1.4)), Vector((0.05, 0.0, 2.15))]
curve(trunk, 0.42, 0.15)
for a in (0.3, 1.5, 2.7, 3.9, 5.1):
    curve([Vector((math.cos(a) * 0.5, math.sin(a) * 0.5, 0.0)), Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, 0.12)), Vector((0.05, 0.0, 0.55))], 0.07, 0.17)
fork = Vector((0.05, 0.0, 2.0))
branch(fork, Vector((-0.55, 0.1, 1)).normalized(), 1.5, 0.19, 2); branch(fork, Vector((0.6, -0.1, 1)).normalized(), 1.5, 0.19, 2)
for s in (-1, 1): branch(Vector((0.05, 0, 2.2)), Vector((s * 0.2, 0.55, 1)).normalized(), 1.2, 0.08, 2)

# yaprak malzemesi: UV ile damar, ucu acik yesil; parlak
def leafmat(i, base, tip):
    m = mat('Y%d' % i, base, 0.5, 0.10); nt = m.node_tree; b = nt.nodes['Principled BSDF']
    uv = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(uv.outputs['UV'], sep.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (*base, 1); ramp.color_ramp.elements[1].color = (*tip, 1); nt.links.new(sep.outputs['Y'], ramp.inputs['Fac'])
    sub = nt.nodes.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = 0.5; nt.links.new(sep.outputs['X'], sub.inputs[0])
    ab = nt.nodes.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'; nt.links.new(sub.outputs[0], ab.inputs[0])
    vr = nt.nodes.new('ShaderNodeValToRGB'); vr.color_ramp.elements[0].position = 0.0; vr.color_ramp.elements[0].color = (1, 1, 1, 1); vr.color_ramp.elements[1].position = 0.03; vr.color_ramp.elements[1].color = (0, 0, 0, 1); nt.links.new(ab.outputs[0], vr.inputs['Fac'])
    mix = nt.nodes.new('ShaderNodeMixRGB'); mix.inputs['Color2'].default_value = (0.16, 0.30, 0.06, 1); nt.links.new(vr.outputs['Color'], mix.inputs['Fac']); nt.links.new(ramp.outputs['Color'], mix.inputs['Color1'])
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'tint'
    mul = nt.nodes.new('ShaderNodeMixRGB'); mul.blend_type = 'MULTIPLY'; mul.inputs['Fac'].default_value = 1.0
    nt.links.new(mix.outputs['Color'], mul.inputs['Color1']); nt.links.new(vc.outputs['Color'], mul.inputs['Color2']); nt.links.new(mul.outputs['Color'], b.inputs['Base Color'])
    return m
leafm = [leafmat(0, (0.008, 0.05, 0.008), (0.03, 0.13, 0.02)), leafmat(1, (0.012, 0.065, 0.01), (0.04, 0.16, 0.025)), leafmat(2, (0.018, 0.08, 0.012), (0.055, 0.19, 0.03))]
me = bpy.data.meshes.new('Yaprak'); bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); tl = bm.loops.layers.color.new('tint')
CC = Vector((0.0, 0.0, 4.0)); CR = Vector((2.25, 2.1, 1.75)); CUT = -0.42        # tac merkezi, yaricaplar, alt kesim (catal gorunsun)
TS = [0, 0.14, 0.32, 0.52, 0.72, 0.9, 1.0]
def leaf(c, nrm, down_bias, size, dark):
    nrm = nrm.normalized(); dn = Vector((0, 0, -1)); t2 = (dn - nrm * dn.dot(nrm)); t2 = (t2.normalized() if t2.length > 1e-3 else nrm.cross(Vector((1, 0, 0))).normalized())
    t2 = (t2 + Vector((random.uniform(-.55, .55), random.uniform(-.55, .55), random.uniform(-.55, .55)))); t2 = (t2 - nrm * t2.dot(nrm)).normalized(); t1 = nrm.cross(t2).normalized()
    L = size; Wd = size * 0.42; tn = random.uniform(0.85, 1.1) * dark; mi = random.randrange(3)
    ml, ll, rl = [], [], []
    for t in TS:
        wd = Wd * (math.sin(math.pi * min(1, t ** 0.75)) ** 0.8) ; lift = nrm * L * 0.13 * math.sin(math.pi * t) - nrm * L * 0.10 * t * t
        m = c + t2 * L * t + lift; ml.append(bm.verts.new(m)); ll.append(bm.verts.new(m + t1 * wd - nrm * wd * 0.35)); rl.append(bm.verts.new(m - t1 * wd - nrm * wd * 0.35))
    for k in range(len(TS) - 1):
        for side, edge in ((0, ll), (1, rl)):
            vs = [ml[k], ml[k + 1], edge[k + 1], edge[k]] if side == 0 else [ml[k], edge[k], edge[k + 1], ml[k + 1]]
            try: f = bm.faces.new(vs)
            except ValueError: continue
            f.material_index = mi; f.smooth = True
            us = {id(ml[k]): (0.5, TS[k]), id(ml[k + 1]): (0.5, TS[k + 1]), id(ll[k]): (0.0, TS[k]), id(ll[k + 1]): (0.0, TS[k + 1]), id(rl[k]): (1.0, TS[k]), id(rl[k + 1]): (1.0, TS[k + 1])}
            for lp in f.loops: lp[uvl].uv = us[id(lp.vert)] if id(lp.vert) in us else (0.5, 0.5); lp[tl] = (tn, tn * 0.98, tn * 0.95, 1)
def shell(rad, count, size):
    for _ in range(count):
        for _t in range(10):
            u = Vector((random.gauss(0, 1), random.gauss(0, 1), random.gauss(0, 1))).normalized()
            if u.z > CUT: break
        else: continue
        c = CC + Vector((u.x * CR.x, u.y * CR.y, u.z * CR.z)) * rad
        n = Vector((u.x / CR.x, u.y / CR.y, u.z / CR.z)).normalized()
        leaf(c, n, 0, size * random.uniform(0.85, 1.15), 0.45 + 0.5 * rad ** 2)
for rad, cnt, sz in ((0.5, 600, 0.85), (0.66, 900, 0.8), (0.8, 1300, 0.76), (0.92, 1700, 0.72), (1.0, 1500, 0.68)): shell(rad, cnt, sz)
bm.to_mesh(me); bm.free(); lo = bpy.data.objects.new('Yaprak', me); bpy.context.collection.objects.link(lo)
for m in leafm: me.materials.append(m)

# kayisi meyvesi: yuvarlak, ortasinda ince olukla, turuncudan kirmiziya
fm = mat('Kayisi', (0.9, 0.35, 0.05), 0.55, 0.35, 0.04); nt = fm.node_tree
tc = nt.nodes.new('ShaderNodeTexCoord'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'], sp.inputs['Vector'])
fr = nt.nodes.new('ShaderNodeValToRGB'); fr.color_ramp.elements[0].color = (0.55, 0.15, 0.012, 1); fr.color_ramp.elements[1].color = (0.42, 0.035, 0.01, 1); fr.color_ramp.elements[0].position = 0.35; fr.color_ramp.elements[1].position = 0.9
nt.links.new(sp.outputs['X'], fr.inputs['Fac']); _no = nt.nodes.new('ShaderNodeTexNoise'); _no.inputs['Scale'].default_value = 9; _bu = nt.nodes.new('ShaderNodeBump'); _bu.inputs['Strength'].default_value = 0.08; nt.links.new(_no.outputs['Fac'], _bu.inputs['Height']); nt.links.new(_bu.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal']); nt.links.new(fr.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
placed = []
for k in range(40):
    if len(placed) >= 8: break
    u = Vector((random.uniform(-.9, .9), -random.uniform(0.35, 1.0), random.uniform(-0.5, .8))).normalized()      # on yuzey (kameraya bakan)
    c = CC + Vector((u.x * CR.x, u.y * CR.y, u.z * CR.z)) * 1.0
    if any((c - q).length < 1.15 for q in placed): continue
    placed.append(c); R = random.uniform(0.26, 0.31)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=R, location=c); fo = bpy.context.object; fo.rotation_euler = (0, 0, random.uniform(0, 6.28))
    bm2 = bmesh.new(); bm2.from_mesh(fo.data)
    for v in bm2.verts:
        gro = math.exp(-(v.co.x / (R * 0.09)) ** 2) * max(0, v.co.y / R) ** 0.4 * R * 0.17; v.co.x *= 0.97; v.co.z *= 0.92; v.co.y -= gro * (1 if v.co.y > 0 else 0)
        v.co.x = v.co.x - (gro * 0.0)
    bm2.to_mesh(fo.data); bm2.free(); bpy.ops.object.shade_smooth(); fo.data.materials.append(fm)

# kamera: on gorunus (referans resimdeki gibi)
cam = bpy.data.cameras.new('K'); cam.lens = 50; co = bpy.data.objects.new('K', cam); bpy.context.collection.objects.link(co); scn.camera = co
co.location = Vector((0, -13.5, 3.7)); d = Vector((0, 0, 3.5)) - co.location; co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
scn.render.filepath = OUT; bpy.ops.render.render(write_still=True)
co.location = Vector((0.5, -6.0, 0.9)); cam.lens = 30; d = Vector((0, 0, 3.9)) - co.location; co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
scn.render.filepath = OUT.replace('.png', '_alttan.png'); bpy.ops.render.render(write_still=True)
print('TAMAM', OUT)
