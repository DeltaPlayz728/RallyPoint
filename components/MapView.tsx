'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useTheme } from './ThemeProvider'

export type EventPin = {
  id: string
  title: string
  type: string
  location: string
  price: number
  starts_at: string
  lat: number
  lng: number
  attendee_count: number
  joined?: boolean
}

export type Venue = {
  id: string
  place_id: string
  name: string
  lat: number
  lng: number
  types: string[]
  vicinity: string
  city: string
  is_hub?: boolean
  photo_url?: string | null
  active?: boolean
}

interface MapViewProps {
  events: EventPin[]
  venues: Venue[]
  selectedVenueId: string | null
  onVenueClick: (venue: Venue) => void
  onEventClick: (event: EventPin) => void
  center?: [number, number]
  userDot?: [number, number] | null
}

// Basemap style follows the app theme. MapTiler when a key is set, else keyless
// OpenFreeMap (light) / Carto dark-matter (dark) — all free MapLibre vector styles.
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY
function styleFor(dark: boolean): string {
  if (MAPTILER_KEY) {
    return dark
      ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`
      : `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  }
  return dark
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://tiles.openfreemap.org/styles/liberty'
}

// ─── Icon markup (unchanged from the Leaflet version) ────────────────────────

const LUCIDE_SVG_OPEN = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`

const VENUE_ICON_PATHS: Record<string, string> = {
  music: `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
  beer: `<path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>`,
  coffee: `<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>`,
  trees: `<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>`,
  dumbbell: `<path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/><path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/><path d="m9.6 14.4 4.8-4.8"/>`,
  film: `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>`,
  ferrisWheel: `<circle cx="12" cy="12" r="2"/><path d="M12 2v4"/><path d="m6.8 15-3.5 2"/><path d="m20.7 7-3.5 2"/><path d="M6.8 9 3.3 7"/><path d="m20.7 17-3.5-2"/><path d="m9 22 3-8 3 8"/><path d="M8 22h8"/><path d="M18 18.7a9 9 0 1 0-12 0"/>`,
  utensils: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
  mapPin: `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`,
}

function getVenueIconSvg(types: string[], size = 18): string {
  let key = 'mapPin'
  if (types.includes('bowling_alley')) key = 'mapPin'
  else if (types.includes('night_club')) key = 'music'
  else if (types.includes('bar')) key = 'beer'
  else if (types.includes('cafe')) key = 'coffee'
  else if (types.includes('park')) key = 'trees'
  else if (types.includes('gym')) key = 'dumbbell'
  else if (types.includes('movie_theater')) key = 'film'
  else if (types.includes('amusement_park')) key = 'ferrisWheel'
  else if (types.includes('stadium')) key = 'mapPin'
  else if (types.includes('restaurant')) key = 'utensils'
  return `${LUCIDE_SVG_OPEN(size)}${VENUE_ICON_PATHS[key]}</svg>`
}

function venuePinHtml(types: string[], selected: boolean): string {
  const iconSvg = getVenueIconSvg(types, 18)
  const border = selected ? '#f97316' : '#374151'
  const bg = selected ? '#1c0a00' : '#111827'
  const shadow = selected
    ? '0 0 0 3px rgba(249,115,22,0.3), 0 3px 10px rgba(0,0,0,0.6)'
    : '0 2px 8px rgba(0,0,0,0.5)'
  return `<div class="rp-venue-pin" style="width:38px;height:38px;background:${bg};border:2px solid ${border};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#f3f4f6;box-shadow:${shadow};transition:border-color .2s,box-shadow .2s;">${iconSvg}</div>`
}

function esc(s: string): string {
  const m: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
  return s.replace(/[&<>"]/g, (c) => m[c] ?? c)
}

// Event Hub pin — Snap-style circular icon-in-a-ring + name label, distinct from
// the small event flags. Active hubs (an event happening at the venue soon) "ping".
function hubPinHtml(v: Venue): string {
  const icon = getVenueIconSvg(v.types, 24)
  const ring = v.active ? '#f97316' : '#15110d'
  return `
    <div style="position:relative;width:50px;height:50px;">
      ${v.active ? '<div class="rp-hub-ping" style="position:absolute;inset:0;border-radius:50%;border:3px solid #f97316;"></div>' : ''}
      <div style="position:relative;width:50px;height:50px;border-radius:50%;background:#fff;border:3px solid ${ring};box-shadow:0 3px 9px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#15110d;">${icon}</div>
      <div style="position:absolute;top:54px;left:50%;transform:translateX(-50%);background:${ring};color:#fff;font-size:10px;font-weight:800;border:2px solid #15110d;padding:1px 7px;border-radius:999px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${esc(v.name)}</div>
    </div>`
}

function eventPinHtml(type: string, attendeeCount: number, eventId: string, joined: boolean): string {
  const color = type === 'casual' ? '#22c55e' : '#f97316'
  const hash = eventId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const driftClass = `rp-dot-drift-${(hash % 3) + 1}`
  const driftDur = (4.5 + (hash % 30) * 0.1).toFixed(1) + 's'
  const driftDelay = -((hash % 40) * 0.1).toFixed(1) + 's'
  const poleColor = joined ? color : '#666'
  const flagFill = joined ? color : 'rgba(255,255,255,0.05)'
  const flagStroke = joined ? color : '#888'
  const motionClass = joined ? 'rp-flag-joined' : driftClass
  return `
    <div class="${motionClass}" style="position:relative;width:36px;height:46px;--drift-dur:${driftDur};--drift-delay:${driftDelay};">
      <svg width="36" height="46" viewBox="0 0 36 46" style="display:block;overflow:visible;">
        <ellipse cx="9" cy="44" rx="5" ry="1.6" fill="rgba(0,0,0,0.45)" />
        <line x1="9" y1="44" x2="9" y2="8" stroke="${poleColor}" stroke-width="2.4" stroke-linecap="round" />
        <g class="rp-flag-wave" style="transform-origin:9px 12px;">
          <path d="M9 8 L9 23 L30 15.5 Z" fill="${flagFill}" stroke="${flagStroke}" stroke-width="1.6" stroke-linejoin="round" />
        </g>
      </svg>
      ${attendeeCount > 0 ? `
        <div style="position:absolute;top:-4px;right:-2px;background:${joined ? color : '#333'};color:${joined ? '#000' : '#ccc'};border-radius:999px;font-size:9px;font-weight:800;padding:1px 5px;min-width:17px;text-align:center;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.4);line-height:1.4;">${attendeeCount > 99 ? '99+' : attendeeCount}</div>
      ` : ''}
    </div>`
}

function userDotHtml(): string {
  return `<div class="rp-user-dot" style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.3),0 2px 8px rgba(0,0,0,0.5);"></div>`
}

// Cluster pin — shown instead of individual venue pins when several would
// otherwise overlap at the current zoom (the "8 bars stacked into one dark
// blob" problem). Tapping it zooms in until the group fans out on its own,
// same behavior as Google Maps / Snap Map clustering.
function clusterPinHtml(count: number): string {
  const size = count >= 10 ? 46 : 40
  return `<div style="width:${size}px;height:${size}px;background:#f97316;border:3px solid #15110d;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:${count >= 10 ? 15 : 14}px;box-shadow:0 3px 10px rgba(0,0,0,0.4);font-family:system-ui,-apple-system,sans-serif;">${count > 99 ? '99+' : count}</div>`
}

// MapLibre sets a positioning transform on the marker element itself, so the
// animated pin lives in a child wrapper to avoid transform conflicts.
function markerEl(innerHtml: string, onClick?: () => void): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = innerHtml
  if (onClick) {
    el.style.cursor = 'pointer'
    el.addEventListener('click', (e) => { e.stopPropagation(); onClick() })
  }
  return el
}

// ─── Animation CSS (injected once) ───────────────────────────────────────────

function useMapAnimations() {
  useEffect(() => {
    const id = 'rp-map-styles'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes rpFlagDrop { 0%{transform:translateY(-16px) scale(0.6);opacity:0;} 65%{transform:translateY(5px) scale(1.08);opacity:1;} 100%{transform:translateY(0) scale(1);opacity:1;} }
      @keyframes rpDotDrift1 { 0%,100%{transform:translate(0,0);} 25%{transform:translate(1.5px,-1px);} 50%{transform:translate(-1px,1.5px);} 75%{transform:translate(1px,1px);} }
      @keyframes rpDotDrift2 { 0%,100%{transform:translate(0,0);} 20%{transform:translate(-1.5px,1px);} 55%{transform:translate(1px,-1.5px);} 80%{transform:translate(-0.5px,-0.5px);} }
      @keyframes rpDotDrift3 { 0%,100%{transform:translate(0,0);} 33%{transform:translate(1px,1.5px);} 66%{transform:translate(-1.5px,-0.5px);} }
      @keyframes rpFlagWave { 0%,100%{transform:rotate(0deg);} 50%{transform:rotate(5deg);} }
      @keyframes rpFlagPlant { 0%{transform:scale(0.4) translateY(8px);opacity:0.4;} 55%{transform:scale(1.18) translateY(-4px);opacity:1;} 100%{transform:scale(1) translateY(0);opacity:1;} }
      .rp-venue-pin { animation: rpFlagDrop 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
      .rp-flag-wave { animation: rpFlagWave 2.6s ease-in-out infinite; }
      .rp-flag-joined { animation: rpFlagPlant 0.45s cubic-bezier(0.34,1.56,0.64,1) both; transform-origin: 9px 44px; }
      .rp-dot-drift-1 { animation: rpDotDrift1 var(--drift-dur,5s) ease-in-out infinite; animation-delay: var(--drift-delay,0s); }
      .rp-dot-drift-2 { animation: rpDotDrift2 var(--drift-dur,5s) ease-in-out infinite; animation-delay: var(--drift-delay,0s); }
      .rp-dot-drift-3 { animation: rpDotDrift3 var(--drift-dur,5s) ease-in-out infinite; animation-delay: var(--drift-delay,0s); }
      .rp-user-dot { pointer-events: none !important; }
      @keyframes rpHubPing { 0%{transform:scale(0.95);opacity:0.7;} 70%{transform:scale(1.7);opacity:0;} 100%{opacity:0;} }
      .rp-hub-ping { animation: rpHubPing 2s ease-out infinite; }
      .maplibregl-ctrl-attrib { font-size: 10px; }
    `
    document.head.appendChild(style)
  }, [])
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapView({
  events,
  venues,
  selectedVenueId,
  onVenueClick,
  onEventClick,
  center = [51.5719, 4.7683],
  userDot,
}: MapViewProps) {
  useMapAnimations()
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const currentStyleRef = useRef<string | null>(null)

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const initialStyle = styleFor(
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    )
    currentStyleRef.current = initialStyle
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center: [center[1], center[0]], // MapLibre is [lng, lat]
      zoom: 14,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recenter when the center prop changes (e.g. user location arrives)
  useEffect(() => {
    if (mapRef.current) mapRef.current.easeTo({ center: [center[1], center[0]] })
  }, [center[0], center[1]])

  // Follow the app's light/dark theme. Markers are DOM overlays, so setStyle keeps them.
  useEffect(() => {
    const url = styleFor(theme === 'dark')
    if (!mapRef.current || currentStyleRef.current === url) return
    currentStyleRef.current = url
    mapRef.current.setStyle(url)
  }, [theme])

  // Latest props, readable from the zoomend listener below without re-binding it.
  const latestRef = useRef({ events, venues, selectedVenueId, userDot, onVenueClick, onEventClick })
  latestRef.current = { events, venues, selectedVenueId, userDot, onVenueClick, onEventClick }

  // (Re)render markers when data changes, or when the map finishes zooming
  // (non-hub venue pins re-cluster/de-cluster based on their new pixel spacing).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const draw = () => {
      const { events, venues, selectedVenueId, userDot, onVenueClick, onEventClick } = latestRef.current
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      // Hubs (bowling alleys, theaters, etc.) always render individually — they're
      // meant to stand out and are already spaced apart. Only the small, frequently-
      // clustered everyday pins (bars/cafes/restaurants) get grouped, the way Google
      // Maps/Snap Map decline to cluster "destination" POIs but do cluster dense ones.
      const hubs = venues.filter((v) => v.is_hub)
      const plain = venues.filter((v) => !v.is_hub)

      hubs.forEach((v) => {
        const el = markerEl(hubPinHtml(v), () => onVenueClick(v))
        markersRef.current.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([v.lng, v.lat]).addTo(map))
      })

      // Greedy pixel-distance clustering: project each plain venue to screen space
      // at the current zoom, group anything within CLUSTER_PX of an already-placed
      // group. Cheap (O(n^2) over a handful of nearby venues) and re-runs on zoomend.
      const CLUSTER_PX = 42
      const used = new Array(plain.length).fill(false)
      const points = plain.map((v) => map.project([v.lng, v.lat]))

      plain.forEach((v, i) => {
        if (used[i]) return
        const group = [i]
        used[i] = true
        for (let j = i + 1; j < plain.length; j++) {
          if (used[j]) continue
          const dx = points[i].x - points[j].x
          const dy = points[i].y - points[j].y
          if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_PX) {
            group.push(j)
            used[j] = true
          }
        }

        if (group.length === 1) {
          const el = markerEl(venuePinHtml(v.types, v.place_id === selectedVenueId), () => onVenueClick(v))
          markersRef.current.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([v.lng, v.lat]).addTo(map))
          return
        }

        // Cluster center = average lng/lat of the group. Tap to zoom in until it
        // fans out (capped at 18 so it can't zoom past street level pointlessly).
        const groupVenues = group.map((idx) => plain[idx])
        const clat = groupVenues.reduce((s, gv) => s + gv.lat, 0) / groupVenues.length
        const clng = groupVenues.reduce((s, gv) => s + gv.lng, 0) / groupVenues.length
        const el = markerEl(clusterPinHtml(groupVenues.length), () => {
          map.easeTo({ center: [clng, clat], zoom: Math.min(map.getZoom() + 2.5, 18) })
        })
        markersRef.current.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([clng, clat]).addTo(map))
      })

      events.forEach((e) => {
        const el = markerEl(eventPinHtml(e.type, e.attendee_count, e.id, !!e.joined), () => onEventClick(e))
        markersRef.current.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([e.lng, e.lat]).addTo(map))
      })

      if (userDot) {
        const el = markerEl(userDotHtml())
        markersRef.current.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([userDot[1], userDot[0]]).addTo(map))
      }
    }

    draw()
    map.on('zoomend', draw)
    return () => { map.off('zoomend', draw) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, venues, selectedVenueId, userDot])

  return <div ref={containerRef} style={{ height: '100%', width: '100%', background: '#0d0d0d' }} />
}
