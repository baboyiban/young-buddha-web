import Link from 'next/link'

export default function Home() {
  return (
    <div className="m-[0.5rem] bg-white p-[1rem] rounded-xl min-h-[calc(100svh-44px-1rem-48px)] flex">
      <div className="flex flex-col gap-[0.5rem] items-center justify-center flex-grow">
        <h1 className="text-xl">🥳</h1>
        <h1 className="text-xl">청년붓다 홈페이지에 오신 것을</h1>
        <h1 className="text-xl">환영합니다!!!</h1>
      </div>
    </div>
  )
}