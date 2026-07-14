'use client'

import { useEffect, useRef, useState } from 'react'

// Hero background video with a "recedes as you scroll" effect — fades,
// scales up slightly, and blurs out as the user scrolls past the hero, so
// it reads as a living backdrop rather than an autoplay wallpaper stuck to
// the viewport.
//
// PLACEHOLDER SCAFFOLDING: this looks for /public/hero-footage.mp4 (and
// optionally /public/hero-footage.webm for broader codec support). Neither
// file exists yet — drop a real montage clip in there (ideally footage from
// an actual RallyPoint meetup, ~15-20s, looped, no audio needed, H.264 mp4,
// compressed under ~5MB for mobile) and it activates automatically. Until
// then, the <video> silently fails via onError and this component renders
// nothing, leaving the existing gradient-blob hero background untouched —
// nothing breaks with no video present.
export default function HeroVideoBackground() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    if (reducedMotion || videoFailed) return
    let ticking = false

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const wrapper = wrapperRef.current
        if (wrapper) {
          const heroHeight = wrapper.parentElement?.offsetHeight ?? window.innerHeight
          const progress = Math.min(Math.max(window.scrollY / heroHeight, 0), 1)
          wrapper.style.opacity = String(1 - progress)
          wrapper.style.transform = `scale(${1 + progress * 0.15}) translateY(${progress * 40}px)`
          wrapper.style.filter = `blur(${progress * 6}px)`
        }
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [reducedMotion, videoFailed])

  if (videoFailed) return null

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"
      style={{ willChange: 'transform, opacity, filter' }}
    >
      <video
        className="w-full h-full object-cover opacity-70"
        autoPlay
        muted
        loop
        playsInline
        poster="/hero-poster.jpg"
        onError={() => setVideoFailed(true)}
      >
        <source src="/hero-footage.webm" type="video/webm" />
        <source src="/hero-footage.mp4" type="video/mp4" />
      </video>
      {/* Warm scrim so hero text stays legible over any footage and the
          video blends into the page's palette instead of looking pasted on. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#fdf6ec]/40 via-[#fdf6ec]/55 to-[#fdf6ec] dark:from-[#15110d]/50 dark:via-[#15110d]/65 dark:to-[#15110d]" />
    </div>
  )
}
