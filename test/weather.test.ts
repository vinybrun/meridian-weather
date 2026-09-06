import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  WeatherError,
  describeWeather,
  formatClock,
  formatCompass,
  formatLat,
  formatLon,
  formatPlace,
  formatShortDate,
  formatTemp,
  formatWeekday,
  formatWind,
  iconKind,
  lookupPlace,
  toTemp,
  weatherTheme,
} from '../src/weather.ts'

describe('temperature helpers', () => {
  it('keeps celsius and converts fahrenheit', () => {
    assert.equal(toTemp(0, 'c'), 0)
    assert.equal(toTemp(100, 'c'), 100)
    assert.equal(toTemp(0, 'f'), 32)
    assert.equal(toTemp(100, 'f'), 212)
  })

  it('rounds display temperatures', () => {
    assert.equal(formatTemp(21.4, 'c'), '21°')
    assert.equal(formatTemp(21.6, 'c'), '22°')
    assert.equal(formatTemp(0, 'f'), '32°')
  })
})

describe('wind and compass', () => {
  it('converts wind for imperial units', () => {
    assert.equal(formatWind(10, 'c'), '10 km/h')
    assert.equal(formatWind(16.09, 'f'), '10 mph')
  })

  it('maps degrees onto 16 compass points', () => {
    assert.equal(formatCompass(0), 'N')
    assert.equal(formatCompass(90), 'E')
    assert.equal(formatCompass(180), 'S')
    assert.equal(formatCompass(270), 'W')
    assert.equal(formatCompass(348.75), 'N')
    assert.equal(formatCompass(-45), 'NW')
  })
})

describe('weather codes', () => {
  it('describes known WMO codes and falls back', () => {
    assert.equal(describeWeather(0), 'Clear sky')
    assert.equal(describeWeather(95), 'Thunderstorm')
    assert.equal(describeWeather(1234), 'Mixed conditions')
  })

  it('picks a sky theme from the code and day flag', () => {
    assert.equal(weatherTheme(0, true), 'clear-day')
    assert.equal(weatherTheme(1, false), 'clear-night')
    assert.equal(weatherTheme(3, true), 'cloud')
    assert.equal(weatherTheme(61, true), 'rain')
    assert.equal(weatherTheme(75, true), 'snow')
    assert.equal(weatherTheme(95, true), 'storm')
    assert.equal(weatherTheme(45, true), 'fog')
  })

  it('picks an icon mark', () => {
    assert.equal(iconKind(0, true), 'sun')
    assert.equal(iconKind(0, false), 'moon')
    assert.equal(iconKind(2, true), 'partly')
    assert.equal(iconKind(53, true), 'drizzle')
    assert.equal(iconKind(63, true), 'rain')
  })
})

describe('place and time labels', () => {
  it('formats coordinates and place lines', () => {
    assert.equal(formatLat(38.72), '38.72°N')
    assert.equal(formatLat(-33.92), '33.92°S')
    assert.equal(formatLon(-9.14), '9.14°W')
    assert.equal(formatPlace({ id: '1', name: 'Lisbon', country: 'Portugal', admin1: 'Lisbon', latitude: 0, longitude: 0 }), 'Lisbon, Portugal')
    assert.equal(formatPlace({ id: '1', name: 'Lisbon', country: 'Portugal', latitude: 0, longitude: 0 }), 'Portugal')
  })

  it('formats local ISO clocks without shifting timezones', () => {
    assert.equal(formatClock('2026-09-06T00:00'), '12 AM')
    assert.equal(formatClock('2026-09-06T15:15'), '3:15 PM')
    assert.equal(formatClock('2026-09-06T12:00'), '12 PM')
  })

  it('labels today, tomorrow, and weekdays from the place date', () => {
    assert.equal(formatWeekday('2026-09-06', '2026-09-06T15:15'), 'Today')
    assert.equal(formatWeekday('2026-09-07', '2026-09-06T15:15'), 'Tomorrow')
    assert.equal(formatWeekday('2026-09-08', '2026-09-06T15:15'), 'Tue')
    assert.equal(formatShortDate('2026-09-08'), 'Sep 8')
  })
})

describe('city lookup', () => {
  it('throws a not-found error when geocoding is empty', async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    try {
      await assert.rejects(
        () => lookupPlace('zzzznotacity'),
        (err: unknown) => err instanceof WeatherError && err.kind === 'not-found',
      )
    } finally {
      globalThis.fetch = original
    }
  })

  it('returns the first matching place', async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          results: [{ id: 1, name: 'Lisbon', latitude: 38.72, longitude: -9.14, country: 'Portugal', admin1: 'Lisbon' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    try {
      const place = await lookupPlace('Lisbon')
      assert.equal(place.name, 'Lisbon')
      assert.equal(place.country, 'Portugal')
      assert.equal(place.admin1, 'Lisbon')
    } finally {
      globalThis.fetch = original
    }
  })
})
