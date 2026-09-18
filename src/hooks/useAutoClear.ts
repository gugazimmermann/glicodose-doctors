import { useEffect, useRef } from 'react'

/** Clears `value` via `clear` after `ms` when value is truthy. */
export function useAutoClear(
  value: string | null | undefined,
  clear: () => void,
  ms: number,
): void {
  const clearRef = useRef(clear)
  clearRef.current = clear

  useEffect(() => {
    if (!value) return
    const t = window.setTimeout(() => clearRef.current(), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
}
