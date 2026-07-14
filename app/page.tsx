import Link from 'next/link'
import Logo from '@/components/Logo'
import Reveal from '@/components/Reveal'
import HeroPhoneMockup from '@/components/HeroPhoneMockup'
import HeroVideoBackground from '@/components/HeroVideoBackground'
import {
  Zap, MapPin, PartyPopper, Handshake, Home, MessageCircle,
  Map as MapIcon, Camera, Lock, Gift, ArrowRight,
  type LucideIcon,
} from 'lucide-react'

const CITIES = ['Breda', 'Amsterdam', 'Rotterdam', 'Utrecht', 'The Hague', 'Eindhoven', 'Tilburg', 'Groningen']

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] flex flex-col overflow-x-hidden">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full relative z-10">
        <span className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Logo size={28} />
          Rally<span className="text-accent">Point</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition"
          >
            Log in
          </Link>
          <Link
            href="/welcome"
            className="bg-accent hover:brightness-90 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-sm shadow-accent/30"
          >
            Sign up free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-12 pb-24 sm:pt-20 sm:pb-32">
        {/* Background video montage (real footage once available — see
            HeroVideoBackground.tsx) sits behind the gradient blobs, which
            stay on regardless so the hero still looks intentional with no
            video file present yet. */}
        <HeroVideoBackground />

        {/* Ambient gradient blobs — the thing that actually stops this from
            reading as a bare Tailwind template. Purely decorative, so they're
            aria-hidden and absolutely positioned behind everything. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-24 -left-32 w-[28rem] h-[28rem] bg-accent/25 rounded-full blur-3xl animate-blob-float" />
          <div className="absolute top-1/3 -right-24 w-[24rem] h-[24rem] bg-teal-400/20 rounded-full blur-3xl animate-blob-float-slow" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-purple-400/10 rounded-full blur-3xl animate-blob-float" />
        </div>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div className="text-center lg:text-left">
            <Link
              href="/early-access"
              className="inline-flex items-center gap-1.5 bg-orange-100 dark:bg-orange-500/10 border border-orange-300 dark:border-orange-500/30 text-accent text-xs font-medium px-3 py-1 rounded-full mb-6 hover:bg-orange-200 dark:hover:bg-orange-500/20 transition"
            >
              <Zap size={14} /> Founding Member spots open — claim yours →
            </Link>

            <h1 className="text-5xl sm:text-6xl font-bold leading-[1.05] mb-6 tracking-tight">
              Stop scrolling.<br />
              <span className="bg-gradient-to-r from-accent to-orange-400 bg-clip-text text-transparent">Start showing up.</span>
            </h1>

            <p className="text-gray-500 dark:text-gray-400 text-lg max-w-md mx-auto lg:mx-0 mb-10 leading-relaxed">
              RallyPoint connects people through real-life events and communities — casual
              meetups, church gatherings, bowling nights, and everything in between.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                href="/welcome"
                className="group inline-flex items-center justify-center gap-2 bg-accent hover:brightness-90 text-white font-bold px-8 py-4 rounded-xl text-lg transition shadow-lg shadow-accent/30"
              >
                Find events near me
                <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </Link>
              <Link
                href="/feed"
                className="border border-gray-300 dark:border-gray-700 hover:border-accent text-gray-600 dark:text-gray-400 hover:text-accent font-medium px-8 py-4 rounded-xl text-lg transition"
              >
                Browse events
              </Link>
            </div>

            <p className="text-gray-400 dark:text-gray-500 text-xs mt-6">Free to join · No app download needed</p>
          </div>

          {/* Visual */}
          <div className="hidden lg:flex justify-center pt-6">
            <HeroPhoneMockup />
          </div>
        </div>
      </section>

      {/* City marquee — quiet social proof without needing real logos/testimonials yet */}
      <div className="border-y border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-[#221c16]/60 py-4 overflow-hidden">
        <p className="text-center text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-3">
          Already rallying in
        </p>
        <div className="flex overflow-hidden">
          <div className="flex gap-10 animate-marquee whitespace-nowrap">
            {[...CITIES, ...CITIES].map((city, i) => (
              <span key={i} className="text-sm font-semibold text-gray-400 dark:text-gray-600">
                {city}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <section className="px-6 py-24 max-w-4xl mx-auto w-full">
        <Reveal>
          <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-16 max-w-md mx-auto">
            Three steps between "stuck on your phone" and actually being somewhere.
          </p>
        </Reveal>

        <div className="relative">
          {/* Connecting line through the steps, desktop only */}
          <div aria-hidden className="hidden sm:block absolute top-8 left-[16.6%] right-[16.6%] h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {([
              { step: '01', icon: MapPin, title: 'Find an event', desc: 'Browse casual meetups, social events, and community gatherings happening near you right now.' },
              { step: '02', icon: PartyPopper, title: 'Show up', desc: 'Join, chat with the group beforehand, and actually go meet people in person.' },
              { step: '03', icon: Handshake, title: 'Connect', desc: "After the event, request 1:1 meetups and unlock each other's socials." },
            ] as { step: string; icon: LucideIcon; title: string; desc: string }[]).map((item, i) => (
              <Reveal key={item.step} delay={i * 120}>
                <div className="relative bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 h-full hover:-translate-y-1 hover:shadow-lg transition">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
                    <item.icon size={22} />
                  </div>
                  <div className="text-xs text-accent font-bold tracking-widest mb-1.5">STEP {item.step}</div>
                  <h3 className="font-bold text-[#15110d] dark:text-[#fdf6ec] mb-2 text-lg">{item.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features — bento-style grid instead of a uniform 8-up */}
      <section className="px-6 py-24 bg-white dark:bg-[#221c16] relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-32 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="max-w-5xl mx-auto relative">
          <Reveal>
            <h2 className="text-3xl font-bold text-center mb-4">Everything you need to actually meet people</h2>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-14 max-w-md mx-auto">
              Not another feed to scroll — a toolkit for showing up in real life.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 auto-rows-[minmax(0,1fr)]">
            {([
              { icon: Home, label: 'Live Feed', desc: 'Casual meetups happening now', big: true },
              { icon: PartyPopper, label: 'Venue Events', desc: 'Ticketed events at real venues' },
              { icon: MessageCircle, label: 'Group Chat', desc: 'Talk before you show up' },
              { icon: MapIcon, label: 'Pulse Map', desc: 'See events around you visually' },
              { icon: Handshake, label: '1:1 Meetups', desc: 'Request private hangouts' },
              { icon: Camera, label: 'Social Links', desc: 'Share socials after meeting IRL' },
              { icon: Lock, label: 'Safe by design', desc: 'Age siloing, no ID required' },
              { icon: Gift, label: 'Free to join', desc: 'No subscription to browse', big: true },
            ] as { icon: LucideIcon; label: string; desc: string; big?: boolean }[]).map((f, i) => (
              <Reveal key={f.label} delay={(i % 4) * 80} className={f.big ? 'sm:col-span-2' : ''}>
                <div className="bg-[#fdf6ec] dark:bg-[#15110d] border border-gray-200 dark:border-gray-700 rounded-2xl p-5 h-full hover:border-accent/50 transition">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-3">
                    <f.icon size={18} />
                  </div>
                  <div className="font-semibold text-sm text-[#15110d] dark:text-[#fdf6ec] mb-1">{f.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <Reveal>
          <div className="max-w-3xl mx-auto relative bg-gradient-to-br from-accent to-orange-500 rounded-3xl px-8 py-16 text-center overflow-hidden shadow-xl shadow-accent/20">
            <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 bg-black/10 rounded-full blur-2xl" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white relative">Ready to rally?</h2>
            <p className="text-white/90 mb-8 max-w-sm mx-auto relative">
              Join RallyPoint and start meeting people — or bring your whole community along.
            </p>
            <Link
              href="/welcome"
              className="relative inline-flex items-center gap-2 bg-white text-accent font-bold px-10 py-4 rounded-xl text-lg hover:brightness-95 transition shadow-lg"
            >
              Create your free account
              <ArrowRight size={18} />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 px-6 py-6 text-center text-gray-600 dark:text-gray-400 text-xs">
        <div className="flex items-center justify-center gap-6 mb-3 flex-wrap">
          <Link href="/auth/login" className="hover:text-black dark:hover:text-white transition">Log in</Link>
          <Link href="/welcome" className="hover:text-black dark:hover:text-white transition">Sign up</Link>
          <Link href="/feed" className="hover:text-black dark:hover:text-white transition">Browse events</Link>
          <Link href="/tos" className="hover:text-black dark:hover:text-white transition">Terms</Link>
          <Link href="/privacy" className="hover:text-black dark:hover:text-white transition">Privacy</Link>
        </div>
        © {new Date().getFullYear()} RallyPoint · Breda, Netherlands
      </footer>

    </div>
  )
}
