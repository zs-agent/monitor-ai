import { NextResponse } from 'next/server'
import { getPublicCoverage } from '@/lib/public-coverage'
export const dynamic = 'force-dynamic'
export async function GET() {
  return NextResponse.json(await getPublicCoverage(), { headers: { 'Cache-Control': 'no-store' } })
}
