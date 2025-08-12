import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="*:p-[1rem] pb-[48px]">
      <div className="flex gap-[0.5rem] justify-center">
        <Link href="/privacy" className="text-gray-600 hover:text-gray-800 text-sm">
          개인정보처리방침
        </Link>
        <Link href="/terms" className="text-gray-600 hover:text-gray-800 text-sm">
          이용약관
        </Link>
      </div>
    </footer>
  )
}