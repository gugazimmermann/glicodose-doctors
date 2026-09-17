export type HistoryPeriod = 'days7' | 'days30' | 'all'

export const HISTORY_PERIODS: HistoryPeriod[] = ['days7', 'days30', 'all']

export const HISTORY_PERIOD_LABELS: Record<HistoryPeriod, string> = {
  days7: '7 dias',
  days30: '30 dias',
  all: 'Tudo',
}

/** Cutoff date for the period, or null for "all". */
export function historyPeriodSince(
  period: HistoryPeriod,
  now: Date = new Date(),
): Date | null {
  switch (period) {
    case 'days7':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case 'days30':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case 'all':
      return null
  }
}
