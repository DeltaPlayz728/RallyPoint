// Geo scoping for event discovery.
//
// Casual hangouts stay local; paid/social events reach a wider radius.
// e.g. from Haarlem: hangouts reach ~to The Hague, paid events ~to Antwerp.
// Tune these two numbers to change the reach — nothing else needs to change.
export const CASUAL_RADIUS_KM = 75
export const EVENT_RADIUS_KM = 175

export type LatLng = { lat: number; lng: number }

// Great-circle distance in km (for true-circle refinement / distance labels).
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Lat/lng bounding box around a point for a given radius (km). Used as a cheap,
// index-friendly DB pre-filter so we never ship the whole world's events to the
// client. It's a square, slightly larger than the true circle — refine with
// haversineKm() client-side if you need an exact radius.
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180))
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  }
}
