'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import LoadingButton from '@/components/LoadingButton'
import LoadingSpinner from '@/components/LoadingSpinner'

export interface PaymentRequest {
  id: string
  name: string
  requestDate: string
  type: string
  absentDate: string
  schedule: string
  reason: string
  approved: string
}

export default function PaymentPage() {
  const { user, loading: authLoading } = useAuth()
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false) // 결재 신청용
  const [updating, setUpdating] = useState(false) // 수정용
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<PaymentRequest>>({})
  const [form, setForm] = useState<PaymentRequest>({
    id: '',
    name: '',
    requestDate: new Date().toISOString(),
    type: '정기',
    absentDate: shortDate(new Date()),
    schedule: '',
    reason: '',
    approved: '',
  } as PaymentRequest)

  useEffect(() => {
    if (!authLoading && user) {
      setForm((f) => ({
        ...f,
        name: user.name || '',
        userId: (user as any).id || '',
        email: (user as any).email || '',
      }))
    }
  }, [authLoading, user])

  useEffect(() => {
    const load = async () => {
      if (!user?.name) return
      setLoading(true)
      try {
        const { fetchFilteredPayments } = await import('@/lib/api/payment')
        const data = await fetchFilteredPayments(user.name)
        setRequests(data)
      } catch (err) {
        setRequests([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, ...({ [name]: value } as Partial<PaymentRequest>) } as PaymentRequest))
  }

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setEditForm((f) => ({ ...f, [name]: value }))
  }



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      // 시트에 데이터 추가 (통합 CREATE 엔드포인트 사용)
      const { spreadsheetId: sheetId, sheetName } = (await import('@/lib/constants/sheets')).PAYMENT_SHEET
      const row = [
        generateUniqueId(), // 고유 번호 (A)
        user?.name || '',    // 신청자명 (B)
        form.type,           // 구분 (C)
        shortDate(new Date()), // 신청일 (D)
        form.absentDate,     // 불참일 (E)
        form.schedule,       // 일정 (F)
        form.reason,         // 사유 (G)
        '대기',              // 상태 (H)
      ]
      const query = `INSERT ${JSON.stringify(row)}`
      const { sheetsCreate } = await import('@/lib/api/sheetsClient')
      const result = await sheetsCreate(sheetId, sheetName, query)
      // 성공 시 최신 목록 재조회
      try {
        const { fetchFilteredPayments } = await import('@/lib/api/payment')
        if (user?.name) {
          const data = await fetchFilteredPayments(user.name)
          setRequests(data)
        }
      } catch { }
      setForm((f) => ({ ...f, type: '정기', absentDate: shortDate(new Date()), reason: '' }))
    } finally {
      setSubmitting(false)
    }
  }

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (request: PaymentRequest) => {
    if (!window.confirm('정말로 이 신청을 삭제하시겠습니까?')) return
    if (deletingId) return // 이미 삭제 중인 경우 중복 실행 방지

    try {
      setDeletingId(request.id) // 삭제 시작

      // 시트에서 데이터 삭제 (통합 DELETE: spreadsheet_id, sheet_name, query)
      const { PAYMENT_SHEET } = await import('@/lib/constants/sheets')
      const { sheetsDelete, escapeSheetString } = await import('@/lib/api/sheetsClient')
      const query = `SELECT * WHERE A = '${escapeSheetString(request.id)}'`
      await sheetsDelete(PAYMENT_SHEET.spreadsheetId, PAYMENT_SHEET.sheetName, query)
      // 삭제 후 목록 갱신
      try {
        const { fetchFilteredPayments } = await import('@/lib/api/payment')
        if (user?.name) {
          const data = await fetchFilteredPayments(user.name)
          setRequests(data)
        }
      } catch { }
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingId(null) // 삭제 완료
    }
  }

  const handleEditStart = (r: PaymentRequest) => {
    setEditingId(r.id)
    setEditForm({
      type: r.type,
      absentDate: r.absentDate,
      schedule: r.schedule,
      reason: r.reason,
    })
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleUpdate = async (original: PaymentRequest) => {
    if (!editingId) return
    try {
      setUpdating(true)
      const { PAYMENT_SHEET } = await import('@/lib/constants/sheets')
      const updatedRow = [
        original.id,
        original.name,
        editForm.type ?? original.type,
        original.requestDate || shortDate(new Date()),
        editForm.absentDate ?? original.absentDate,
        editForm.schedule ?? original.schedule,
        editForm.reason ?? original.reason,
        original.approved || '대기',
      ]
      const { sheetsUpdate } = await import('@/lib/api/sheetsClient')
      const query = `UPDATE id=${JSON.stringify(original.id)} VALUES ${JSON.stringify(updatedRow)}`
      await sheetsUpdate(PAYMENT_SHEET.spreadsheetId, PAYMENT_SHEET.sheetName, query)
      // 갱신 후 목록 재조회
      try {
        const { fetchFilteredPayments } = await import('@/lib/api/payment')
        if (user?.name) {
          const data = await fetchFilteredPayments(user.name)
          setRequests(data)
        }
      } catch { }
      setEditingId(null)
      setEditForm({})
    } catch (err) {
      console.error('Update failed:', err)
      alert('수정 중 오류가 발생했습니다.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-[calc(100svh-52px-0.5rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100svh-52px-0.5rem)]">
      <div className="flex flex-col gap-[0.5rem]">
        <div className="mx-[0.5rem] p-[1rem] bg-white rounded-xl">
          {/* 신청 폼 */}
          <form onSubmit={handleSubmit} className="flex justify-center">
            <div className="w-[50rem] flex flex-col gap-[0.5rem]">

              {/* 결재 유형 */}
              <div className="flex flex-col gap-[0.25rem]">
                <label className="text-sm" htmlFor="type">결재 유형</label>
                <select id="type" name="type" value={form.type} onChange={handleChange} className="grow-1">
                  <option value="정기">정기</option>
                  <option value="비정기">비정기</option>
                  <option value="추가요청">추가요청</option>
                  <option value="사후알림">사후알림</option>
                  <option value="야근신청">야근신청</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              {/* 불참일 */}
              <div className="flex flex-col gap-[0.25rem]">
                <label className="text-sm" htmlFor="absentDate">불참일</label>
                <input
                  type="date"
                  id="absentDate"
                  name="absentDate"
                  value={form.absentDate}
                  onChange={handleChange}
                  className=""
                  required
                />
              </div>

              {/* 불참 일정 */}
              <div className="flex flex-col gap-[0.25rem]">
                <label className="text-sm" htmlFor="schedule">불참 일정</label>
                <input
                  type="text"
                  id="schedule"
                  name="schedule"
                  value={form.schedule}
                  onChange={handleChange}
                  placeholder="예) 청붓 일정 불참"
                  className="border border-gray-300 rounded px-3 py-2"
                />
              </div>

              {/* 사유 */}
              <div className="flex flex-col gap-[0.25rem]">
                <label className="text-sm" htmlFor="reason">사유</label>
                <textarea
                  id="reason"
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  placeholder="예) 불교대 반담당회의 (20:00-21:30)"
                  rows={4}
                />
              </div>

              <LoadingButton type="submit" className="purple" loading={submitting}>
                결재 신청
              </LoadingButton>
            </div>
          </form>
        </div>

        {/* 신청 목록 */}
        <div className="mx-[0.5rem] p-[1rem] bg-white rounded-xl flex justify-center">

          {requests.length === 0 ? (
            <div className="text-dark-gray">신청 현황이 없습니다.</div>
          ) : (
            <div className="table-wrapper w-[50rem]">
              <table className="max-w-full">
                <thead>
                  <tr className="">
                    <th className="">구분</th>
                    <th className="">신청 날짜</th>
                    <th className="">불참일</th>
                    <th className="">불참 일정</th>
                    <th className="">사유</th>
                    <th className="">결재 상태</th>
                    <th className="">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const isEditing = editingId === r.id
                    return (
                      <tr key={r.id} className="">
                        <td className="">
                          {isEditing ? (
                            <select name="type" value={editForm.type ?? r.type} onChange={handleEditChange} className="text-sm">
                              <option value="정기">정기</option>
                              <option value="비정기">비정기</option>
                              <option value="추가요청">추가요청</option>
                              <option value="사후알림">사후알림</option>
                              <option value="야근신청">야근신청</option>
                              <option value="기타">기타</option>
                            </select>
                          ) : (
                            r.type
                          )}
                        </td>
                        <td className="">{r.requestDate || '-'}</td>
                        <td className="">
                          {isEditing ? (
                            <input type="date" name="absentDate" value={editForm.absentDate ?? r.absentDate} onChange={handleEditChange} className="text-sm" />
                          ) : (
                            r.absentDate
                          )}
                        </td>
                        <td className="">
                          {isEditing ? (
                            <input type="text" name="schedule" value={editForm.schedule ?? r.schedule} onChange={handleEditChange} className="text-sm border border-gray-300 rounded px-2 py-1" />
                          ) : (
                            r.schedule || '-'
                          )}
                        </td>
                        <td className="">
                          {isEditing ? (
                            <input type="text" name="reason" value={editForm.reason ?? r.reason} onChange={handleEditChange} className="text-sm border border-gray-300 rounded px-2 py-1 w-full" />
                          ) : (
                            r.reason || '-'
                          )}
                        </td>
                        <td className="">{r.approved || '대기'}</td>
                        <td className="flex justify-center gap-[0.25rem]">
                          {isEditing ? (
                            <>
                              <button onClick={() => handleUpdate(r)} className="text-sm purple" disabled={updating}>
                                {updating ? '저장 중...' : '저장'}
                              </button>
                              <button onClick={handleEditCancel} className="text-sm gray">취소</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleEditStart(r)} className="text-sm purple" disabled={deletingId === r.id}>수정</button>
                              <button
                                onClick={() => handleDelete(r)}
                                className="text-sm red"
                                disabled={deletingId === r.id}
                              >
                                {deletingId === r.id ? '삭제 중...' : '삭제'}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(d: string) {
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt.toLocaleString()
  } catch (e) {
    return d
  }
}

function generateUniqueId(): string {
  // 간단한 고유 ID 생성기 (타임스탬프 + 랜덤 숫자)
  return `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function shortDate(dt: Date) {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
