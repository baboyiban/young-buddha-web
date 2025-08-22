'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MissionData } from '@/types/mission'
import { fetchMissionData } from '@/lib/api/mission'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function Mission() {
  const [missionData, setMissionData] = useState<MissionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadMissionData()
  }, [])

  const loadMissionData = async () => {
    try {
      setLoading(true)
      const data = await fetchMissionData()
      setMissionData(data)
    } catch (err: any) {
      console.error('Error loading mission data:', err)
      
      // 401 Unauthorized 에러인 경우 로그인 페이지로 리다이렉트
      if (err?.status === 401 || err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        alert('로그인이 필요합니다. 로그인 페이지로 이동합니다.')
        router.push('/login')
        return
      }
      
      setError('미션 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray flex items-center justify-center min-h-[calc(100svh-52px-0.5rem)]">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray flex items-center justify-center min-h-[calc(100svh-52px-0.5rem)]">
        <div className="text-dark-red">{error}</div>
      </div>
    )
  }

  if (!missionData) {
    return (
      <div className="bg-gray flex items-center justify-center min-h-[calc(100svh-52px-0.5rem)]">
        <div className="text-dark-gray">미션 데이터가 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="mx-[0.5rem] bg-white p-[1rem] rounded-xl min-h-[calc(100svh-52px-0.5rem)] flex flex-col">
      {/* 미션 컨텐츠 */}
      <div className="flex flex-col items-center justify-center-safe *:not-last:mb-[1rem] *:text-center *:*:not-last:mb-[0.25rem] flex-1 p-[1rem]">
        <MissionHeader date={missionData.date} dayOfWeek={missionData.dayOfWeek} />

        {missionData.morningMeal.length > 0 && (
          <MissionItem title="🍚 발우공양 당번" members={missionData.morningMeal} />
        )}

        {missionData.morningHelper.length > 0 && (
          <MissionItem title="🤲 발우공양 바라지" members={missionData.morningHelper} />
        )}

        {missionData.morningDishes.length > 0 && (
          <MissionItem title="🧼 아침 설거지" members={missionData.morningDishes} />
        )}

        {(missionData.laundry.wash || missionData.laundry.hang || missionData.laundry.fold) && (
          <LaundryMission laundry={missionData.laundry} />
        )}

        {(missionData.afternoonCushion.length > 0) && (
          <AfternoonCushionMission members={missionData.afternoonCushion} />
        )}

        {missionData.eveningMeal.length > 0 && (
          <MissionItem title="🍛 저녁공양 당번" members={missionData.eveningMeal} />
        )}

        {missionData.eveningCushion && (
          <MissionItem title="🌚 저녁예불 방석 한줄깔기" members={[missionData.eveningCushion]} />
        )}
      </div>
    </div>
  )
}

function MissionHeader({ date, dayOfWeek }: { date: string; dayOfWeek: string }) {
  return (
    <div>
      🌴 {date} {dayOfWeek}요일 청년붓다 소임 🌴
    </div>
  )
}

function MissionItem({ title, members }: { title: string; members: string[] }) {
  return (
    <div>
      <div>{title}</div>
      <div>{members.join(', ')}</div>
    </div>
  )
}

function LaundryMission({ laundry }: { laundry: { wash?: string; hang?: string; fold?: string } }) {
  const tasks = []
  if (laundry.wash) tasks.push(`(애벌/세탁) ${laundry.wash}`)
  if (laundry.hang) tasks.push(`(널기) ${laundry.hang}`)
  if (laundry.fold) tasks.push(`(걷고/개기) ${laundry.fold}`)

  return (
    <div>
      <div>🧺 걸레빨기</div>
      <div>{tasks.join(', ')}</div>
    </div>
  )
}

function AfternoonCushionMission({ members }: { members: string[] }) {
  const displayMembers = members.length > 0 && members[0] ? members : ['상근자 전원']

  return (
    <div>
      <div>🌞 사시예불전 방석깔기</div>
      <div>{displayMembers.join(', ')}</div>
    </div>
  )
}