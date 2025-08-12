export default function PrivacyPage() {
  return (
    <div className="m-[0.5rem] bg-white p-[1rem] rounded-xl min-h-[calc(100svh-44px-1rem-48px)]">
      <div className="flex flex-col gap-[0.5rem]">
        <p>
          청년붓다 웹사이트는 Google 계정을 통한 로그인만 지원하며, 별도의
          개인정보를 수집하거나 저장하지 않습니다.
        </p>
        <p>
          Google 계정 정보는 로그인 확인 용도로만 사용되며, 어떤 정보도 외부에
          제공되지 않습니다.
        </p>
        <p className="font-semibold">문의: chl11wq12@gmail.com</p>
      </div>
    </div>
  )
}