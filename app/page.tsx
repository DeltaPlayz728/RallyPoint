import Link from 'next/link'
import Logo from '@/components/Logo'
import {
  Zap, MapPin, PartyPopper, Handshake, Home, MessageCircle,
  Map as MapIcon, Camera, Lock, Gift,
  type LucideIcon,
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
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
            className="bg-accent hover:brightness-90 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            Sign up free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <Link
          href="/early-access"
          className="inline-block bg-orange-100 border border-orange-300 text-accent text-xs font-medium px-3 py-1 rounded-full mb-6 hover:bg-orange-200 transition"
        >
          <span className="inline-flex items-center gap-1"><Zap size={14} /> Founding Member spots open — claim yours →</span>
        </Link>

        <h1 className="text-5xl sm:text-6xl font-bold leading-tight max-w-2xl mb-6">
          Stop scrolling.<br />
          <span className="text-accent">Start showing up.</span>
        </h1>

        <p className="text-gray-500 dark:text-gray-400 text-lg max-w-md mb-10 leading-relaxed">
          RallyPoint connects people aged 18–30 through real-life events — casual meetups,
          bowling nights, and everything in between.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/welcome"
            className="bg-accent hover:brightness-90 text-white font-bold px-8 py-4 rounded-xl text-lg transition"
          >
            Find events near me →
          </Link>
          <Link
            href="/feed"
            className="border border-gray-300 dark:border-gray-700 hover:border-gray-500 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white font-medium px-8 py-4 rounded-xl text-lg transition"
          >
            Browse events
          </Link>
        </div>

        <p className="text-gray-600 dark:text-gray-400 text-xs mt-6">Free to join · No app download needed</p>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {([
            { step: '01', icon: MapPin,    title: 'Find an event', desc: 'Browse casual meetups and social events happening near you right now.' },
            { step: '02', icon: PartyPopper, title: 'Show up', desc: 'Join, chat with the group beforehand, and actually go meet people in person.' },
            { step: '03', icon: Handshake, title: 'Connect', desc: "After the event, request 1:1 meetups and unlock each other's socials." },
          ] as { step: string; icon: LucideIcon; title: string; desc: string }[]).map(item => (
            <div key={item.step} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
              <item.icon size={28} className="mb-3 text-[#15110d] dark:text-[#fdf6ec]" />
              <div className="text-xs text-accent font-semibold mb-1">{item.step}</div>
              <h3 className="font-bold text-[#15110d] dark:text-[#fdf6ec] mb-2">{item.title}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 bg-white dark:bg-[#221c16]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Everything you need to actually meet people</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {([
              { icon: Home,          label: 'Live Feed', desc: 'Casual meetups happening now' },
              { icon: PartyPopper,    label: 'Venue Events', desc: 'Ticketed events at real venues' },
              { icon: MessageCircle,  label: 'Group Chat', desc: 'Talk before you show up' },
              { icon: MapIcon,        label: 'Pulse Map', desc: 'See events around you visually' },
              { icon: Handshake,      label: '1:1 Meetups', desc: 'Request private hangouts' },
              { icon: Camera,         label: 'Social Links', desc: 'Share socials after meeting IRL' },
              { icon: Lock,           label: 'Safe by design', desc: 'Age siloing, no ID required' },
              { icon: Gift,           label: 'Free to join', desc: 'No subscription to browse' },
            ] as { icon: LucideIcon; label: string; desc: string }[]).map(f => (
              <div key={f.label} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <f.icon size={20} className="mb-2 text-[#15110d] dark:text-[#fdf6ec]" />
                <div className="font-semibold text-sm text-[#15110d] dark:text-[#fdf6ec] mb-1">{f.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to rally?</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
          Join RallyPoint and start meeting people in Breda today.
        </p>
        <Link
          href="/welcome"
          className="inline-block bg-accent hover:brightness-90 text-white font-bold px-10 py-4 rounded-xl text-lg transition"
        >
          Create your free account →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 px-6 py-6 text-center text-gray-600 dark:text-gray-400 text-xs">
        <div className="flex items-center justify-center gap-6 mb-3">
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
