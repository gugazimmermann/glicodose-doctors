const brazilFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const brazilDateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatBrazilDateTime(iso: string): string {
  return brazilFmt.format(new Date(iso))
}

export function formatBrazilDate(iso: string): string {
  return brazilDateFmt.format(new Date(iso))
}

/** Calendar day in America/Sao_Paulo as YYYY-MM-DD */
export function toBrazilDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return `${y}-${m}-${day}`
}

export function todayBrazilDateKey(): string {
  return toBrazilDateKey(new Date())
}

/** Shift a YYYY-MM-DD calendar day by `delta` days (timezone-safe via noon UTC). */
export function shiftDateKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  utc.setUTCDate(utc.getUTCDate() + delta)
  const yy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utc.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function formatDose(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function diabetesTypeLabel(type: string | null): string {
  switch (type) {
    case 'type_1':
      return 'Tipo 1'
    case 'type_2':
      return 'Tipo 2'
    case 'other':
      return 'Outro'
    default:
      return 'Não informado'
  }
}
