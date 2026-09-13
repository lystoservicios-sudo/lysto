import { NextResponse } from 'next/server'

export function retiredPost(replacement: string) {
  return async function POST(request: Request) {
    void request
    return NextResponse.json(
      { error: 'endpoint_retired', replacement },
      { status: 410, headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    )
  }
}
