// PostgreSQL function arguments do not expose nullability metadata to the
// generated Supabase types. Keep the generated schema exact while preserving
// intentional SQL nulls at the small number of nullable RPC boundaries.
export function nullableRpcArgument<T>(value: T | null): T {
  return value as T
}
