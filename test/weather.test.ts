import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  WeatherError,
  describeWeather,
  fetchWeather,
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
  mapForecast,
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

describe('forecast mapping', () => {
  it('keeps the current hour and the next 24, plus 7 daily rows', () => {
    const weather = mapForecast({
      timezone: 'Europe/Lisbon',
      current: {
        time: '2026-09-06T15:00',
        temperature_2m: 30.4,
        apparent_temperature: 32.2,
        relative_humidity_2m: 45,
        weather_code: 1,
        wind_speed_10m: 12,
        wind_direction_10m: 270,
        is_day: 1,
        surface_pressure: 1014,
      },
      hourly: {
        time: ['2026-09-06T14:00', '2026-09-06T15:00', '2026-09-06T16:00'],
        temperature_2m: [29, 30.4, 29.1],
        weather_code: [1, 1, 2],
        precipitation_probability: [0, 5, 10],
      },
      daily: {
        time: ['2026-09-06', '2026-09-07', '2026-09-08'],
        weather_code: [1, 2, 61],
        temperature_2m_max: [31, 28, 24],
        temperature_2m_min: [19, 18, 17],
        precipitation_probability_max: [5, 20, 80],
        sunrise: ['2026-09-06T07:10', '2026-09-07T07:11', '2026-09-08T07:12'],
        sunset: ['2026-09-06T19:50', '2026-09-07T19:48', '2026-09-08T19:46'],
      },
    })

    assert.equal(weather.current.temperature, 30.4)
    assert.equal(weather.current.feelsLike, 32.2)
    assert.equal(weather.current.isDay, true)
    assert.equal(weather.hourly[0]?.time, '2026-09-06T15:00')
    assert.equal(weather.hourly.length, 2)
    assert.equal(weather.daily.length, 3)
    assert.equal(weather.daily[2]?.weatherCode, 61)
  })

  it('rejects an incomplete payload', () => {
    assert.throws(
      () => mapForecast({ timezone: 'UTC' }),
      (err: unknown) => err instanceof WeatherError && err.kind === 'unavailable',
    )
  })
})

describe('fetchWeather mapping', () => {
  it('maps current, hourly, and 7 daily points from Open-Meteo', async () => {
    const original = globalThis.fetch
    const hours = Array.from({ length: 48 }, (_, i) => {
      const day = i < 24 ? '06' : '07'
      return `2026-09-${day}T${String(i % 24).padStart(2, '0')}:00`
    })
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          timezone: 'Europe/Lisbon',
          current: {
            time: '2026-09-06T15:00',
            temperature_2m: 22.4,
            apparent_temperature: 21.1,
            relative_humidity_2m: 58,
            weather_code: 2,
            wind_speed_10m: 14,
            wind_direction_10m: 270,
            is_day: 1,
            surface_pressure: 1014.2,
          },
          hourly: {
            time: hours,
            temperature_2m: hours.map((_, i) => 20 + i * 0.1),
            weather_code: hours.map(() => 2),
            precipitation_probability: hours.map(() => 10),
          },
          daily: {
            time: ['2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'],
            weather_code: [2, 3, 61, 0, 1, 80, 3],
            temperature_2m_max: [24, 23, 20, 25, 26, 22, 21],
            temperature_2m_min: [16, 15, 14, 15, 16, 15, 14],
            precipitation_probability_max: [10, 20, 80, 0, 5, 40, 15],
            sunrise: ['2026-09-06T07:12', '2026-09-07T07:13', '2026-09-08T07:14', '2026-09-09T07:15', '2026-09-10T07:16', '2026-09-11T07:17', '2026-09-12T07:18'],
            sunset: ['2026-09-06T19:48', '2026-09-07T19:46', '2026-09-08T19:44', '2026-09-09T19:42', '2026-09-10T19:40', '2026-09-11T19:38', '2026-09-12T19:36'],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    try {
      const weather = await fetchWeather({
        id: '1',
        name: 'Lisbon',
        country: 'Portugal',
        latitude: 38.72,
        longitude: -9.14,
      })
      assert.equal(weather.timezone, 'Europe/Lisbon')
      assert.equal(weather.current.temperature, 22.4)
      assert.equal(weather.current.feelsLike, 21.1)
      assert.equal(weather.current.humidity, 58)
      assert.equal(weather.current.isDay, true)
      assert.equal(weather.hourly.length, 24)
      assert.equal(weather.hourly[0]?.time, '2026-09-06T15:00')
      assert.equal(weather.daily.length, 7)
      assert.equal(weather.daily[0]?.sunrise, '2026-09-06T07:12')
    } finally {
      globalThis.fetch = original
    }
  })

  it('retries a 503 forecast response and then succeeds', async () => {
    const original = globalThis.fetch
    let calls = 0
    const hours = Array.from({ length: 24 }, (_, i) => `2026-09-06T${String(i).padStart(2, '0')}:00`)
    globalThis.fetch = async () => {
      calls += 1
      if (calls < 3) return new Response('{"error":true}', { status: 503 })
      return new Response(
        JSON.stringify({
          timezone: 'UTC',
          current: {
            time: '2026-09-06T00:00',
            temperature_2m: 11,
            apparent_temperature: 10,
            relative_humidity_2m: 40,
            weather_code: 0,
            wind_speed_10m: 5,
            wind_direction_10m: 0,
            is_day: 1,
          },
          hourly: { time: hours, temperature_2m: hours.map(() => 11), weather_code: hours.map(() => 0) },
          daily: { time: ['2026-09-06'], weather_code: [0], temperature_2m_max: [12], temperature_2m_min: [8] },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    try {
      const weather = await fetchWeather({
        id: '1',
        name: 'Lisbon',
        country: 'Portugal',
        latitude: 38.72,
        longitude: -9.14,
      })
      assert.equal(calls, 3)
      assert.equal(weather.current.temperature, 11)
    } finally {
      globalThis.fetch = original
    }
  })

  it('does not retry a non-overload forecast error', async () => {
    const original = globalThis.fetch
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return new Response('nope', { status: 500 })
    }
    try {
      await assert.rejects(
        () =>
          fetchWeather({
            id: '1',
            name: 'Lisbon',
            country: 'Portugal',
            latitude: 38.72,
            longitude: -9.14,
          }),
        (err: unknown) => err instanceof WeatherError && err.kind === 'unavailable' && !err.retryable,
      )
      assert.equal(calls, 1)
    } finally {
      globalThis.fetch = original
    }
  })
})
