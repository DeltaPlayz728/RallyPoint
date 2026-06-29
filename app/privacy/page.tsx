import Link from 'next/link'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-gray-500 dark:text-gray-400 text-sm hover:text-black dark:hover:text-white mb-8 block">← Back</Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-10">Last updated: June 2026</p>

        <div className="space-y-8 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">1. Who We Are</h2>
            <p>RallyPoint ("we", "us", "our") is a social experience platform operated by a sole trader registered in the Netherlands. For GDPR purposes, we are the data controller. You can reach us at <a href="mailto:2023ford.john@gmail.com" className="text-accent hover:underline">2023ford.john@gmail.com</a>.</p>
          </section>

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">2. Data We Collect</h2>
            <p className="mb-2">We collect the following personal data when you use RallyPoint:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-500 dark:text-gray-400">
              <li><strong className="text-gray-600 dark:text-gray-400">Account data:</strong> email address, username, date of birth</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Profile data:</strong> full name, city, bio, interests, social vibe, profile photo</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Social links:</strong> Instagram, TikTok, and Snapchat usernames (if provided)</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Event data:</strong> events you create, join, or attend</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Messages:</strong> content of group chat messages and meetup requests</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Location data:</strong> city/address of events you create (used for map display)</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Payment data:</strong> processed by Stripe — we do not store card details</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Usage data:</strong> timestamps of activity, notifications read</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">3. How We Use Your Data</h2>
            <p className="mb-2">We use your data to:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-500 dark:text-gray-400">
              <li>Create and manage your account</li>
              <li>Display your profile to other users (within platform rules)</li>
              <li>Show you events relevant to your location and age group</li>
              <li>Process payments for Social events via Stripe</li>
              <li>Send in-app notifications about events, meetups, and messages</li>
              <li>Enforce age-based content separation (under 18 / 18+)</li>
              <li>Improve the platform and fix issues</li>
            </ul>
            <p className="mt-2">Our legal basis for processing is <strong className="text-gray-600 dark:text-gray-400">contract performance</strong> (to provide the service you signed up for) and <strong className="text-gray-600 dark:text-gray-400">legitimate interests</strong> (safety, platform improvement). Where required by law, we obtain your consent.</p>
          </section>

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">4. Social Links Visibility</h2>
            <p>Your social media handles (Instagram, TikTok, Snapchat) are <strong className="text-gray-600 dark:text-gray-400">never shown publicly</strong>. They are only visible to users who have attended at least one of the same events as you. This is a core safety feature of RallyPoint.</p>
          </section>

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">5. Data Sharing</h2>
            <p className="mb-2">We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-500 dark:text-gray-400">
              <li><strong className="text-gray-600 dark:text-gray-400">Supabase</strong> — our database and authentication provider (EU data residency available)</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Stripe</strong> — payment processing. Your payment data is governed by Stripe's privacy policy.</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Vercel</strong> — hosting provider</li>
              <li>Law enforcement, if required by a valid legal obligation under Dutch or EU law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">6. Data Retention</h2>
            <p>We retain your data for as long as your account is active. If you delete your account, your personal data is deleted within 30 days, except where retention is required by law (e.g. financial records related to payments, which we retain for 7 years per Dutch fiscal law).</p>
          </section>

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">7. Your Rights (GDPR)</h2>
            <p className="mb-2">Under the General Data Protection Regulation (GDPR), you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-500 dark:text-gray-400">
              <li><strong className="text-gray-600 dark:text-gray-400">Access</strong> — request a copy of the data we hold about you</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Rectification</strong> — correct inaccurate data</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Erasure</strong> — request deletion of your data ("right to be forgotten")</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Portability</strong> — receive your data in a machine-readable format</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Restriction</strong> — limit how we process your data</li>
              <li><strong className="text-gray-600 dark:text-gray-400">Objection</strong> — object to processing based on legitimate interests</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, email us at <a href="mailto:2023ford.john@gmail.com" className="text-accent hover:underline">2023ford.john@gmail.com</a>. We will respond within 30 days. You also have the right to lodge a complaint with the Dutch data protection authority (<a href="https://autoriteitpersoonsgegevens.nl" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">Autoriteit Persoonsgegevens</a>).</p>
          </section>

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">8. Minors</h2>
            <p>RallyPoint is available to users aged 13 and older. Users under 18 are kept in a separate age group and cannot interact with adult content or users. We do not knowingly collect data from children under 13. If you believe a child under 13 has registered, contact us immediately and we will delete the account.</p>
          </section>

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">9. Cookies</h2>
            <p>We use only essential cookies required for authentication (via Supabase Auth). We do not use tracking, advertising, or analytics cookies. No third-party advertising networks have access to your data through RallyPoint.</p>
          </section>

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">10. Security</h2>
            <p>We take reasonable technical measures to protect your data, including encrypted connections (HTTPS), row-level security on our database, and restricted access to production systems. No method of transmission over the internet is 100% secure — use a strong password and keep your account credentials private.</p>
          </section>

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy. We will notify users of material changes via the app. The "last updated" date at the top of this page will always reflect the most recent version.</p>
          </section>

          <section>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-base mb-2">12. Contact</h2>
            <p>For privacy questions or to exercise your rights: <a href="mailto:2023ford.john@gmail.com" className="text-accent hover:underline">2023ford.john@gmail.com</a></p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 flex gap-4 text-xs text-gray-600 dark:text-gray-400">
          <Link href="/tos" className="hover:text-black dark:hover:text-white transition">Terms of Service</Link>
          <Link href="/" className="hover:text-black dark:hover:text-white transition">Back to RallyPoint</Link>
        </div>
      </div>
    </div>
  )
}
