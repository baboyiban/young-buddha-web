// 날짜 기반 행 계산 (기준일로부터 며칠 지났는지)
export function calculateRowFromDate(
  baseDate: string,
  baseRow: number
): number {
  const base = new Date(baseDate);
  const today = new Date();

  // 시간 차이를 일 단위로 계산
  const timeDiff = today.getTime() - base.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

  return baseRow + daysDiff;
}

// 날짜 기반 범위 생성
export function createDateBasedRange(
  sheetName: string,
  baseDate: string,
  baseRow: number,
  startCol: string = "A",
  endCol: string = "R"
): string {
  const currentRow = calculateRowFromDate(baseDate, baseRow);
  return `${sheetName}!${startCol}${currentRow}:${endCol}${currentRow}`;
}
