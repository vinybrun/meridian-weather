export type Unit = 'c' | 'f'
export type Status = 'idle' | 'loading' | 'ready' | 'error' | 'not-found' | 'geo'
export type Theme = 'idle' | 'clear-day' | 'clear-night' | 'cloud' | 'rain' | 'storm' | 'snow' | 'fog'
export type Mark = 'sun' | 'moon' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

export type Place = {
  id: string
  name: string
  country: string
  admin1?: string
  latitude: number
  longitude: number
}

export type HourPoint = {
  time: string
  temperature: number
  weatherCode: number
  precipProb: number | null
}

export type DayPoint = {
  date: string
  weatherCode: number
  tMax: number
  tMin: number
  precipProb: number | null
  sunrise: string | null
  sunset: string | null
}

export type Weather = {
  timezone: string
  current: {
    time: string
    temperature: number
    feelsLike: number
    humidity: number
    windSpeed: number
    windDirection: number
    weatherCode: number
    isDay: boolean
    pressure: number | null
  }
  hourly: HourPoint[]
  daily: DayPoint[]
}

export class WeatherError extends Error {
  readonly kind: 'network' | 'not-found' | 'unavailable' | 'geo'

  constructor(kind: 'network' | 'not-found' | 'unavailable' | 'geo', message: string) {
    super(message)
    this.name = 'WeatherError'
    this.kind = kind
  }
}

const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const REVERSE = 'https://api.bigdatacloud.net/data/reverse-geocode-client'

const DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Light freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Light snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm',
}

export const FEATURED: Place[] = [
  { id: 'lisbon', name: 'Lisbon', country: 'Portugal', latitude: 38.7223, longitude: -9.1393 },
  { id: 'kyoto', name: 'Kyoto', country: 'Japan', latitude: 35.0116, longitude: 135.7681 },
  { id: 'reykjavik', name: 'Reykjavík', country: 'Iceland', latitude: 64.1466, longitude: -21.9426 },
  { id: 'capetown', name: 'Cape Town', country: 'South Africa', latitude: -33.9249, longitude: 18.4241 },
  { id: 'vancouver', name: 'Vancouver', country: 'Canada', latitude: 49.2827, longitude: -123.1207 },
  { id: 'marrakesh', name: 'Marrakesh', country: 'Morocco', latitude: 31.6295, longitude: -7.9811 },
]

export function describeWeather(code: number): string {
  return DESCRIPTIONS[code] ?? 'Mixed conditions'
}

export function weatherTheme(code: number, isDay: boolean): Theme {
  if (code === 0 || code === 1) return isDay ? 'clear-day' : 'clear-night'
  if (code === 2 || code === 3) return 'cloud'
  if (code === 45 || code === 48) return 'fog'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  if (code >= 51) return 'rain'
  return 'cloud'
}

export function iconKind(code: number, isDay: boolean): Mark {
  if (code === 0 || code === 1) return isDay ? 'sun' : 'moon'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloud'
  if (code === 45 || code === 48) return 'fog'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code >= 61) return 'rain'
  return 'cloud'
}

export function toTemp(celsius: number, unit: Unit): number {
  return unit === 'f' ? (celsius * 9) / 5 + 32 : celsius
}

export function formatTemp(celsius: number, unit: Unit): string {
  return `${Math.round(toTemp(celsius, unit))}°`
}

export function formatWind(kmh: number, unit: Unit): string {
  return unit === 'f' ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`
}

export function formatCompass(deg: number): string {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return points[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16] ?? 'N'
}

export function formatPlace(place: Place): string {
  return [place.admin1, place.country].filter(Boolean).join(', ')
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`
}

export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
}

export function formatClock(isoLocal: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(isoLocal)
  if (!match) return isoLocal
  const hour = Number(match[1])
  const minute = match[2]
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return minute === '00' ? `${hour12} ${suffix}` : `${hour12}:${minute} ${suffix}`
}

export function formatWeekday(dateStr: string, todayIso: string): string {
  const today = todayIso.slice(0, 10)
  if (dateStr === today) return 'Today'
  const next = new Date(`${today}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  if (dateStr === next.toISOString().slice(0, 10)) return 'Tomorrow'
  const parsed = new Date(`${dateStr}T12:00:00Z`)
  return parsed.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

export function formatShortDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return dateStr
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function geoPlace(latitude: number, longitude: number): Place {
  return {
    id: `geo:${latitude.toFixed(3)},${longitude.toFixed(3)}`,
    name: 'Your location',
    country: `${formatLat(latitude)}, ${formatLon(longitude)}`,
    latitude,
    longitude,
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadUnit(): Unit {
  return readRaw('meridian:unit') === 'f' ? 'f' : 'c'
}

export function saveUnit(unit: Unit): void {
  writeRaw('meridian:unit', unit)
}

export function loadPlace(): Place | null {
  const raw = readRaw('meridian:place')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Place>
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.country !== 'string' ||
      typeof parsed.latitude !== 'number' ||
      typeof parsed.longitude !== 'number'
    ) {
      return null
    }
    return {
      id: parsed.id,
      name: parsed.name,
      country: parsed.country,
      admin1: typeof parsed.admin1 === 'string' ? parsed.admin1 : undefined,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
    }
  } catch {
    return null
  }
}

export function savePlace(place: Place): void {
  writeRaw('meridian:place', JSON.stringify(place))
}

type GeoHit = {
  id: number
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), 12_000)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) {
      throw new WeatherError('unavailable', 'The weather service is temporarily unavailable.')
    }
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof WeatherError) throw error
    if (isAbortError(error)) {
      if (signal?.aborted) throw error
      throw new WeatherError('network', 'The weather service took too long to respond.')
    }
    throw new WeatherError('network', 'Could not reach the weather service. Check your connection.')
  } finally {
    globalThis.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const name = query.trim()
  if (name.length < 2) return []
  const url = new URL(GEOCODE)
  url.searchParams.set('name', name)
  url.searchParams.set('count', '6')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')
  const data = await getJson<{ results?: GeoHit[] }>(url.toString(), signal)
  return (data.results ?? []).map((hit) => ({
    id: String(hit.id),
    name: hit.name,
    country: hit.country ?? '',
    admin1: hit.admin1,
    latitude: hit.latitude,
    longitude: hit.longitude,
  }))
}

export async function lookupPlace(query: string, signal?: AbortSignal): Promise<Place> {
  const results = await searchPlaces(query, signal)
  const match = results[0]
  if (!match) {
    throw new WeatherError('not-found', `No place called “${query.trim()}”. Try another spelling or add a country.`)
  }
  return match
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<Place> {
  const fallback = geoPlace(latitude, longitude)
  try {
    const url = new URL(REVERSE)
    url.searchParams.set('latitude', String(latitude))
    url.searchParams.set('longitude', String(longitude))
    url.searchParams.set('localityLanguage', 'en')
    const data = await getJson<{
      city?: string
      locality?: string
      principalSubdivision?: string
      countryName?: string
    }>(url.toString(), signal)
    const name = data.city?.trim() || data.locality?.trim()
    if (!name) return fallback
    return {
      id: fallback.id,
      name,
      country: data.countryName?.trim() || fallback.country,
      admin1: data.principalSubdivision?.trim() || undefined,
      latitude,
      longitude,
    }
  } catch (error) {
    if (isAbortError(error)) throw error
    return fallback
  }
}

type ForecastPayload = {
  timezone?: string
  current?: {
    time: string
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    weather_code: number
    wind_speed_10m: number
    wind_direction_10m: number
    is_day: number
    surface_pressure?: number
  }
  hourly?: {
    time?: string[]
    temperature_2m?: number[]
    weather_code?: number[]
    precipitation_probability?: Array<number | null>
  }
  daily?: {
    time?: string[]
    weather_code?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    precipitation_probability_max?: Array<number | null>
    sunrise?: string[]
    sunset?: string[]
  }
}

export function mapForecast(data: ForecastPayload): Weather {
  const current = data.current
  const hourlyTime = data.hourly?.time
  const dailyTime = data.daily?.time
  if (!current || !hourlyTime || !dailyTime) {
    throw new WeatherError('unavailable', 'The weather service returned an incomplete forecast.')
  }

  const cursor = current.time.slice(0, 13)
  let start = hourlyTime.findIndex((time) => time.slice(0, 13) >= cursor)
  if (start < 0) start = 0

  return {
    timezone: data.timezone || 'UTC',
    current: {
      time: current.time,
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
      pressure: current.surface_pressure ?? null,
    },
    hourly: hourlyTime.slice(start, start + 24).map((time, offset) => {
      const i = start + offset
      return {
        time,
        temperature: data.hourly?.temperature_2m?.[i] ?? 0,
        weatherCode: data.hourly?.weather_code?.[i] ?? 0,
        precipProb: data.hourly?.precipitation_probability?.[i] ?? null,
      }
    }),
    daily: dailyTime.slice(0, 7).map((date, i) => ({
      date,
      weatherCode: data.daily?.weather_code?.[i] ?? 0,
      tMax: data.daily?.temperature_2m_max?.[i] ?? 0,
      tMin: data.daily?.temperature_2m_min?.[i] ?? 0,
      precipProb: data.daily?.precipitation_probability_max?.[i] ?? null,
      sunrise: data.daily?.sunrise?.[i] ?? null,
      sunset: data.daily?.sunset?.[i] ?? null,
    })),
  }
}

export async function fetchWeather(place: Place, signal?: AbortSignal): Promise<Weather> {
  const url = new URL(FORECAST)
  url.searchParams.set('latitude', String(place.latitude))
  url.searchParams.set('longitude', String(place.longitude))
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure',
  )
  url.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability')
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
  )
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '7')
  url.searchParams.set('wind_speed_unit', 'kmh')

  return mapForecast(await getJson<ForecastPayload>(url.toString(), signal))
}

export function readPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new WeatherError('geo', 'This browser cannot share a location. Search for a city instead.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new WeatherError('geo', 'Location permission was denied. Search for a city instead.'))
          return
        }
        if (error.code === error.TIMEOUT) {
          reject(new WeatherError('geo', 'Location lookup timed out. Try again, or search by city.'))
          return
        }
        reject(new WeatherError('geo', 'Could not determine your location. Search for a city instead.'))
      },
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 300000,
      },
    )
  })
}
