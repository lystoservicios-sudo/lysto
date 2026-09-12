import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import type { Json } from '@/lib/supabase/database.types'
import { encodeCursor, parsePageInput } from '@/lib/data-access/pagination'
import type {
  CustomerAssetProfile,
  CustomerAssetAddress,
  CustomerAssetEquipment
} from './contracts'

function customer(session: Session) {
  if (session.role !== 'customer' || !session.customerId) throw new ApiError('forbidden')
  return session.customerId
}
export async function readCustomerProfile(session: Session): Promise<CustomerAssetProfile> {
  customer(session)
  const { data, error } = await session.client
    .from('profiles')
    .select('id,first_name,last_name,email,phone,notification_preference,version')
    .eq('id', session.profileId)
    .single()
  if (error || !data) throw new ApiError('service_unavailable')
  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phone: data.phone ?? '',
    notificationPreference:
      data.notification_preference as CustomerAssetProfile['notificationPreference'],
    version: data.version
  }
}
export async function writeCustomerAsset(
  session: Session,
  kind: 'profile' | 'address' | 'equipment',
  data: Json,
  id: string | null,
  version: number | null,
  archive = false
) {
  customer(session)
  const result = await session.client.rpc('write_customer_asset', {
    p_kind: kind,
    p_data: data,
    p_id: id!,
    p_expected_version: version!,
    p_archive: archive
  })
  if (result.error) {
    if (result.error.code === '42501') throw new ApiError('forbidden')
    if (result.error.code === 'P0002') throw new ApiError('not_found')
    if (result.error.code === '40001' || result.error.code === '23505')
      throw new ApiError('conflict')
    if (['22023', '22P02', '23514'].includes(result.error.code)) throw new ApiError('invalid_input')
    throw new ApiError('service_unavailable')
  }
  if (!result.data) throw new ApiError('service_unavailable')
  return result.data
}
function pageInput(input: unknown, scope: string) {
  try {
    return parsePageInput(input, scope)
  } catch {
    throw new ApiError('invalid_input')
  }
}
export async function listCustomerAddresses(session: Session, input: unknown = {}) {
  const owner = customer(session),
    scope = `${session.profileId}:addresses:active`
  const { pageSize, cursor } = pageInput(input, scope)
  let query = session.client
    .from('customer_addresses')
    .select(
      'id,label,street,number,floor,apartment,city,province,postal_code,reference,property_type,has_elevator,has_parking,stairs_required,outdoor_unit_at_height,outdoor_unit_on_balcony,difficult_access,is_default,version,created_at,archived_at'
    )
    .eq('customer_id', owner)
    .is('archived_at', null)
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    )
  const [result, count] = await Promise.all([
    query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1),
    session.client
      .from('customer_addresses')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', owner)
      .is('archived_at', null)
  ])
  if (result.error || count.error || !result.data || count.count === null)
    throw new ApiError('service_unavailable')
  const items: CustomerAssetAddress[] = result.data
    .slice(0, pageSize)
    .map((a) => ({
      id: a.id,
      label: a.label || `${a.street} ${a.number}`,
      street: a.street,
      number: a.number,
      floor: a.floor,
      apartment: a.apartment,
      city: a.city,
      province: a.province,
      postalCode: a.postal_code,
      reference: a.reference,
      propertyType: a.property_type,
      isDefault: a.is_default,
      access: {
        hasElevator: a.has_elevator ?? undefined,
        hasParking: a.has_parking ?? undefined,
        stairsRequired: a.stairs_required ?? undefined,
        outdoorUnitAtHeight: a.outdoor_unit_at_height ?? undefined,
        outdoorUnitOnBalcony: a.outdoor_unit_on_balcony ?? undefined,
        difficultAccess: a.difficult_access ?? undefined
      },
      version: a.version,
      createdAt: a.created_at,
      archivedAt: a.archived_at
    }))
  const last = items.at(-1)
  return {
    items,
    total: count.count,
    nextCursor:
      result.data.length > pageSize && last
        ? encodeCursor({ id: last.id, createdAt: last.createdAt }, scope)
        : null
  }
}
export async function listCustomerEquipment(
  session: Session,
  input: unknown = {},
  archived = false
) {
  const owner = customer(session),
    scope = `${session.profileId}:equipment:${archived ? 'archived' : 'active'}`
  const { pageSize, cursor } = pageInput(input, scope)
  let query = session.client
    .from('customer_equipment')
    .select(
      'id,nickname,address_id,equipment_type,brand,model,serial_number,frigorias,version,created_at,archived_at'
    )
    .eq('customer_id', owner)
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    )
  const countQuery = session.client
    .from('customer_equipment')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', owner)
  const [result, count] = await Promise.all([
    query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1),
    archived ? countQuery.not('archived_at', 'is', null) : countQuery.is('archived_at', null)
  ])
  if (result.error || count.error || !result.data || count.count === null)
    throw new ApiError('service_unavailable')
  const items: CustomerAssetEquipment[] = result.data
    .slice(0, pageSize)
    .map((e) => ({
      id: e.id,
      nickname: e.nickname,
      addressId: e.address_id,
      equipmentType: e.equipment_type,
      brand: e.brand,
      model: e.model,
      serialNumber: e.serial_number,
      frigorias: e.frigorias,
      version: e.version,
      createdAt: e.created_at,
      archivedAt: e.archived_at
    }))
  const last = items.at(-1)
  return {
    items,
    total: count.count,
    nextCursor:
      result.data.length > pageSize && last
        ? encodeCursor({ id: last.id, createdAt: last.createdAt }, scope)
        : null
  }
}
export function assetPageQuery(request: Request) {
  const params = new URL(request.url).searchParams
  if ([...params.keys()].some((key) => !['pageSize', 'cursor'].includes(key)))
    throw new ApiError('invalid_input')
  return {
    ...(params.has('pageSize') ? { pageSize: Number(params.get('pageSize')) } : {}),
    ...(params.has('cursor') ? { cursor: params.get('cursor')! } : {})
  }
}

export async function listEquipmentPhotos(
  session: Session,
  equipmentId: string,
  input: unknown = {}
) {
  const owner = customer(session),
    scope = `${session.profileId}:equipment:${equipmentId}:photos`
  const { data: equipment, error: equipmentError } = await session.client
    .from('customer_equipment')
    .select('id')
    .eq('id', equipmentId)
    .eq('customer_id', owner)
    .maybeSingle()
  if (equipmentError) throw new ApiError('service_unavailable')
  if (!equipment) throw new ApiError('not_found')
  const { pageSize, cursor } = pageInput(input, scope)
  let query = session.client
    .from('equipment_media')
    .select('id,created_at')
    .eq('equipment_id', equipmentId)
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    )
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1)
  if (error || !data) throw new ApiError('service_unavailable')
  const items = data.slice(0, pageSize).map((item) => ({ id: item.id, createdAt: item.created_at }))
  const last = items.at(-1)
  return { items, nextCursor: data.length > pageSize && last ? encodeCursor(last, scope) : null }
}

export async function customerEquipmentHistory(session: Session, id: string, input: unknown = {}) {
  const owner = customer(session)
  if (!z.string().uuid().safeParse(id).success) throw new ApiError('not_found')
  const { data: equipment, error } = await session.client
    .from('customer_equipment')
    .select('id,nickname,brand,model,serial_number,equipment_type,frigorias,archived_at')
    .eq('id', id)
    .eq('customer_id', owner)
    .maybeSingle()
  if (error) throw new ApiError('service_unavailable')
  if (!equipment) throw new ApiError('not_found')
  const scope = `${session.profileId}:equipment:${id}:history`,
    { pageSize, cursor } = pageInput(input, scope)
  // Deliberately excludes technician notes and internal identifiers.
  let query = session.client
    .from('equipment_service_records')
    .select(
      'id,created_at,job_id,reported_problem,real_diagnosis,work_done,parts_used,next_maintenance_date'
    )
    .eq('equipment_id', id)
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    )
  const { data: records, error: recordsError } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1)
  if (recordsError || !records) throw new ApiError('service_unavailable')
  const items = records.slice(0, pageSize),
    last = items.at(-1)
  return {
    equipment,
    items,
    nextCursor:
      records.length > pageSize && last
        ? encodeCursor({ id: last.id, createdAt: last.created_at }, scope)
        : null
  }
}
