"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { MissionData } from "@/lib/types/mission";
import { fetchMissionData } from "@/lib/api/mission";
import PageLayout from "@/components/layouts/PageLayout";
import { MissionItem } from "@/components/MissionItem";

export default function Mission() {
  const router = useRouter();

  const {
    data: missionData,
    error,
    isLoading,
  } = useSWR<MissionData>("mission-data", fetchMissionData, {
    onError: (err: any) => {
      // 401 Unauthorized 에러인 경우 로그인 페이지로 리다이렉트
      if (
        err?.status === 401 ||
        err?.message?.includes("401") ||
        err?.message?.includes("Unauthorized")
      ) {
        alert("로그인이 필요합니다. 로그인 페이지로 이동합니다.");
        router.push("/login");
      }
    },
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  return (
    <PageLayout
      title="생활 소임"
      requireAuth={true}
      loading={isLoading}
      error={error ? "미션 데이터를 불러오는데 실패했습니다." : null}
    >
      <div className="mx-[0.5rem] bg-white p-[1rem] rounded-[1rem] min-h-[calc(100svh-52px-28px-8px)] flex flex-col">
        {!missionData || missionData.date === "" ? (
          <div className="text-dark-gray text-center">
            오늘의 미션 데이터가 아직 준비되지 않았습니다.
            <br />
            관리자에게 문의해주세요.
          </div>
        ) : (
          <>
            {/* 미션 컨텐츠 */}
            <div className="flex flex-col items-center justify-center-safe *:not-last:mb-[1rem] *:text-center *:*:not-last:mb-[0.25rem] flex-1 p-[1rem]">
              <MissionHeader
                date={missionData.date}
                dayOfWeek={missionData.dayOfWeek}
              />

              {missionData.morningMeal.length > 0 && (
                <MissionItem
                  title="🍚 발우공양 당번"
                  members={missionData.morningMeal}
                />
              )}

              {missionData.morningDishes.length > 0 && (
                <MissionItem
                  title="🧼 아침 설거지"
                  members={missionData.morningDishes}
                />
              )}

              {missionData.eveningMeal.length > 0 && (
                <MissionItem
                  title="🍛 저녁공양 당번"
                  members={missionData.eveningMeal}
                />
              )}

              {missionData.eveningMeeting && (
                <MissionItem
                  title="🌙 닫는 모임 진행"
                  members={[missionData.eveningMeeting]}
                />
              )}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}

function MissionHeader({
  date,
  dayOfWeek,
}: {
  date: string;
  dayOfWeek: string;
}) {
  return (
    <div>
      🌴 {date} {dayOfWeek}요일 청년붓다 소임 🌴
    </div>
  );
}

// MissionItem 컴포넌트는 이제 별도 파일로 분리됨
