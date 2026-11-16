/** Reserve the 36px More button and 8px gaps before choosing a visible prefix. */
export function fittingNavigationCount(widths: number[], available: number, inlineLimit: number) {
  const limit = Math.min(inlineLimit, widths.length);
  const allWidth = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 8;
  if (limit === widths.length && allWidth <= available) return limit;
  let count = 0;
  let used = 36;
  while (count < limit && used + 8 + widths[count] <= available) {
    used += 8 + widths[count];
    count++;
  }
  return count;
}
