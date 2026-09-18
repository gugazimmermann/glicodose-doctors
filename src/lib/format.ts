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

const brazilDayMonthFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
})

export function formatBrazilDateTime(iso: string): string {
  return brazilFmt.format(new Date(iso))
}

export function formatBrazilDate(iso: string): string {
  return brazilDateFmt.format(new Date(iso))
}

export function formatBrazilDayMonth(iso: string): string {
  return brazilDayMonthFmt.format(new Date(iso))
}

export function formatDose(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** Like formatDose, with a unit suffix; null stays as em dash without unit. */
export function formatDoseWithUnit(
  value: number | null | undefined,
  unit: string,
): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${formatDose(value)}${unit}`
}

export function formatU(value: number | null | undefined): string {
  return formatDoseWithUnit(value, ' U')
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
