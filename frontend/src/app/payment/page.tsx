'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import LoadingButton from '@/components/LoadingButton'
import LoadingSpinner from '@/components/LoadingSpinner'
import { fetchFilteredPayments } from '@/lib/api/payment'
import { sheetsCreate, sheetsDelete, sheetsUpdate, escapeSheetString } from '@/lib/api/sheets/client'
import { PAYMENT_SHEET } from '@/lib/constants/sheets'

// 타입 정의
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

// 헬퍼 함수
function formatDate(d: string): string {
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt.toLocaleString()
  } catch (e) {
    return d
  }
}

function generateUniqueId(): string {
  return `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

function shortDate(dt: Date): string {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function PaymentPage() {
  // 상태 관리
  const { user, loading: authLoading } = useAuth()
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<PaymentRequest>>({})
  
  // 폼 상태
  const [form, setForm] = useState<PaymentRequest>({
    id: '',
    name: '',
    requestDate: new Date().toISOString(),
    type: '정기',
    absentDate: shortDate(new Date()),
    schedule: '',
    reason: '',
    approved: '',
  })

  // 인증 상태 초기화
  useEffect(() => {
    if (!authLoading && user) {
      setForm(prev => ({
        ...prev,
        name: user.name || '',
      }))
    }
  }, [authLoading, user])

  // 결재 요청 데이터 로딩
  useEffect(() => {
    const loadPayments = async () => {
      if (!user?.name) return
      setLoading(true)
      try {
        const data = await fetchFilteredPayments(user.name)
        setRequests(data)
      } catch (err) {
        console.error('Failed to load payments:', err)
        setRequests([])
      } finally {
        setLoading(false)
      }
    }
    
    loadPayments()
  }, [user])

  // 폼 값 변경 핸들러
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setEditForm(prev => ({ ...prev, [name]: value }))
  }

  // 결재 신청 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.name) return
    
    try {
      setSubmitting(true)
      
      const row = [
        generateUniqueId(),
        user.name,
        form.type,
        shortDate(new Date()),
        form.absentDate,
        form.schedule,
        form.reason,
        '대기'
      ]
      
      await sheetsCreate(PAYMENT_SHEET.spreadsheetId, PAYMENT_SHEET.sheetName, `INSERT ${JSON.stringify(row)}`)
      
      // 신청 후 목록 갱신
      const data = await fetchFilteredPayments(user.name)
      setRequests(data)
      
      // 폼 초기화
      setForm(prev => ({
        ...prev,
        type: '정기',
        absentDate: shortDate(new Date()),
        reason: '',
      }))
    } catch (err) {
      console.error(' 결재 신청 실패:', err)
      alert('결재 신청에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // 삭제 상태 관리
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 삭제 핸들러
  const handleDelete = async (request: PaymentRequest) => {
    if (!window.confirm('정말로 이 신청을 삭제하시겠습니까?')) return
    if (deletingId) return
    
    try {
      setDeletingId(request.id)
      
      const query = `SELECT * WHERE A = '${escapeSheetString(request.id)}'`
      await sheetsDelete(PAYMENT_SHEET.spreadsheetId, PAYMENT_SHEET.sheetName, query)
      
      // 삭제 후 목록 갱신
      const data = await fetchFilteredPayments(user?.name || '')
      setRequests(data)
    } catch (err) {
      console.error('삭제 실패:', err)
      alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  // 수정 시작 핸들러
  const handleEditStart = (r: PaymentRequest) => {
    setEditingId(r.id)
    setEditForm({
      type: r.type,
      absentDate: r.absentDate,
      schedule: r.schedule,
      reason: r.reason,
    })
  }

  // 수정 취소 핸들러
  const handleEditCancel = () => {
    setEditingId(null)
    setEditForm({})
  }

  // 수정 제출 핸들러
  const handleUpdate = async (original: PaymentRequest) => {
    if (!editingId) return
    
    try {
      setUpdating(true)
      
      const updatedRow = [
        original.id,
        original.name,
        editForm.type ?? original.type,
        original.requestDate,
        editForm.absentDate ?? original.absentDate,
        editForm.schedule ?? original.schedule,
        editForm.reason ?? original.reason,
        original.approved || '대기'
      ]
      
      await sheetsUpdate(PAYMENT_SHEET.spreadsheetId, PAYMENT_SHEET.sheetName, `UPDATE id=${JSON.stringify(original.id)} VALUES ${JSON.stringify(updatedRow)}`)
      
      // 갱신 후 목록 갱신
      const data = await fetchFilteredPayments(user?.name || '')
      setRequests(data)
      
      handleEditCancel()
    } catch (err) {
      console.error('수정 실패:', err)
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
        {/* 신청 폼 */}
        <div className="mx-[0.5rem] p-[1rem] bg-white rounded-xl">
          <form onSubmit={handleSubmit} className="flex justify-center">
            <div className="w-[50rem] flex flex-col gap-[0.5rem]">
              {/* 결재 유형 */}
              <div className="flex flex-col gap-[0.25rem]">
                <label className="text-sm" htmlFor="type">결재 유형</label>
                <select 
                  id="type" 
                  name="type" 
                  value={form.type} 
                  onChange={handleChange} 
                  className="grow-1"
                >
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
                  <tr>
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
                      <tr key={r.id} className="border-b">
                        <td className="">{isEditing ? (
                          <select 
                            name="type" 
                            value={editForm.type ?? r.type} 
                            onChange={handleEditChange} 
                            className="text-sm"
                          >
                            <option value="정기">정기</option>
                            <option value="비정기">비정기</option>
                            <option value="추가요청">추가요청</option>
                            <option value="사후알림">사후알림</option>
                            <option value="야근신청">야근신청</option>
                            <option value="기타">기타</option>
                          </select>
                        ) : (
                          r.type
                        )}</td>
                        
                        <td className="">{formatDate(r.requestDate)}</td>
                        <td className="">{isEditing ? (
                          <input 
                            type="date" 
                            name="absentDate" 
                            value={editForm.absentDate ?? r.absentDate} 
                            onChange={handleEditChange} 
                            className="text-sm" 
                          />
                        ) : (
                          r.absentDate
                        )}</td>
                        
                        <td className="">{isEditing ? (
                          <input 
                            type="text" 
                            name="schedule" 
                            value={editForm.schedule ?? r.schedule} 
                            onChange={handleEditChange} 
                            className="text-sm border border-gray-300 rounded px-2 py-1" 
                          />
                        ) : (
                          r.schedule || '-'
                        )}</td>
                        
                        <td className="">{isEditing ? (
                          <input 
                            type="text" 
                            name="reason" 
                            value={editForm.reason ?? r.reason} 
                            onChange={handleEditChange} 
                            className="text-sm border border-gray-300 rounded px-2 py-1 w-full" 
                          />
                        ) : (
                          r.reason || '-'
                        )}</td>
                        
                        <td className="">{r.approved || '대기'}</td>
                        
                        <td className="flex justify-center gap-[0.25rem]">
                          {isEditing ? (
                            <>
                              <button 
                                onClick={() => handleUpdate(r)} 
                                className="text-sm purple" 
                                disabled={updating}
                              >
                                {updating ? '저장 중...' : '저장'}
                              </button>
                              <button 
                                onClick={handleEditCancel} 
                                className="text-sm gray" 
                                disabled={updating}
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => handleEditStart(r)} 
                                className="text-sm purple" 
                                disabled={deletingId === r.id}
                              >
                                수정
                              </button>
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
