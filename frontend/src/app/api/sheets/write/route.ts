// Deprecated: backend /api/sheets/write endpoint removed.
// Keep this file to avoid 404s during rollout; always error out.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    error: true,
    code: 'DEPRECATED',
    message: 'Use /api/sheets/create|update|delete with spreadsheet_id, sheet_name, query.'
  }, { status: 410 })
}
