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
  timeSlot?: string
}

export default function PaymentPage() {
  const { user, loading: authLoading } = useAuth()
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: '불참',
    absentDate: '',
    timeSlot: '',
  })

  useEffect(() => {
    if (!authLoading && user) {
      setForm((f) => ({ ...f, name: user.name || '' }))
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
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const res = await fetch('/api/payment')
      const data = await res.json()
      setRequests(data)
      setForm((f) => ({ ...f, type: '불참', absentDate: '', timeSlot: '' }))
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
    <div className="bg-gray min-h-screen flex flex-col pb-[48px]">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 신청 폼 */}
        <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="이름"
                className="input w-full"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select name="type" value={form.type} onChange={handleChange} className="input">
                <option value="불참">불참</option>
                <option value="지각">지각</option>
              </select>

              <input
                type="date"
                name="absentDate"
                value={form.absentDate}
                onChange={handleChange}
                className="input"
                required
              />

              <select name="timeSlot" value={form.timeSlot} onChange={handleChange} className="input">
                <option value="">시간 선택 (선택)</option>
                <option value="오전">오전</option>
                <option value="오후">오후</option>
                <option value="저녁">저녁</option>
              </select>
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
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="border rounded p-4">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-gray-600">{r.requestDate}</div>
                  <div>
                    {r.type} - {r.absentDate} {r.timeSlot && `(${r.timeSlot})`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}