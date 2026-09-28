import ranges from "@/lib/data/us-zip-states.json";

/** Exact GeoNames ZIP memberships, compressed only across consecutive known codes. */
export function postalZip(postcode?: string): string | undefined {
  return postcode?.trim().match(/^(\d{5})(?:-\d{4})?$/)?.[1];
}

export function stateForZip(postcode?: string): string | undefined {
  const zip = postalZip(postcode);
  if (!zip) return undefined;
  const code = Number(zip);
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const [start, end, state] = ranges[mid];
    if (code < Number(start)) high = mid - 1;
    else if (code > Number(end)) low = mid + 1;
    else return String(state);
  }
  return undefined;
}
