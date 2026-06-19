// Shared "is this area empty? let the assistant seed something" trigger.
// Originally lived only in app/map/page.tsx — now also called from Feed and
// Events on load (per product decision: catch users who never visit Map).
// At most once per day per browser, gated by a localStorage timestamp shared
// across all three call sites (same key everywhere, so visiting two of these
// pages in a row doesn't double-fire).
const SEED_CHECK_STORAGE_KEY = 'rp_seed_checked_at'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function triggerSeedCheck(userId: string) {
  if (typeof window === 'undefined' || !navigator.geolocation) return

  const lastSeedCheck = Number(localStorage.getItem(SEED_CHECK_STORAGE_KEY) ?? 0)
  if (Date.now() - lastSeedCheck <= ONE_DAY_MS) return

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      // Set the gate as soon as we have a position, not after the network
      // calls succeed — a flaky reverse-geocode/seed-check call shouldn't mean
      // we just retry every single page load for the rest of the day.
      localStorage.setItem(SEED_CHECK_STORAGE_KEY, String(Date.now()))
      try {
        const { latitude: lat, longitude: lng } = pos.coords
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
        const geoData = await geoRes.json()
        const city = geoData?.address?.city || geoData?.address?.town || geoData?.address?.village || geoData?.address?.county
        if (city) {
          await fetch('/api/assistant/seed-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, lat, lng, city }),
          })
        }
      } catch { /* seed proposal is best-effort, never block the page */ }
    },
    () => { /* location denied — silently skip, nothing to fall back to here */ },
    { timeout: 6000, maximumAge: 60000 }
  )
}
