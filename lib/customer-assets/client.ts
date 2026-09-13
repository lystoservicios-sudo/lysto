'use client'

export {
  privateRequest as assetRequest,
  requestError as assetError
} from '@/lib/http/private-client'
export type AssetPage<T> = { items: T[]; total: number; nextCursor: string | null }
