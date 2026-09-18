import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoClear } from './useAutoClear'

describe('useAutoClear', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules clear when value is truthy', () => {
    const clear = vi.fn()
    renderHook(() => useAutoClear('erro', clear, 3000))

    expect(clear).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2999)
    expect(clear).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('does not schedule a timer when value is falsy', () => {
    const clear = vi.fn()
    renderHook(() => useAutoClear('', clear, 1000))
    renderHook(() => useAutoClear(null, clear, 1000))
    renderHook(() => useAutoClear(undefined, clear, 1000))

    vi.advanceTimersByTime(10_000)
    expect(clear).not.toHaveBeenCalled()
  })

  it('clears the timeout on unmount', () => {
    const clear = vi.fn()
    const { unmount } = renderHook(() => useAutoClear('msg', clear, 5000))

    unmount()
    vi.advanceTimersByTime(5000)
    expect(clear).not.toHaveBeenCalled()
  })

  it('invokes the latest clear via ref without rescheduling', () => {
    const clear1 = vi.fn()
    const clear2 = vi.fn()
    const { rerender } = renderHook(
      ({ clear, value }: { clear: () => void; value: string }) =>
        useAutoClear(value, clear, 1000),
      { initialProps: { clear: clear1, value: 'a' } },
    )

    rerender({ clear: clear2, value: 'a' })
    vi.advanceTimersByTime(1000)

    expect(clear1).not.toHaveBeenCalled()
    expect(clear2).toHaveBeenCalledTimes(1)
  })
})
