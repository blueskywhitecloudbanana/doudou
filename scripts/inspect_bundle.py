# 在 Blender 中检查 Human Base Meshes 包的结构
# 用法: blender -b human_base_meshes_bundle.blend -P inspect_bundle.py
import bpy

print('=== OBJECTS ===')
for ob in bpy.data.objects:
    if ob.type != 'MESH':
        print(f'[{ob.type}] {ob.name}')
        continue
    me = ob.data
    dims = tuple(round(d, 3) for d in ob.dimensions)
    print(f'[MESH] {ob.name} | verts={len(me.vertices)} polys={len(me.polygons)} dims={dims}')
    print(f'    vertex_groups: {[g.name for g in ob.vertex_groups]}')
    print(f'    materials: {[m.name if m else None for m in me.materials]}')
    print(f'    modifiers: {[(m.type, m.name) for m in ob.modifiers]}')
    if me.color_attributes:
        print(f'    color_attributes: {[c.name for c in me.color_attributes]}')

print('=== COLLECTIONS ===')
for col in bpy.data.collections:
    print(col.name, '->', [o.name for o in col.objects])
