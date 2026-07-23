import { useEffect } from 'react'

// Shared accessibility helper: modal components in this app are conditionally
// mounted by their parent (rather than toggling an internal `open` flag), so
// this just needs to listen for Escape for as long as the component is
// mounted and call the caller's close handler — mirrors the pattern already
// used in WhatsNewModal.
export function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}
