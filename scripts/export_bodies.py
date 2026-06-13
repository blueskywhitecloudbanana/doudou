# 从 Human Base Meshes 包导出写实人体为 glb，部位信息烘焙进顶点色
# 用法: blender -b human_base_meshes_bundle.blend -P export_bodies.py -- <输出目录>
#
# 部位 ID（写入 PartId 顶点色 R 通道，值 = id/7）:
#   1=head(含颈/五官/耳/眼) 2=torso 3=hips 4=armL 5=armR 6=legL 7=legR
# 判定依据 UV 岛的包围盒（手臂与躯干由 UV 接缝天然分离，无需几何猜测）。
import bpy
import bmesh
import sys
from mathutils import Vector

OUT_DIR = sys.argv[sys.argv.index('--') + 1]

PART_IDS = {'head': 1, 'torso': 2, 'hips': 3, 'armL': 4, 'armR': 5, 'legL': 6, 'legR': 7}
# 调试渲染用的部位颜色（PartId 用 R=id/7 单独编码）
DEBUG_COLORS = {
    0: (0.2, 0.2, 0.2, 1),
    1: (0.95, 0.85, 0.3, 1),   # head 黄
    2: (0.3, 0.7, 0.95, 1),    # torso 蓝
    3: (0.95, 0.4, 0.7, 1),    # hips 粉
    4: (0.4, 0.9, 0.4, 1),     # armL 绿
    5: (0.1, 0.55, 0.25, 1),   # armR 深绿
    6: (0.95, 0.5, 0.2, 1),    # legL 橙
    7: (0.7, 0.3, 0.1, 1),     # legR 棕
}

def classify_islands(ob):
    """返回 vertex_index -> part_id 映射"""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.active
    bm.faces.ensure_lookup_table()
    parent = list(range(len(bm.faces)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for edge in bm.edges:
        faces = edge.link_faces
        if len(faces) != 2:
            continue
        f1, f2 = faces

        def uvs_at(face):
            d = {}
            for loop in face.loops:
                if loop.vert in edge.verts:
                    d[loop.vert.index] = (round(loop[uv].uv.x, 5), round(loop[uv].uv.y, 5))
            return d

        u1, u2 = uvs_at(f1), uvs_at(f2)
        if all(u1.get(k) == u2.get(k) for k in u1):
            r1, r2 = find(f1.index), find(f2.index)
            if r1 != r2:
                parent[r1] = r2

    islands = {}
    for f in bm.faces:
        islands.setdefault(find(f.index), []).append(f)

    # 整体包围盒（局部坐标，模型无旋转缩放，仅平移，比例不受影响）
    all_x = [v.co.x for v in bm.verts]
    all_z = [v.co.z for v in bm.verts]
    x0 = (min(all_x) + max(all_x)) / 2
    zmin, zmax = min(all_z), max(all_z)
    H = zmax - zmin

    # 身体中线 x0 以躯干岛为准更稳：取最大岛集合的对称中心即整体中心（A-pose 对称）
    vert_part = {}
    for faces in islands.values():
        xs, zs = [], []
        for f in faces:
            for v in f.verts:
                xs.append(v.co.x)
                zs.append(v.co.z)
        zc = ((min(zs) + max(zs)) / 2 - zmin) / H
        dx_min = min(abs(x - x0) for x in xs)
        xc = sum(xs) / len(xs)
        if zc > 0.82:
            part = 'head'
        elif dx_min > 0.08 * H and zc > 0.3:
            part = 'armL' if xc > x0 else 'armR'
        elif zc > 0.66:
            part = 'torso'
        elif zc > 0.56:
            part = 'hips'
        else:
            part = 'legL' if xc > x0 else 'legR'
        pid = PART_IDS[part]
        for f in faces:
            for v in f.verts:
                vert_part[v.index] = pid
    bm.free()
    return vert_part

def write_color_attrs(me, vert_part, default_id=None):
    """写入 PartId（编码）与 Debug（调试色）两个顶点色属性"""
    for name in ('PartId', 'Debug'):
        if name in me.color_attributes:
            me.color_attributes.remove(me.color_attributes[name])
    enc = me.color_attributes.new(name='PartId', type='BYTE_COLOR', domain='POINT')
    dbg = me.color_attributes.new(name='Debug', type='BYTE_COLOR', domain='POINT')
    for i in range(len(me.vertices)):
        pid = default_id if default_id is not None else vert_part.get(i, 0)
        enc.data[i].color = (pid / 7.0, 0.0, 0.0, 1.0)
        dbg.data[i].color = DEBUG_COLORS[pid]

def set_active_color(me, name):
    idx = me.color_attributes.find(name)
    me.color_attributes.active_color_index = idx
    me.color_attributes.render_color_index = idx

def setup_render(scene):
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'FLAT'
    scene.display.shading.color_type = 'VERTEX'
    scene.render.resolution_x = 540
    scene.render.resolution_y = 860
    scene.render.film_transparent = False

def render_views(scene, objs, h, tag):
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = h * 1.15
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    for label, (loc, rot) in {
        'front': ((0, -4, h / 2), (1.5708, 0, 0)),
        'back': ((0, 4, h / 2), (1.5708, 0, 3.1416)),
    }.items():
        cam.location = loc
        cam.rotation_euler = rot
        scene.render.filepath = f'{OUT_DIR}/preview_{tag}_{label}.png'
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    bpy.data.cameras.remove(cam_data)

def process(tag, body_name):
    body = bpy.data.objects[body_name]
    eyes = [o for o in bpy.data.objects if o.name.startswith(body_name + '.eye')]

    # 烘焙对象变换（包内对象只有平移）
    for ob in [body] + eyes:
        ob.data.transform(ob.matrix_world)
        ob.matrix_world.identity()

    # 居中：x/y 取包围盒中心，脚底放到 z=0
    xs = [v.co.x for v in body.data.vertices]
    ys = [v.co.y for v in body.data.vertices]
    zs = [v.co.z for v in body.data.vertices]
    offset = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))
    h = max(zs) - min(zs)
    for ob in [body] + eyes:
        ob.data.transform(__import__('mathutils').Matrix.Translation(-offset))

    vert_part = classify_islands(body)
    write_color_attrs(body.data, vert_part)
    for eye in eyes:
        write_color_attrs(eye.data, {}, default_id=PART_IDS['head'])

    # 多级细分取 1 级（平衡细节与体积）并平滑着色
    for mod in body.modifiers:
        if mod.type == 'MULTIRES':
            mod.levels = 1
            mod.show_viewport = True
    for poly in body.data.polygons:
        poly.use_smooth = True
    for eye in eyes:
        for poly in eye.data.polygons:
            poly.use_smooth = True

    # 隐藏其他所有物体，渲染调试图
    scene = bpy.context.scene
    for ob in scene.objects:
        ob.hide_render = True
    for ob in [body] + eyes:
        ob.hide_render = False
        set_active_color(ob.data, 'Debug')
    setup_render(scene)
    render_views(scene, [body] + eyes, h, tag)

    # 切回 PartId 作为导出的活动颜色，删除 Debug 属性
    for ob in [body] + eyes:
        ob.data.color_attributes.remove(ob.data.color_attributes['Debug'])
        set_active_color(ob.data, 'PartId')

    # 选择并导出
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [body] + eyes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = body
    out = f'{OUT_DIR}/body_{tag}.glb'
    kwargs = dict(
        filepath=out,
        use_selection=True,
        export_apply=True,
        export_materials='NONE',
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_texcoords=False,
        export_yup=True,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_vertex_color='ACTIVE', export_all_vertex_colors=False)
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)
    print(f'EXPORTED {out} height={h:.3f}')

process('male', 'GEO-body_male_realistic')
process('female', 'GEO-body_female_realistic')
print('DONE')
