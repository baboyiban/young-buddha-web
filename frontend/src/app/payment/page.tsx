'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import LoadingButton from '@/components/LoadingButton'
import LoadingSpinner from '@/components/LoadingSpinner'
import AppLayout from '@/components/AppLayout'

interface PaymentRequest {
  id: string
  name: string
  requestDate: string
  type: string
  absentDate: string
  timeSlot?: string
  reason?: string
  status: string
}

export default function PaymentPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [paymentList, setPaymentList] = useState<PaymentRequest[]>([])
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    request_date: '',
    absent_date: '',
    time_slot: '',
    reason: ''
  })

  useEffect(() => {
    if (user) {
      setFormData(prev => ({ ...prev, name: user.name || '' }))
      loadPaymentList()
    }
  }, [user])

  const loadPaymentList = async () => {
    try {
      const response = await fetch('/api/payment')
      const data = await response.json()
      setPaymentList(data)
    } catch (error) {
      console.error('결재 목록 로드 실패:', error)
    } finally {
      setInitialLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('신청 실패')

      const result = await response.json()
      alert(result.message || '신청 완료!')

      // 폼 초기화 (이름 제외)
      setFormData(prev => ({
        name: prev.name,
        type: '',
        request_date: '',
        absent_date: '',
        time_slot: '',
        reason: ''
      }))

      // 목록 새로고침
      await loadPaymentList()
    } catch (error) {
      console.error('결재 신청 실패:', error)
      alert('신청 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="결재 페이지를 불러오는 중..." />
      </div>
    )
  }

  return (
    <AuthGuard>
      <AppLayout>
        <div className="bg-gray min-h-screen flex flex-col pb-[48px]">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            {/* 신청 폼 */}
            <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    name="name"
                    placeholder="이름"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <input
                    name="type"
                    placeholder="유형(연차 등)"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    신청일
                  </label>
                  <input
                    name="request_date"
                    type="date"
                    value={formData.request_date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    불참일
                  </label>
                  <input
                    name="absent_date"
                    type="date"
                    value={formData.absent_date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <input
                    name="time_slot"
                    placeholder="시간대(오전/오후 등)"
                    value={formData.time_slot}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <input
                    name="reason"
                    placeholder="사유"
                    value={formData.reason}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <LoadingButton
                  type="submit"
                  loading={loading}
                  className="button purple w-full"
                >
                  신청
                </LoadingButton>
              </form>
            </div>

            {/* 구분선 */}
            <hr className="border-gray-300 mb-8" />

            {/* 최근 결재 요청 */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">최근 결재 요청</h3>

              {paymentList.length === 0 ? (
                <p className="text-gray-500 text-center py-4">결재 요청이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {paymentList.map((payment) => (
                    <div key={payment.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{payment.name}</div>
                        <span className={`px-2 py-1 rounded text-sm ${payment.status === '대기' ? 'bg-yellow-100 text-yellow-800' :
                          payment.status === '승인' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                          {payment.status}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div>유형: {payment.type}</div>
                        <div>신청일: {payment.requestDate}</div>
                        <div>불참일: {payment.absentDate}</div>
                        {payment.timeSlot && <div>시간대: {payment.timeSlot}</div>}
                        {payment.reason && <div>사유: {payment.reason}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
      )
}