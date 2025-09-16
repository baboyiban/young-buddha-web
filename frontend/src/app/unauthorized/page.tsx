import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="bg-white min-h-[calc(100svh-52px-0.5rem)] mx-[0.5rem] p-[1rem] rounded-[1rem] flex">
      <div className="flex-grow flex flex-col items-center justify-center space-y-[1rem]">
        <div className="flex flex-col items-center justify-center  space-y-[0.5rem] text-dark-gray">
          <p className="">이 페이지에 접근할 수 있는 권한이 없습니다.</p>
          <p className="">필요한 권한이 있는 경우 관리자에게 문의해주세요.</p>
        </div>
        <Link href="/" className="button purple mt-[1rem]">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
