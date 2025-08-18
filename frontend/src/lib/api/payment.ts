import { PaymentRequest } from '@/app/payment/page'

export async function fetchFilteredPayments(userName: string) {
  const sheetId = '1x5wH551SVWQqiOXAZD78eLscS9gcBDDKeKkREV6fiSo'
  const sheetName = '일정불참결재시트'
  const query = `SELECT * WHERE A = '${userName}'`
  const url = `/api/sheets/query?spreadsheet_id=${sheetId}&sheet_name=${encodeURIComponent(sheetName)}&query=${encodeURIComponent(query)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('시트 쿼리 실패')
  const data = await res.json()
  // Visualization API JSON 구조에서 rows 추출
  const rows = data.table?.rows || []
  // 각 row의 c 배열에서 값 추출
  return rows.map((row: any, idx: number) => {
    const cells = row.c || []
    return {
      id: `${userName}-${idx}`,
      name: cells[0]?.v || '',
      type: cells[1]?.v || '',
      requestDate: cells[2]?.v || '',
      absentDate: cells[3]?.v || '',
      reason: cells[4]?.v || '',
      approved: cells[5]?.v || '',
      schedule: '',
    } as PaymentRequest
  })
}
