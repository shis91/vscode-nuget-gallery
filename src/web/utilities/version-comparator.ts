export function compareVersions(v1: string, v2: string): number {
  if (v1 === v2) return 0;

  const parts1 = v1.split(/[-.]/).filter(x => x !== '');
  const parts2 = v2.split(/[-.]/).filter(x => x !== '');

  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const p1 = parts1[i];
    const p2 = parts2[i];

    if (p1 === undefined) return -1; // v1 is shorter, so it's smaller? Wait, 1.0 vs 1.0.1. 1.0 < 1.0.1.
    if (p2 === undefined) return 1;

    const n1 = parseInt(p1);
    const n2 = parseInt(p2);

    if (!isNaN(n1) && !isNaN(n2)) {
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    } else {
      // String comparison for pre-release tags or non-numeric parts
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
  }

  return 0;
}
