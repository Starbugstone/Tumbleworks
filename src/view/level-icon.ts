/** Small silhouettes identify the games without using cargo colours. */
export function levelIcon(kind: string): SVGSVGElement {
  const paths: Readonly<Record<string, string>> = {
    conveyor: 'M4 5h28L21 18v6h-6v-6L4 5ZM6 29h24M8 25h20a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8Z',
    loop: 'M3 9h20v17H3V9Zm20 6h6l5 6v5H23V15ZM7 26a4 4 0 1 0 8 0m10 0a4 4 0 1 0 8 0M27 18v4h7',
    tube: 'M5 4h9M7 4v22a3 3 0 0 0 6 0V4M22 4h9M24 4v22a3 3 0 0 0 6 0V4M7 17h6M24 22h6M7 23h6M24 16h6',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 36 36');
  svg.setAttribute('class', 'level-icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[kind] ?? paths['tube']!);
  svg.append(path);
  return svg;
}
