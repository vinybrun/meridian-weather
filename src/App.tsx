import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import {
  FEATURED,
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
  isAbortError,
  loadPlace,
  loadUnit,
  lookupPlace,
  readPosition,
  reverseGeocode,
  savePlace,
  saveUnit,
  searchPlaces,
  toTemp,
  weatherTheme,
  type Mark,
  type Place,
  type Status,
  type Theme,
  type Unit,
  type Weather,
} from './weather'

export default function App() {
  const [unit, setUnitState] = useState<Unit>(() => loadUnit())
  const [status, setStatus] = useState<Status>('idle')
  const [place, setPlace] = useState<Place | null>(null)
  const [weather, setWeather] = useState<Weather | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const retryRef = useRef<(() => void) | null>(null)
  const started = useRef(false)

  const theme = weather ? weatherTheme(weather.current.weatherCode, weather.current.isDay) : 'idle'
  const notice = noticeCopy(status, error)

  const setUnit = useCallback((next: Unit) => {
    setUnitState(next)
    saveUnit(next)
  }, [])

  const run = useCallback(async (task: (signal: AbortSignal) => Promise<{ place: Place; weather: Weather }>) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('loading')
    setError('')
    try {
      const result = await task(controller.signal)
      if (controller.signal.aborted) return
      setPlace(result.place)
      setWeather(result.weather)
      savePlace(result.place)
      syncQueryParam(result.place.name)
      setStatus('ready')
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return
      if (err instanceof WeatherError) {
        setError(err.message)
        setStatus(err.kind === 'not-found' ? 'not-found' : err.kind === 'geo' ? 'geo' : 'error')
        return
      }
      setError('Something went wrong while loading the weather.')
      setStatus('error')
    }
  }, [])

  const loadForPlace = useCallback(
    (next: Place) => {
      retryRef.current = () => loadForPlace(next)
      void run(async (signal) => ({
        place: next,
        weather: await fetchWeather(next, signal),
      }))
    },
    [run],
  )

  const loadQuery = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        setError('Type a city name, then search.')
        setStatus((current) => (current === 'ready' ? 'error' : 'not-found'))
        return
      }
      retryRef.current = () => loadQuery(trimmed)
      void run(async (signal) => {
        const next = await lookupPlace(trimmed, signal)
        return { place: next, weather: await fetchWeather(next, signal) }
      })
    },
    [run],
  )

  const loadHere = useCallback(() => {
    retryRef.current = () => loadHere()
    void run(async (signal) => {
      const position = await readPosition()
      const next = await reverseGeocode(position.coords.latitude, position.coords.longitude, signal)
      return { place: next, weather: await fetchWeather(next, signal) }
    })
  }, [run])

  useEffect(() => {
    if (started.current) return
    started.current = true
    const shared = readQueryParam()
    if (shared) {
      setQuery(shared)
      loadQuery(shared)
      return
    }
    const saved = loadPlace()
    if (saved) void loadForPlace(saved)
  }, [loadForPlace, loadQuery])

  useEffect(() => {
    document.title = place && status === 'ready' ? `${place.name} — Meridian Weather` : 'Meridian — Weather'
  }, [place, status])

  useEffect(() => () => abortRef.current?.abort(), [])

  const showLanding = status === 'idle' && !weather
  const showSkeleton = status === 'loading' && !weather
  const showErrorOnly = (status === 'error' || status === 'not-found' || status === 'geo') && !weather

  return (
    <div className="shell" data-theme={theme} data-loading={status === 'loading' ? 'true' : 'false'}>
      <Atmosphere theme={theme} />

      {status === 'loading' ? <div className="progress" role="progressbar" aria-label="Loading weather" /> : null}
      <div className="sr-only" aria-live="polite">
        {status === 'loading' ? 'Loading weather' : error}
      </div>

      <a className="skip" href="#main">
        Skip to weather
      </a>

      <header className="top">
        <a className="brand" href="./" aria-label="Meridian home">
          <span className="brand-mark" aria-hidden="true" />
          <span>Meridian</span>
        </a>
        <Search
          query={query}
          onQuery={setQuery}
          loading={status === 'loading'}
          showHints={showLanding || showErrorOnly}
          onSelect={loadForPlace}
          onSearch={loadQuery}
          onLocate={loadHere}
        />
        <div className="units" role="group" aria-label="Temperature unit">
          <button type="button" aria-pressed={unit === 'c'} onClick={() => setUnit('c')}>
            °C
          </button>
          <button type="button" aria-pressed={unit === 'f'} onClick={() => setUnit('f')}>
            °F
          </button>
        </div>
      </header>

      <main id="main" className="stage">
        {showLanding ? (
          <section className="status-panel landing">
            <p className="eyebrow">Observatory</p>
            <h1>A quieter way to read the sky.</h1>
            <p className="lede">
              Search any city for current conditions and a seven-day forecast. Or share your location — the reading
              stays on this device.
            </p>
          </section>
        ) : null}

        {showSkeleton ? <Skeleton /> : null}

        {showErrorOnly ? (
          <section className="status-panel notice" role="alert">
            <p className="eyebrow">{notice.eyebrow}</p>
            <h1>{notice.title}</h1>
            <p className="lede">{notice.body}</p>
            {status !== 'not-found' ? (
              <button className="retry" type="button" onClick={() => retryRef.current?.()}>
                Try again
              </button>
            ) : null}
          </section>
        ) : null}

        {weather && place ? (
          <>
            {error && status !== 'ready' ? (
              <p className="banner" role="alert">
                {error}
                {status !== 'not-found' ? (
                  <>
                    {' '}
                    <button className="retry-inline" type="button" onClick={() => retryRef.current?.()}>
                      Try again
                    </button>
                  </>
                ) : null}
              </p>
            ) : null}
            <Current place={place} weather={weather} unit={unit} />
            <Hourly hours={weather.hourly} unit={unit} isDayNow={weather.current.isDay} />
            <Forecast days={weather.daily} unit={unit} todayIso={weather.current.time} />
          </>
        ) : null}
      </main>

      <footer className="colophon">
        <p>
          Forecasts from{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          . No API key. Last place and unit stay in this browser.
        </p>
      </footer>
    </div>
  )
}

function Search({
  query,
  onQuery,
  loading,
  showHints,
  onSelect,
  onSearch,
  onLocate,
}: {
  query: string
  onQuery: (value: string) => void
  loading: boolean
  showHints: boolean
  onSelect: (place: Place) => void
  onSearch: (query: string) => void
  onLocate: () => void
}) {
  const listId = useId()
  const inputId = useId()
  const rootRef = useRef<HTMLFormElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [suggesting, setSuggesting] = useState(false)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      abortRef.current?.abort()
      setSuggestions([])
      setSuggesting(false)
      return
    }
    setSuggestions([])
    setSuggesting(true)
    const handle = window.setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      void searchPlaces(trimmed, controller.signal)
        .then((places) => {
          if (controller.signal.aborted) return
          setSuggestions(places)
          setActive(0)
          setOpen(true)
        })
        .catch((err: unknown) => {
          if (isAbortError(err)) return
          setSuggestions([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggesting(false)
        })
    }, 260)
    return () => {
      window.clearTimeout(handle)
      abortRef.current?.abort()
    }
  }, [query])

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  function choose(next: Place) {
    onQuery(next.name)
    setOpen(false)
    onSelect(next)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || suggestions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter' && suggestions[active]) {
      event.preventDefault()
      choose(suggestions[active])
    }
  }

  const showList = open && query.trim().length >= 2

  return (
    <div className="search-block">
      <form
        ref={rootRef}
        className="search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          setOpen(false)
          onSearch(query)
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          Search weather by city
        </label>
        <span className="search-glyph" aria-hidden="true">
          ⌕
        </span>
        <input
          id={inputId}
          value={query}
          onChange={(event) => {
            onQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true)
          }}
          onKeyDown={onKeyDown}
          placeholder="Search a city"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          role="combobox"
          aria-expanded={showList && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-busy={suggesting}
          aria-activedescendant={showList && suggestions[active] ? `${listId}-${suggestions[active].id}` : undefined}
        />
        <div className="search-actions">
          <button className="go" type="submit" disabled={loading || query.trim().length === 0}>
            Search
          </button>
          <button
            className="locate"
            type="button"
            onClick={onLocate}
            disabled={loading}
            aria-label="Use my location"
          >
            <LocateIcon />
            <span>Use my location</span>
          </button>
        </div>
        {showList ? (
          <ul className="suggest" id={listId} role="listbox">
            {suggesting && suggestions.length === 0 ? <li className="suggest-empty">Looking up places…</li> : null}
            {!suggesting && suggestions.length === 0 ? <li className="suggest-empty">No matching places</li> : null}
            {suggestions.map((item, index) => (
              <li key={item.id} role="presentation">
                <button
                  id={`${listId}-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? 'is-active' : undefined}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item)}
                >
                  <strong>{item.name}</strong>
                  <span>{formatPlace(item)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
      {showHints ? (
        <div className="hints">
          <span>Try</span>
          {FEATURED.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => {
                onQuery(city.name)
                onSelect(city)
              }}
            >
              {city.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Current({ place, weather, unit }: { place: Place; weather: Weather; unit: Unit }) {
  const { current, daily } = weather
  const today = daily[0]
  const description = describeWeather(current.weatherCode)
  return (
    <section className="current" aria-labelledby="place-name">
      <div className="current-copy">
        <p className="eyebrow">
          Observed {formatClock(current.time)}
          <span aria-hidden="true"> · </span>
          {weather.timezone.replace(/_/g, ' ')}
        </p>
        <h1 id="place-name">{place.name}</h1>
        <p className="where">{formatPlace(place) || 'Pinned location'}</p>
        <dl className="coords">
          <div>
            <dt>Latitude</dt>
            <dd>{formatLat(place.latitude)}</dd>
          </div>
          <div>
            <dt>Longitude</dt>
            <dd>{formatLon(place.longitude)}</dd>
          </div>
        </dl>
      </div>
      <div className="current-readout">
        <WeatherMark className="hero-mark" kind={iconKind(current.weatherCode, current.isDay)} />
        <div>
          <p className="temp">
            <span className="temp-value">{Math.round(toTemp(current.temperature, unit))}</span>
            <span className="temp-degree">°{unit === 'f' ? 'F' : 'C'}</span>
          </p>
          <p className="condition">{description}</p>
          {today ? (
            <p className="minmax">
              H {formatTemp(today.tMax, unit)}
              <span aria-hidden="true"> / </span>
              L {formatTemp(today.tMin, unit)}
            </p>
          ) : null}
        </div>
      </div>
      <ul className="stats">
        <li>
          <span>Feels like</span>
          <strong>{formatTemp(current.feelsLike, unit)}</strong>
        </li>
        <li>
          <span>Humidity</span>
          <strong>{Math.round(current.humidity)}%</strong>
        </li>
        <li>
          <span>Wind</span>
          <strong>
            {formatWind(current.windSpeed, unit)} {formatCompass(current.windDirection)}
          </strong>
        </li>
        <li>
          <span>Pressure</span>
          <strong>{current.pressure != null ? `${Math.round(current.pressure)} hPa` : '—'}</strong>
        </li>
        <li>
          <span>Sunrise</span>
          <strong>{today?.sunrise ? formatClock(today.sunrise) : '—'}</strong>
        </li>
        <li>
          <span>Sunset</span>
          <strong>{today?.sunset ? formatClock(today.sunset) : '—'}</strong>
        </li>
      </ul>
    </section>
  )
}

function Hourly({
  hours,
  unit,
  isDayNow,
}: {
  hours: Weather['hourly']
  unit: Unit
  isDayNow: boolean
}) {
  if (hours.length === 0) return null
  return (
    <section className="hourly" aria-labelledby="hourly-heading">
      <div className="section-head">
        <h2 id="hourly-heading">Next 24 hours</h2>
        <p>Local time</p>
      </div>
      <div className="hourly-scroller">
        <ol>
          {hours.map((hour, index) => {
            const hourNum = Number(hour.time.slice(11, 13))
            const isDay = Number.isFinite(hourNum) ? hourNum >= 6 && hourNum < 20 : isDayNow
            return (
              <li key={hour.time}>
                <p className="hourly-time">{index === 0 ? 'Now' : formatClock(hour.time)}</p>
                <WeatherMark kind={iconKind(hour.weatherCode, isDay)} />
                <p className="hourly-temp">{formatTemp(hour.temperature, unit)}</p>
                <p className="hourly-pop">{hour.precipProb != null ? `${hour.precipProb}%` : '—'}</p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function Forecast({ days, unit, todayIso }: { days: Weather['daily']; unit: Unit; todayIso: string }) {
  const range = useMemo(() => {
    if (days.length === 0) return { min: 0, span: 1 }
    const lows = days.map((day) => toTemp(day.tMin, unit))
    const highs = days.map((day) => toTemp(day.tMax, unit))
    const min = Math.min(...lows)
    const max = Math.max(...highs)
    return { min, span: Math.max(max - min, 1) }
  }, [days, unit])

  if (days.length === 0) return null

  return (
    <section className="forecast" aria-labelledby="forecast-heading">
      <div className="section-head">
        <h2 id="forecast-heading">{days.length}-day forecast</h2>
        <p>Highs, lows, and chance of precipitation</p>
      </div>
      <ol>
        {days.map((day) => {
          const start = ((toTemp(day.tMin, unit) - range.min) / range.span) * 100
          const end = ((toTemp(day.tMax, unit) - range.min) / range.span) * 100
          return (
            <li key={day.date}>
              <div className="day-name">
                <strong>{formatWeekday(day.date, todayIso)}</strong>
                <span>{formatShortDate(day.date)}</span>
              </div>
              <div className="day-cond">
                <WeatherMark kind={iconKind(day.weatherCode, true)} />
                <span>{describeWeather(day.weatherCode)}</span>
              </div>
              <p className="day-pop">{day.precipProb != null ? `${day.precipProb}%` : '—'}</p>
              <div className="range" aria-hidden="true">
                <span className="range-min">{formatTemp(day.tMin, unit)}</span>
                <span className="range-track">
                  <span className="range-fill" style={{ left: `${start}%`, width: `${Math.max(end - start, 8)}%` }} />
                </span>
                <span className="range-max">{formatTemp(day.tMax, unit)}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Skeleton() {
  return (
    <section className="status-panel" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading weather</p>
      <div className="skeleton">
        <div className="bone bone-kicker" />
        <div className="bone bone-title" />
        <div className="bone bone-sub" />
        <div className="bone bone-temp" />
      </div>
      <div className="skeleton stat-skel">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="bone bone-stat" />
        ))}
      </div>
    </section>
  )
}

function Atmosphere({ theme }: { theme: Theme }) {
  const showMoon = theme === 'clear-night'
  const showStars = theme === 'clear-night' || theme === 'storm'
  const showRain = theme === 'rain' || theme === 'storm'
  const showSnow = theme === 'snow'
  return (
    <div className="atmosphere" aria-hidden="true">
      <div className={`orb${showMoon ? ' is-moon' : ''}`} />
      {showStars ? <div className="stars" /> : null}
      {showRain || showSnow ? (
        <div className="weather-fall">
          {Array.from({ length: 16 }, (_, index) => (
            <span key={index} className={showSnow ? 'flake' : 'drop'} style={{ '--i': index } as CSSProperties} />
          ))}
        </div>
      ) : null}
      <div className="haze" />
      <div className="streaks" />
      <div className="grain" />
      <div className="axis" />
    </div>
  )
}

function LocateIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle cx="10" cy="10" r="3" fill="currentColor" />
      <circle cx="10" cy="10" r="6.2" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M10 2v2.2M10 15.8V18M2 10h2.2M15.8 10H18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function WeatherMark({ kind, className }: { kind: Mark; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width="36" height="36" fill="none" aria-hidden="true">
      {kind === 'sun' && (
        <>
          <circle cx="24" cy="24" r="7.5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M24 6v4.5M24 37.5V42M6 24h4.5M37.5 24H42M11.4 11.4l3.2 3.2M33.4 33.4l3.2 3.2M11.4 36.6l3.2-3.2M33.4 14.6l3.2-3.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'moon' && (
        <path
          d="M30.5 12.2A12.5 12.5 0 1 0 35.8 30 10 10 0 0 1 30.5 12.2Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )}
      {kind === 'partly' && (
        <>
          <circle cx="18.5" cy="17" r="5.5" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M17 29.5h12.2a6.3 6.3 0 0 0 .4-12.6 8.2 8.2 0 0 0-15.6 2.4A5.6 5.6 0 0 0 17 29.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === 'cloud' && (
        <path
          d="M15.5 33h16.8a7.2 7.2 0 0 0 .5-14.4 9.4 9.4 0 0 0-18 2.8A6.4 6.4 0 0 0 15.5 33Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )}
      {kind === 'fog' && (
        <>
          <path
            d="M16 24h17.2a6.4 6.4 0 0 0 .4-12.7 8.4 8.4 0 0 0-16.1 2.4A5.7 5.7 0 0 0 16 24Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M13 30h22M16 35h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {kind === 'drizzle' && (
        <>
          <path
            d="M16 22.5h16.4a6.4 6.4 0 0 0 .4-12.7 8.5 8.5 0 0 0-16.3 2.5A5.7 5.7 0 0 0 16 22.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M19 29v3M24 28v3M29 29v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {kind === 'rain' && (
        <>
          <path
            d="M16 22h16.4a6.4 6.4 0 0 0 .4-12.7 8.5 8.5 0 0 0-16.3 2.5A5.7 5.7 0 0 0 16 22Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M18.5 28.5 16 36M25 27.5 22.5 36M31.5 28.5 29 36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {kind === 'snow' && (
        <>
          <path
            d="M16 21.5h16.4a6.4 6.4 0 0 0 .4-12.7 8.5 8.5 0 0 0-16.3 2.5A5.7 5.7 0 0 0 16 21.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M18.5 29.5v6M15.5 32.5h6M24.5 28v6M21.5 31h6M30.5 29.5v6M27.5 32.5h6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'storm' && (
        <>
          <path
            d="M15.5 21.5h15.2a6 6 0 0 0 .4-11.9 8 8 0 0 0-15.4 2.4A5.4 5.4 0 0 0 15.5 21.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M25 22.5 18.5 32h6.2L21 41.5 32 29.2h-6.4L29.2 22.5h-4.2Z" fill="currentColor" />
        </>
      )}
    </svg>
  )
}

function noticeCopy(status: Status, error: string): { eyebrow: string; title: string; body: string } {
  if (status === 'not-found') {
    return {
      eyebrow: 'Unknown place',
      title: 'That city isn’t on the map.',
      body: error || 'Try another spelling, or add a country.',
    }
  }
  if (status === 'geo') {
    return {
      eyebrow: 'Location',
      title: 'Location isn’t available.',
      body: error || 'Search for a city instead.',
    }
  }
  return {
    eyebrow: 'Weather service',
    title: 'The forecast didn’t arrive.',
    body: error || 'Check your connection and try again.',
  }
}

function readQueryParam(): string {
  try {
    return new URLSearchParams(window.location.search).get('q')?.trim() ?? ''
  } catch {
    return ''
  }
}

function syncQueryParam(name: string): void {
  try {
    const url = new URL(window.location.href)
    if (name) url.searchParams.set('q', name)
    else url.searchParams.delete('q')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {
    /* ignore restricted history */
  }
}
