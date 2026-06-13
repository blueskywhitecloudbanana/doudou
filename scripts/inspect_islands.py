# 检查写实人体网格的 UV 岛划分，用于决定部位映射
# 用法: blender -b bundle.blend -P inspect_islands.py
import bpy
import bmesh

for body_name in ('GEO-body_male_realistic', 'GEO-body_female_realistic'):
    ob = bpy.data.objects[body_name]
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.active

    # 用 UV 接缝/断开作为边界做面的连通域划分：
    # 两个相邻面若在共享边上的 UV 坐标一致则视为同一岛
    bm.faces.ensure_lookup_table()
    parent = list(range(len(bm.faces)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for edge in bm.edges:
        faces = edge.link_faces
        if len(faces) != 2:
            continue
        f1, f2 = faces
        # 收集两面在该边两个端点的 UV
        def uvs_at(face):
            d = {}
            for loop in face.loops:
                if loop.vert in edge.verts:
                    d[loop.vert.index] = (round(loop[uv].uv.x, 5), round(loop[uv].uv.y, 5))
            return d
        u1, u2 = uvs_at(f1), uvs_at(f2)
        if all(u1.get(k) == u2.get(k) for k in u1):
            union(f1.index, f2.index)

    islands = {}
    for f in bm.faces:
        islands.setdefault(find(f.index), []).append(f)

    mw = ob.matrix_world
    print(f'### {body_name}: {len(islands)} islands')
    rows = []
    for root, faces in islands.items():
        xs, ys, zs = [], [], []
        for f in faces:
            for v in f.verts:
                co = mw @ v.co
                xs.append(co.x); ys.append(co.y); zs.append(co.z)
        rows.append((len(faces), (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))))
    rows.sort(key=lambda r: -r[0])
    for n, bx, by, bz in rows:
        print(f'  faces={n:5d} x=({bx[0]:+.3f},{bx[1]:+.3f}) y=({by[0]:+.3f},{by[1]:+.3f}) z=({bz[0]:+.3f},{bz[1]:+.3f})')
    bm.free()
