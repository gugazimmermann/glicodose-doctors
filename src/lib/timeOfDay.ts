/** Minutes from midnight → "HH:MM" */
export function formatMinuteOfDay(minute: number): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** "HH:MM" or "H:MM" → minutes from midnight */
export function parseMinuteOfDay(value: string): number {
  const trimmed = value.trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (!match) {
    throw new Error('Horário inválido. Use HH:MM (ex.: 20:00).')
  }
  const h = Number(match[1])
  const min = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) {
    throw new Error('Horário inválido. Use HH:MM (ex.: 20:00).')
  }
  return h * 60 + min
}
