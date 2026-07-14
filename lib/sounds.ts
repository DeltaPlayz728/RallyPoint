// Lightweight sound-cue engine — synthesized with the Web Audio API rather
// than shipped .mp3/.wav assets, so there's nothing to license, host, or
// keep in sync with the design system, and the whole thing is a few KB of
// code instead of audio files. Three short, distinct tones:
//   message      — a quick two-note blip (new chat message)
//   notification — a soft single chime (generic notification)
//   join         — a brighter ascending two-note (someone joined your event)
//
// Respects a user-level on/off toggle stored in localStorage (see
// isSoundEnabled/setSoundEnabled, surfaced in Settings → Notifications).
// Browsers block audio before any user gesture on the page — that's fine
// here, since by the time a realtime event fires the user has already
// clicked/tapped something, so the AudioContext is unlocked.

const STORAGE_KEY = 'rp_sound_cues_enabled'

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const Ctor = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  return ctx
}

function tone(freq: number, startOffset: number, duration: number, volume: number) {
  const audioCtx = getContext()
  if (!audioCtx) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const start = audioCtx.currentTime + startOffset
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === null ? true : stored === 'true'
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, String(enabled))
}

function play(fn: () => void) {
  if (!isSoundEnabled()) return
  try { fn() } catch { /* audio is best-effort — never let it throw into a caller */ }
}

export function playMessageSound() {
  play(() => {
    tone(720, 0, 0.09, 0.05)
    tone(880, 0.07, 0.11, 0.05)
  })
}

export function playNotificationSound() {
  play(() => {
    tone(660, 0, 0.16, 0.045)
  })
}

export function playJoinSound() {
  play(() => {
    tone(600, 0, 0.09, 0.05)
    tone(900, 0.08, 0.14, 0.055)
  })
}
