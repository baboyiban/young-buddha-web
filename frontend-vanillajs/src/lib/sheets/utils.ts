export function calculateRowFromDate(
  baseDate: string,
  baseRow: number,
): number {
  const baseDateObj = new Date(baseDate);
  const currentDate = new Date();
  const timeDiff = currentDate.getTime() - baseDateObj.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
  return baseRow + daysDiff;
}

export function createDateBasedRange(
  sheetName: string,
  baseDate: string,
  baseRow: number,
  startCol = "A",
  endCol = "R",
): string {
  const currentRow = calculateRowFromDate(baseDate, baseRow);
  return `${sheetName}!${startCol}${currentRow}:${endCol}${currentRow}`;
}
