'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import LoadingButton from '@/components/LoadingButton'
import LoadingSpinner from '@/components/LoadingSpinner'

interface PaymentRequest {
  id: string
  name: string
  requestDate: string
  type: string
  absentDate: string
  schedule?: string
  email?: string
  reason?: string
  approved?: string
  note?: string
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
    type: '불참',
    absentDate: '',
    schedule: '',
    reason: '',
    approved: '',
    note: '',
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
      try {
        setLoading(true)
        const res = await fetch('/api/payment')
        const data = await res.json()
        setRequests(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, ...({ [name]: value } as Partial<PaymentRequest>) } as PaymentRequest))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const payload = { ...form, requestDate: new Date().toISOString() }
      await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const res = await fetch('/api/payment')
      const data = await res.json()
      setRequests(data)
      setForm((f) => ({ ...f, type: '불참', absentDate: '', schedule: '' }))

      // Append to Google Sheets (A2:G2) using server-side OAuth token
      try {
        const sheetId = '1x5wH551SVWQqiOXAZD78eLscS9gcBDDKeKkREV6fiSo'
        const range = '일정불참결재시트!A2:G2'
        const row = [
          (form as any).name || '',
          form.type || '',
          shortDate(new Date()),
          form.absentDate || '',
          (form as any).schedule || '',
          '대기',
          (form as any).note || '',
        ]
        await fetch('/api/sheets/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spreadsheet_id: sheetId, range, values: [row], append: true }),
        })
      } catch (err) {
        console.warn('스프레드시트 기록 실패', err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="결재 페이지를 불러오는 중..." />
      </div>
    )
  }

  return (
    <div className="bg-gray p-[1rem] min-h-[calc(100svh-44px)] flex flex-col pb-[48px]">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 신청 폼 */}
        <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 사용자 이름/이메일 등은 내부적으로 폼에 포함되어 전송되지만 UI에는 노출하지 않습니다. */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select name="type" value={form.type} onChange={handleChange} className="input">
                <option value="불참">불참</option>
                <option value="부분불참">부분불참</option>
                <option value="외출">외출</option>
              </select>

              <input
                type="date"
                name="absentDate"
                value={form.absentDate}
                onChange={handleChange}
                className="input"
                required
              />

              <input
                type="text"
                name="reason"
                value={(form as any).reason}
                onChange={handleChange}
                placeholder="사유를 직접 작성해주세요"
                className="input"
              />
            </div>

            <LoadingButton type="submit" loading={submitting} className="button default w-full">
              결재 신청
            </LoadingButton>
          </form>
        </div>

        {/* 신청 목록 */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">신청 내역</h2>

          {requests.length === 0 ? (
            <div className="text-gray-500">신청 내역이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="text-left bg-gray-50">
                    <th className="p-3 border">구분</th>
                    <th className="p-3 border">일정일</th>
                    <th className="p-3 border">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3 border">{r.type}</td>
                      <td className="p-3 border">{r.absentDate}</td>
                      <td className="p-3 border">{r.reason || '-'}</td>
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
