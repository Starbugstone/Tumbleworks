"""Losslessly pack integer mesh arrays into deterministic little-endian streams.

Usage: python3 scripts/pack-world-models.py input.json output.json
Unrelated asset, mesh and pivot metadata is retained verbatim.
"""
import argparse
import base64
import gzip
import json
from pathlib import Path
import struct


def stream(values, code, minimum, maximum):
    if any(type(value) is not int or not minimum <= value <= maximum for value in values):
        raise ValueError(f'Mesh stream exceeds {code} integer range [{minimum}, {maximum}]')
    binary = struct.pack('<' + code * len(values), *values)
    encoded = base64.b64encode(binary).decode('ascii')
    decoded = list(struct.unpack('<' + code * len(values), base64.b64decode(encoded, validate=True)))
    if decoded != values:
        raise ValueError('Packed stream failed exact round-trip')
    return encoded


def pack(document):
    if document.get('encoding') == 'base64-le':
        raise ValueError('Input is already packed')
    result = dict(document, encoding='base64-le')
    result['meshes'] = []
    for original in document['meshes']:
        positions, normals, colors, indices = (original[key] for key in ('positions', 'normals', 'colors', 'indices'))
        count = len(colors)
        if len(positions) != 3 * count or len(normals) != 3 * count:
            raise ValueError(f"{original['name']}: inconsistent vertex attribute lengths")
        if len(indices) % 3 or any(type(index) is not int or index < 0 or index >= count for index in indices):
            raise ValueError(f"{original['name']}: invalid triangle index")
        if any(type(color) is not int or color < 0 or color >= len(document['palette']) for color in colors):
            raise ValueError(f"{original['name']}: invalid palette index")
        wide = max(indices, default=0) > 65535
        mesh = dict(original)
        mesh.update(
            positions=stream(positions, 'h', -32768, 32767),
            normals=stream(normals, 'b', -128, 127),
            colors=stream(colors, 'B', 0, 255),
            indices=stream(indices, 'I' if wide else 'H', 0, 4294967295 if wide else 65535),
            indexType='uint32' if wide else 'uint16',
            vertexCount=count,
            indexCount=len(indices),
        )
        # Serialize topology before vertex attributes for smaller deterministic gzip output.
        order = ('name', 'model', 'part', 'pivot', 'indices', 'positions', 'normals', 'colors',
                 'indexType', 'vertexCount', 'indexCount')
        result['meshes'].append({**{key: mesh[key] for key in order if key in mesh},
                                 **{key: value for key, value in mesh.items() if key not in order}})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    original = args.input.read_bytes()
    document = json.loads(original)
    packed = pack(document)
    encoded = json.dumps(packed, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(encoded)
    print(json.dumps(dict(input=str(args.input), output=str(args.output), bytes=len(encoded),
                         gzipBytes=len(gzip.compress(encoded, compresslevel=9, mtime=0)),
                         originalGzipBytes=len(gzip.compress(original, compresslevel=9, mtime=0)),
                         vertices=sum(mesh['vertexCount'] for mesh in packed['meshes']),
                         triangles=sum(mesh['indexCount'] // 3 for mesh in packed['meshes']))))


if __name__ == '__main__':
    main()
