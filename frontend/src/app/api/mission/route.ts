import { NextRequest, NextResponse } from "next/server";

// Proxy to backend API to fetch mission row from Google Sheets via GViz
export async function GET(req: NextRequest) {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080");
  const query = req.nextUrl.search || ""; // pass-through any spreadsheet_id, range, gid
  const url = `${baseUrl}/api/mission${query}`;

  try {
    const resp = await fetch(url, { method: "GET" });
    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: "Backend fetch failed", status: resp.status, body: text },
        { status: 502 }
      );
    }
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching mission data from backend:", error);
    return NextResponse.json(
      { error: "Failed to fetch mission data" },
      { status: 500 }
    );
  }
}
