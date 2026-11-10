"""Blender authoring source for the valley terrain; no runtime Blender dependency.
Run Blender --background --threads 2 --python this-file.py. Coordinates in authoring
helpers use Three's (x, height, z); the glTF export converts Blender axes back.
"""
import bpy, math, os, json, gzip, struct
from mathutils import Vector
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
SOLID = bpy.data.materials.new('world-solid')
SOLID.use_nodes = True
SOLID.use_backface_culling = True
nodes = SOLID.node_tree.nodes
attr = nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Color'
SOLID.node_tree.links.new(attr.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
nodes.get('Principled BSDF').inputs['Roughness'].default_value = .88

def rgb(hex):
    return tuple(((hex >> shift) & 255) / 255 for shift in (16,8,0)) + (1,)

def mesh(name, verts, faces, colors, material=SOLID):
    data = bpy.data.meshes.new(name)
    data.from_pydata([(x,-z,y) for x,y,z in verts],[],[tuple(reversed(face)) for face in faces]); data.update()
    obj = bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj)
    data.materials.append(material)
    col = data.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
    for face, color in zip(data.polygons,colors):
        for loop in face.loop_indices: col.data[loop].color_srgb = rgb(color)
    return obj

# Wide flat shelves are connected by short visible slopes; stop pads stay level.
PROFILE=[(-14.6,5.6),(-12,5.0),(-11,5.0),(-10,4.8),(-9.2,4.8),(-8.4,4.75),(-7.9,4.05),(-5.5,4.0),(-5,3.8),(-4.2,3.8),(-3.4,3.75),(-2.9,3.05),(-.5,3.0),(0,2.8),(.8,2.8),(1.6,2.75),(2.1,2.05),(4.5,2.0),(5,1.8),(5.8,1.8),(6.6,1.75),(7.1,1.05),(9,1.0),(10,.8),(12,.8),(14.6,.35)]
def height(z):
    for (za,ya),(zb,yb) in zip(PROFILE,PROFILE[1:]):
        if z <= zb: return ya+(yb-ya)*(z-za)/(zb-za)
    return PROFILE[-1][1]
def river(z): return -7.05 + .32*math.sin(z*.34)
# River-relative columns make the water a carved part of the land, with inclined banks.
OFFSETS=[-2.25,-1.65,-1.1,-.72,.72,1.15,1.65,2.5,4.1,6.1,8.1,10.1,12.1,14.1,16.1]
ZS=[z for z,y in PROFILE]
verts=[]
for row,z in enumerate(ZS):
    for col,o in enumerate(OFFSETS):
        x=river(z)+o
        taper=max(0,(abs(z)-10)/4.6)
        edge_factor=(abs(o-6.1)/8.35)**3
        x=x*(1-taper*.20*edge_factor)
        x+=edge_factor*.28*math.sin(z*.7)
        zpos=z + max(0,(abs(z)-11)/3.6)*(.7-abs(x)*.14)*(1 if z>0 else -1)
        y=height(z)
        if col in (3,4): y-=.9
        elif col in (2,5): y-=.35
        elif col in (0,14): y+=.18+ .12*math.sin(row*1.5)
        verts.append((round(x,3),round(y,3),round(zpos,3)))
faces=[]; colors=[]
for r in range(len(ZS)-1):
    for c in range(len(OFFSETS)-1):
        a=r*len(OFFSETS)+c; b=a+len(OFFSETS)
        faces.append((a,a+1,b+1,b))
        colors.append([0x839b79,0x94aa89,0xa7b18b,0x567c78,0x99a687,0x93a381,0x87a07a][c%7] if c<6 else (0xa8ac8c if abs(ZS[r+1]-ZS[r])<.6 and abs(height(ZS[r+1])-height(ZS[r]))>.5 else 0x91a37e))
# Bevelled earth edge, layered rock cliff, and a tapered bottom make a real volume.
cols=len(OFFSETS); rows=len(ZS)
edge=list(range(cols))+[r*cols+cols-1 for r in range(1,rows)]+list(range((rows-1)*cols+cols-2,(rows-1)*cols-1,-1))+[r*cols for r in range(rows-2,0,-1)]
prev=edge
for layer,(drop,inset,color) in enumerate([(.22,.12,0x758d73),(.55,.03,0x9e9d84),(1.3,-.12,0x7d887c),(2.25,.25,0x5c746d),(2.8,.7,0x405d59)]):
    ring=[]
    for j,idx in enumerate(edge):
        x,y,z=verts[idx]
        ring.append(len(verts)); verts.append((round(x*(1-inset/10),3),round(y-drop-.06*math.sin(j*1.7),3),round(z*(1-inset/16),3)))
    for j in range(len(edge)):
        k=(j+1)%len(edge); faces.append((prev[k],prev[j],ring[j],ring[k])); colors.append(color)
    prev=ring
faces.append(tuple(reversed(prev)));colors.append(0x405d59)
land=mesh('terrain-sculpted-valley',verts,faces,colors)
# Broad visible water ribbons follow the bed. Small drop lips read as shallow cascades.
wv=[];wf=[]
for z in ZS:
    wv.extend([(river(z)-.65,height(z)-.64,z),(river(z)+.65,height(z)-.64,z)])
for r in range(rows-1): wf.append((r*2,r*2+1,r*2+3,r*2+2))
water=mesh('world-water',wv,wf,[0x65aaa9]*len(wf))
# Pale stones are modeled into the banks, deliberately kept clear of stop pads.
for i,z in enumerate([-12,-8,-3,2,7,11]):
    x=river(z)-1.35
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,-z,height(z)-.04))
    obj=bpy.context.object;obj.name='bank-stone-%02d'%i;obj.scale=(.34,.55,.26)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(SOLID)
    col=obj.data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
    for datum in col.data:datum.color_srgb=rgb(0xb6b49b)
# Four short stone stair flights cross the terrace scarps between clear stop pads.
for flight, lower_z in enumerate((7.1,2.1,-2.9,-7.9)):
    for step in range(4):
        z=lower_z-step*.16
        y=height(z)+.055
        x=-.5+(flight%2)*1.1
        bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y))
        obj=bpy.context.object;obj.name='terrace-step-%d-%d'%(flight,step)
        obj.scale=(.9,.23,.12);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        bevel=obj.modifiers.new('Worn stone edge','BEVEL');bevel.width=.025;bevel.segments=1
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        obj.data.materials.append(SOLID)
        col=obj.data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
        for datum in col.data:datum.color_srgb=rgb(0xb9b49a)
# Join dry terrain and stones into one batch, retaining water as separate mesh.
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj!=water:obj.select_set(True)
bpy.context.view_layer.objects.active=land;bpy.ops.object.join();land.name='world-solid'
# glTF colors and flat facet normals define the deliberately sculpted finish.
for obj in (land,water):
    obj.data.validate();obj.data.update()
    for polygon in obj.data.polygons: polygon.use_smooth=True
    obj.select_set(True)
output=os.path.join(ROOT,'public','models','world-terrain.glb')
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',use_selection=True,export_texcoords=False,export_normals=True,export_materials='EXPORT',export_yup=True)
# Quantize exported float attributes to millimetres without adding a decoder.
with open(output,'rb') as f: encoded=bytearray(f.read())
json_size=struct.unpack_from('<I',encoded,12)[0]
document=json.loads(encoded[20:20+json_size])
binary_offset=20+json_size+8
for accessor in document['accessors']:
    if accessor['componentType'] != 5126: continue
    view=document['bufferViews'][accessor['bufferView']]
    start=binary_offset+view.get('byteOffset',0)+accessor.get('byteOffset',0)
    components={'VEC3':3,'VEC4':4,'VEC2':2,'SCALAR':1}[accessor['type']]
    for item in range(accessor['count']):
        for component in range(components):
            at=start+item*view.get('byteStride',components*4)+component*4
            value=struct.unpack_from('<f',encoded,at)[0]
            struct.pack_into('<f',encoded,at,round(value,3))
with open(output,'wb') as f:f.write(encoded)
# A compact integer mesh has no glTF runtime decoder cost. The GLB remains portable.
palette=[]; exported=[]
for obj in (land,water):
    data=obj.data; data.calc_loop_triangles()
    positions=[]; normals=[]; colors=[]; indices=[]; lookup={}
    for triangle in data.loop_triangles:
        for loop_index in triangle.loops:
            loop=data.loops[loop_index]; vertex=data.vertices[loop.vertex_index]
            p=vertex.co; n=vertex.normal
            color=tuple(round(v,5) for v in data.color_attributes['Color'].data[loop_index].color[:3])
            if color not in palette: palette.append(color)
            c=palette.index(color)
            qp=tuple(round(v*1000) for v in (p.x,p.z,-p.y))
            qn=tuple(round(v*127) for v in (n.x,n.z,-n.y))
            key=qp+qn+(c,)
            if key not in lookup:
                lookup[key]=len(colors); positions.extend(qp);normals.extend(qn);colors.append(c)
            indices.append(lookup[key])
    exported.append(dict(name=obj.name,positions=positions,normals=normals,colors=colors,indices=indices))
stops=[(-4,.8,10),(3,1,9),(5,1.8,5),(-3,2,4.5),(-5,2.8,0),(3,3,-.5),(5,3.8,-5),(-3,4,-5.5),(-4,4.8,-10),(3,5,-11)]
badges=[]
for index,(x,y,z) in enumerate(stops):
    badge=(x+(-1.2 if x<0 else 1.2),y+2.8,z+.4);badges.append(badge)
    for prefix,point in [('anchor', (x,y,z)),('badge',badge)]:
        empty=bpy.data.objects.new('%s_%d'%(prefix,index),None);bpy.context.collection.objects.link(empty)
        empty.location=(point[0],-point[2],point[1]);empty.empty_display_size=.25
compact=dict(version=1,positionScale=1000,normalScale=127,palette=palette,meshes=exported,anchors=stops,badges=badges)
encoded_json=json.dumps(compact,separators=(',',':')).encode()
with open(os.path.join(ROOT,'public','models','world-terrain.json'),'wb') as f:f.write(encoded_json)
print('TERRAIN_JSON '+json.dumps(dict(bytes=len(encoded_json),gzipBytes=len(gzip.compress(encoded_json)))))
# Neutral actual-mesh review; the runtime floor is owned by Three.
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.world.color=(.17,.22,.24)
bpy.ops.object.camera_add(location=(9,-37,40));cam=bpy.context.object
cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=47;scene.camera=cam
for loc,power,size in [((-14,-10,30),4200,15),((15,10,20),2600,12)]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=750;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(ROOT,'output','current','world-3d','terrain-review.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','world-3d','terrain.blend'))
bpy.ops.render.render(write_still=True)
triangles=sum(len(poly.vertices)-2 for obj in (land,water) for poly in obj.data.polygons)
with open(output,'rb') as f:blob=f.read()
print('TERRAIN_REPORT '+json.dumps({'triangles':triangles,'bytes':len(blob),'gzipBytes':len(gzip.compress(blob)),'bounds':{item['name']:[[min(item['positions'][axis::3])/1000,max(item['positions'][axis::3])/1000] for axis in range(3)] for item in exported}}))
