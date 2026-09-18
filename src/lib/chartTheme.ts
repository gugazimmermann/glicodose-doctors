function cssColor(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim()
  return v || fallback
}

export type ChartColors = {
  brand: string
  accent: string
  muted: string
  line: string
  ok: string
  okSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
}

/** Resolve theme tokens once for Recharts (needs concrete color strings). */
export function resolveChartColors(): ChartColors {
  return {
    brand: cssColor('--color-brand', '#3078e4'),
    accent: cssColor('--color-brand-light', '#4884f0'),
    muted: cssColor('--color-muted', '#5a6478'),
    line: cssColor('--color-line', '#c0cce4'),
    ok: cssColor('--color-ok', '#067647'),
    okSoft: cssColor('--color-ok-soft', '#e8f8ef'),
    warning: cssColor('--color-warning', '#b45309'),
    warningSoft: cssColor('--color-warning-soft', '#fef3c7'),
    danger: cssColor('--color-danger', '#d80000'),
    dangerSoft: cssColor('--color-danger-soft', '#fde8e8'),
  }
}
