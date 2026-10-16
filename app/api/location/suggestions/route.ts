import { ApiError, privateJson } from '@/lib/http/api-error'
import { suggestLocations } from '@/lib/location/georef'
import { locationRoute } from '@/lib/location/http'
import { locationSuggestionInputSchema } from '@/lib/location/contracts'

export async function GET(request: Request) {
  return locationRoute(request, async () => {
    const params = new URL(request.url).searchParams
    const allowed = new Set(['kind', 'query', 'provinceId', 'province', 'cityId', 'city', 'streetId', 'street'])
    if ([...params.keys()].some((key) => !allowed.has(key))) throw new ApiError('invalid_input')
    const input = locationSuggestionInputSchema.parse(Object.fromEntries(params))
    return privateJson({ suggestions: await suggestLocations(input) })
  })
}

