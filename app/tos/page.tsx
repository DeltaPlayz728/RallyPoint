import Link from 'next/link'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-gray-500 text-sm hover:text-gray-300 mb-8 block">← Back</Link>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-10">Last updated: June 2026</p>

        <div className="space-y-8 text-gray-300 text-sm leading-relaxed">

          <section>
            <h2 className="text-white font-semibold text-base mb-2">1. Acceptance of Terms</h2>
            <p>By creating an account or using RallyPoint ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. RallyPoint is operated by a sole trader registered in the Netherlands.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">2. Eligibility</h2>
            <p>You must be at least 13 years old to use RallyPoint. Users under 18 ("minors") have limited access — they can only interact with content created by other minors. By registering, you confirm that the date of birth you provide is accurate. Falsifying your age is a violation of these Terms and may result in account termination.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">3. Your Account</h2>
            <p>You are responsible for maintaining the security of your account and all activity that occurs under it. You must provide accurate information at signup. You may not share your account or impersonate another person. We reserve the right to suspend or terminate accounts that violate these Terms.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">4. User Conduct</h2>
            <p className="mb-2">You agree not to use RallyPoint to:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-400">
              <li>Harass, threaten, or harm other users</li>
              <li>Post false, misleading, or fraudulent content</li>
              <li>Create events you do not intend to host</li>
              <li>Solicit or engage in illegal activity</li>
              <li>Scrape, spam, or abuse the platform in any automated way</li>
              <li>Circumvent the age separation features of the platform</li>
            </ul>
            <p className="mt-2">Violation of these rules may result in immediate account termination without refund.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">5. Events and Payments</h2>
            <p>RallyPoint allows users to create and join events. Some events require payment ("Social Events"). Payments are processed by Stripe. By paying for an event, you agree to Stripe's terms of service. Event fees are non-refundable unless the event is cancelled by the host. RallyPoint is not liable for events that do not occur as described — hosts are solely responsible for the events they create.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">6. Content</h2>
            <p>You retain ownership of content you post (profile info, messages, event details). By posting, you grant RallyPoint a non-exclusive, royalty-free license to display that content within the Service. You may not post content that is illegal, abusive, or infringes on third-party rights.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">7. Limitation of Liability</h2>
            <p>RallyPoint is provided "as is." We do not guarantee the safety of in-person meetings arranged through the platform. You attend events at your own risk. To the fullest extent permitted by Dutch law, RallyPoint is not liable for any indirect, incidental, or consequential damages arising from use of the Service.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">8. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. We will notify users of significant changes via the app. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">9. Governing Law</h2>
            <p>These Terms are governed by the laws of the Netherlands. Any disputes will be subject to the jurisdiction of the courts of Breda, Netherlands.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">10. Contact</h2>
            <p>Questions about these Terms? Contact us at <a href="mailto:2023ford.john@gmail.com" className="text-orange-400 hover:underline">2023ford.john@gmail.com</a></p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex gap-4 text-xs text-gray-600">
          <Link href="/privacy" className="hover:text-gray-400 transition">Privacy Policy</Link>
          <Link href="/" className="hover:text-gray-400 transition">Back to RallyPoint</Link>
        </div>
      </div>
    </div>
  )
}
