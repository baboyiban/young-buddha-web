import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // 클라이언트의 쿠키를 백엔드로 전달
    const cookie = req.headers.get('cookie') || '';
    const res = await fetch('http://localhost:8080/api/sheets/write', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: '서버 오류', detail: String(error) }, { status: 500 });
  }
}
