import { PaymentRequest } from '@/app/payment/page'

export async function fetchFilteredPayments(userName: string) {
  const sheetId = '1x5wH551SVWQqiOXAZD78eLscS9gcBDDKeKkREV6fiSo'
  const sheetName = '일정불참결재시트'
  const query = `SELECT * WHERE B = '${userName}'`
  const url = `/api/sheets/read?spreadsheet_id=${sheetId}&sheet_name=${encodeURIComponent(sheetName)}&read=${encodeURIComponent(query)}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    let body: any = undefined
    try { body = await res.json() } catch { /* ignore */ }
    console.error('sheets read failed', res.status, body)
    throw new Error(body?.message || '시트 쿼리 실패')
  }
  const data = await res.json()
  // Visualization API JSON 구조에서 rows 추출
  const rows = data.table?.rows || []
  // 각 row의 c 배열에서 값 추출
  return rows.map((row: any, idx: number) => {
    const cells = row.c || []
    return {
      id: cells[0]?.v || `${userName}-${idx}`,
      name: cells[1]?.v || '',
      type: cells[2]?.v || '',
      requestDate: cells[3]?.v || '',
      absentDate: cells[4]?.v || '',
      schedule: cells[5]?.v || '',
      reason: cells[6]?.v || '',
      approved: cells[7]?.v || '',
    } as PaymentRequest
  })
}
