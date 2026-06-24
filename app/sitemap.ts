import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://rally-point-eb1q.vercel.app'
  const now = new Date()

  // Only public, unauthenticated routes belong here — everything else
  // requires a session and shouldn't be crawled/indexed anyway (see robots.ts).
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/early-access`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/welcome`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/auth/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/tos`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
