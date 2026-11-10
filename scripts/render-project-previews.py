"""Render actual shared-kit reward compositions as transparent Atelier card previews.
Blender --background --threads 2 --python scripts/render-project-previews.py
"""
import bpy, json, os, math, struct, zlib
from collections import Counter
from mathutils import Matrix, Vector, Euler

def compact_png(path):
    """Deterministic indexed PNG encoding of the rendered pixels, preserving alpha."""
    raw=open(path,'rb').read();offset=8;data=b''
    while offset<len(raw):
        size=struct.unpack_from('>I',raw,offset)[0];kind=raw[offset+4:offset+8];payload=raw[offset+8:offset+8+size];offset+=size+12
        if kind==b'IHDR':width,height,depth,color,_,_,_=struct.unpack('>IIBBBBB',payload)
        if kind==b'IDAT':data+=payload
    assert depth==8 and color==6
    filtered=zlib.decompress(data);stride=width*4;previous=bytearray(stride);pixels=[]
    for row in range(height):
        mode=filtered[row*(stride+1)];scan=bytearray(filtered[row*(stride+1)+1:(row+1)*(stride+1)])
        for i in range(stride):
            left=scan[i-4]if i>=4 else 0;up=previous[i];corner=previous[i-4]if i>=4 else 0
            predictor=left+up-corner;distances=[abs(predictor-left),abs(predictor-up),abs(predictor-corner)]
            paeth=[left,up,corner][distances.index(min(distances))]
            scan[i]=(scan[i]+[0,left,up,(left+up)//2,paeth][mode])%256
        pixels.extend(tuple(scan[i:i+4])if scan[i+3]else(0,0,0,0)for i in range(0,stride,4));previous=scan
    histogram=Counter(pixels);opaque=[color for color in histogram if color[3]>0];buckets=[opaque]
    def spread(bucket):return max(max(color[i]for color in bucket)-min(color[i]for color in bucket)for i in range(4))
    while len(buckets)<191:
        options=[(spread(bucket)*sum(histogram[c]for c in bucket)**.5,index)for index,bucket in enumerate(buckets)if len(bucket)>1]
        if not options:break
        _,index=max(options);bucket=buckets.pop(index)
        channel=max(range(4),key=lambda i:max(c[i]for c in bucket)-min(c[i]for c in bucket));bucket.sort(key=lambda c:c[channel])
        total=sum(histogram[c]for c in bucket);count=0;split=1
        for split,c in enumerate(bucket[:-1],1):
            count+=histogram[c]
            if count>=total/2:break
        buckets.extend([bucket[:split],bucket[split:]])
    palette=[(0,0,0,0)];lookup={(0,0,0,0):0}
    for bucket in buckets:
        total=sum(histogram[c]for c in bucket)
        average=tuple(round(sum(c[i]*histogram[c]for c in bucket)/total)for i in range(4))
        for color in bucket:lookup[color]=len(palette)
        palette.append(average)
    def chunk(kind,payload):return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload)&0xffffffff)
    rows=b''.join(bytes([0])+bytes(lookup[p]for p in pixels[row*width:(row+1)*width])for row in range(height))
    result=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,3,0,0,0))
    result+=chunk(b'PLTE',bytes(v for color in palette for v in color[:3]))+chunk(b'tRNS',bytes(color[3]for color in palette))
    result+=chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b'')
    with open(path,'wb')as file:file.write(result)

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(ROOT,'public','models','world-kit.json')) as file: kit=json.load(file)
with open(os.path.join(ROOT,'assets','world-3d','project-recipes.json')) as file: recipes=json.load(file)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
material=bpy.data.materials.new('world-solid');material.use_nodes=True;material.use_backface_culling=True
shader=material.node_tree.nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.9
color=material.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name='Color'
material.node_tree.links.new(color.outputs['Color'],shader.inputs['Base Color'])
# Three Y-up => Blender Z-up, a proper rotation retaining triangle winding.
conversion=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
templates={}
for source in kit['meshes']:
    positions=source['positions']; indices=source['indices'];scale=kit['positionScale']
    vertices=[(positions[i]/scale,-positions[i+2]/scale,positions[i+1]/scale)for i in range(0,len(positions),3)]
    faces=[indices[i:i+3]for i in range(0,len(indices),3)]
    mesh=bpy.data.meshes.new(source['name']);mesh.from_pydata(vertices,[],faces);mesh.update();mesh.materials.append(material)
    attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for index,palette_index in enumerate(source['colors']):attr.data[index].color=(*kit['palette'][palette_index],1)
    # Preserve exported smooth/flat corner normals exactly as the runtime sees them.
    normals=source['normals']; ns=kit['normalScale']
    authored=[Vector((normals[i]/ns,-normals[i+2]/ns,normals[i+1]/ns)).normalized()for i in range(0,len(normals),3)]
    for polygon in mesh.polygons:polygon.use_smooth=True
    mesh.normals_split_custom_set_from_vertices(authored)
    templates.setdefault(source.get('model',source['name']),[]).append((mesh,source.get('pivot',[0,0,0])))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.film_transparent=True
scene.render.resolution_x=128;scene.render.resolution_y=128;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.compression=100
scene.world.color=(.2,.24,.25);scene.view_settings.view_transform='AgX'
bpy.ops.object.camera_add(location=(4,-6,4));camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=3.0
for location,power,size in [((-3,-4,7),650,5),((4,2,5),450,4)]:
    bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=power;light.data.size=size
    light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
output=os.path.join(ROOT,'public','models','projects');os.makedirs(output,exist_ok=True)
all_groups=[];report=[]
for reward,pieces in recipes.items():
    collection=bpy.data.collections.new('project-'+reward);scene.collection.children.link(collection);all_groups.append(collection)
    for piece in pieces:
        position=Vector(piece['position']);sx,sy,sz=piece['scale'];rx,ry,rz=piece['rotation']
        # Three Euler XYZ is Rx * Ry * Rz for column vectors.
        rotation=Matrix.Rotation(rx,4,'X') @ Matrix.Rotation(ry,4,'Y') @ Matrix.Rotation(rz,4,'Z')
        transform=Matrix.Translation(position) @ rotation @ Matrix.Diagonal((sx,sy,sz,1))
        for mesh,pivot in templates[piece['model']]:
            obj=bpy.data.objects.new(piece['model'],mesh);collection.objects.link(obj)
            obj.matrix_world=conversion @ transform @ Matrix.Translation(Vector(pivot)) @ conversion.inverted()
    bpy.context.view_layer.update()
    coords=[obj.matrix_world @ Vector(corner)for obj in collection.objects for corner in obj.bound_box]
    low=Vector(tuple(min(c[i]for c in coords)for i in range(3)));high=Vector(tuple(max(c[i]for c in coords)for i in range(3)))
    center=(low+high)*.5;camera.location=center+Vector((4,-6,4.7));camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=max(high.z-low.z,high.x-low.x,high.y-low.y)*1.45
    scene.render.filepath=os.path.join(output,reward+'.png');bpy.ops.render.render(write_still=True);compact_png(scene.render.filepath)
    collection.hide_render=True
    report.append(dict(reward=reward,bytes=os.path.getsize(scene.render.filepath),triangles=sum(len(p.vertices)-2 for obj in collection.objects for p in obj.data.polygons),bounds=[list(low),list(high)]))
for collection in all_groups:collection.hide_render=False
# Separate the editable compositions for inspection, without changing saved shared recipes.
for index,collection in enumerate(all_groups):
    for obj in collection.objects:obj.location.x+=(index%4)*3.5;obj.location.y+=(index//4)*4
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','world-3d','projects.blend'))
with open(os.path.join(ROOT,'output','current','world-3d','project-preview-report.json'),'w')as file:json.dump(report,file,indent=2)
print('PROJECT_PREVIEWS '+json.dumps(report))
