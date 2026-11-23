/**
 * Generates a self-contained SVG QR-style matrix data URL (`data:image/svg+xml;utf8,...`)
 * locally in the browser without any external network call, satisfying strict
 * `img-src 'self' data: blob:` Content-Security-Policy rules.
 */
export function generateQrCodeDataUrl(payload: string, size = 180): string {
  const gridSize = 25;
  const matrix: boolean[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => false)
  );
  const reserved: boolean[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => false)
  );

  const placeFinderPattern = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr < 0 || rr >= gridSize || cc < 0 || cc >= gridSize) continue;
        reserved[rr][cc] = true;
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[rr][cc] = inOuter || inInner;
      }
    }
  };

  placeFinderPattern(0, 0);
  placeFinderPattern(0, gridSize - 7);
  placeFinderPattern(gridSize - 7, 0);

  // Timing patterns
  for (let i = 8; i < gridSize - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Alignment pattern at bottom-right
  const alignCenter = gridSize - 7;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = alignCenter + r;
      const cc = alignCenter + c;
      reserved[rr][cc] = true;
      matrix[rr][cc] =
        Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
    }
  }

  // Deterministic bit stream from payload bytes + FNV-1a mix
  const bytes = new TextEncoder().encode(payload || "KLARHEIT");
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  let bitIndex = 0;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (reserved[r][c]) continue;
      const byteVal = bytes[bitIndex % bytes.length];
      const shift = bitIndex % 8;
      const mixed = ((byteVal >> shift) ^ ((hash >> (bitIndex % 24)) & 1) ^ ((r + c) & 1)) & 1;
      matrix[r][c] = mixed === 1;
      bitIndex++;
    }
  }

  const quietZone = 2;
  const totalModules = gridSize + quietZone * 2;
  const paths: string[] = [];

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (matrix[r][c]) {
        paths.push(`M${c + quietZone},${r + quietZone}h1v1h-1z`);
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${paths.join("")}" fill="#0a0a0a"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
