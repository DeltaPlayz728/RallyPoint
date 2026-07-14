import { MapPin, MessageCircle, Users, Star } from 'lucide-react'

// Hand-built CSS phone frame standing in for a real app screenshot — kept as
// stylized UI cards rather than fake photos, so it never goes stale when the
// real feed UI changes and doesn't require managing an image asset. This is
// the hero's main visual, meant to make the landing page look like a real
// product instead of a text-only template.
export default function HeroPhoneMockup() {
  return (
    <div className="relative select-none">
      {/* Floating notification, offset above the frame for depth */}
      <div className="absolute -top-5 -left-8 sm:-left-14 z-20 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg px-3.5 py-2.5 flex items-center gap-2.5 animate-gentle-bob">
        <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
          <Users size={15} />
        </div>
        <div className="leading-tight">
          <p className="text-xs font-semibold text-[#15110d] dark:text-[#fdf6ec]">Maya just RSVP'd</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Sunday Gathering & Fellowship</p>
        </div>
      </div>

      {/* Second floating card, offset below-right, delayed bob for a natural feel */}
      <div className="absolute -bottom-6 -right-6 sm:-right-10 z-20 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg px-3.5 py-2.5 flex items-center gap-2 animate-gentle-bob" style={{ animationDelay: '1.2s' }}>
        <Star size={14} className="text-amber-400 fill-amber-400" />
        <p className="text-xs font-semibold text-[#15110d] dark:text-[#fdf6ec]">4.9 average vibe rating</p>
      </div>

      {/* Phone frame */}
      <div className="relative w-[260px] sm:w-[290px] rounded-[2.5rem] border-[10px] border-[#15110d] dark:border-[#0a0806] bg-[#15110d] dark:bg-[#0a0806] shadow-2xl overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#15110d] dark:bg-[#0a0806] rounded-b-2xl z-10" />

        <div className="bg-[#fdf6ec] dark:bg-[#221c16] rounded-[1.8rem] overflow-hidden">
          {/* Status bar spacer */}
          <div className="h-7 bg-accent" />

          <div className="p-3 space-y-2.5">
            <div className="flex items-center justify-between px-0.5 pb-1">
              <span className="text-sm font-bold text-[#15110d] dark:text-[#fdf6ec]">Happening now</span>
              <MapPin size={14} className="text-accent" />
            </div>

            {/* Event card 1 */}
            <div className="bg-white dark:bg-[#2b241c] rounded-2xl p-3 shadow-sm">
              <div className="h-16 rounded-xl bg-gradient-to-br from-orange-300 to-accent mb-2" />
              <p className="text-xs font-bold text-[#15110d] dark:text-[#fdf6ec]">Coffee & board games</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">7 going · 0.4 mi away</p>
            </div>

            {/* Event card 2 */}
            <div className="bg-white dark:bg-[#2b241c] rounded-2xl p-3 shadow-sm">
              <div className="h-16 rounded-xl bg-gradient-to-br from-teal-300 to-teal-500 mb-2" />
              <p className="text-xs font-bold text-[#15110d] dark:text-[#fdf6ec]">Sunday pickup soccer</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">14 going · 1.1 mi away</p>
            </div>

            {/* Chat preview strip */}
            <div className="bg-white dark:bg-[#2b241c] rounded-2xl p-3 shadow-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white shrink-0">
                <MessageCircle size={13} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#15110d] dark:text-[#fdf6ec] truncate">XRDS Community</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">Sarah: see you all Sunday! 🎉</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Soft glow behind the phone */}
      <div className="absolute inset-0 -z-10 bg-accent/20 blur-3xl rounded-full scale-90" />
    </div>
  )
}
