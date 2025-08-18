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
  const [submitting, setSubmitting] = useState(false)
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



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      // 시트에 데이터 추가
      const sheetId = '1x5wH551SVWQqiOXAZD78eLscS9gcBDDKeKkREV6fiSo'
      const range = '일정불참결재시트!A2:F2'
      // range A..F 는 6개 열이므로 values도 6개만 전달해야 합니다.
      const row = [
        user?.name || '',
        form.type,
        shortDate(new Date()), // 신청 날짜
        form.absentDate,
        form.schedule,
        form.reason,
        '대기',
      ]
      const res = await fetch('/api/sheets/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheet_id: sheetId, range, values: [row], append: true }),
      })
      const result = await res.json()
      if (!res.ok) {
        console.error('sheets write failed', result)
        throw new Error(result?.message || 'Sheets write failed')
      }
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

  if (loading || authLoading) {
    return (
      <div className="min-h-[calc(100svh-52px-0.5rem)] flex items-center justify-center">
        <LoadingSpinner message="페이지를 불러오는 중..." />
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
                  placeholder="불참할 일정을 입력해주세요 (예: 10:00-12:00, 오전 세미나)"
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
                  placeholder="사유를 직접 작성해주세요"
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
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="">
                      <td className="">{r.type}</td>
                      <td className="">{r.requestDate || '-'}</td>
                      <td className="">{r.absentDate}</td>
                      <td className="">{r.schedule || '-'}</td>
                      <td className="">{r.reason || '-'}</td>
                      <td className="">{r.approved || '대기'}</td>
                    </tr>
                  ))}
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

function shortDate(dt: Date) {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
