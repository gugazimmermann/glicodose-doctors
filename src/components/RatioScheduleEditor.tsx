import { Button } from './ui/Button'
import { Input, Label } from './ui/Input'
import {
  MAX_RATIO_SEGMENTS,
  type RatioSegment,
} from '../lib/ratioSchedule'
import { formatMinuteOfDay } from '../lib/timeOfDay'

type Props = {
  idPrefix: string
  label: string
  subtitle: string
  valuePlaceholder: string
  segments: RatioSegment[]
  onChange: (next: RatioSegment[]) => void
}

function emptySegment(startMinute: number): RatioSegment {
  return { start_minute: startMinute, value: 0 }
}

export function RatioScheduleEditor({
  idPrefix,
  label,
  subtitle,
  valuePlaceholder,
  segments,
  onChange,
}: Props) {
  const rows =
    segments.length > 0 ? segments : [emptySegment(0)]

  function updateRow(index: number, patch: Partial<RatioSegment>) {
    const next = rows.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    )
    onChange(next)
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return
    if (rows[index].start_minute === 0) return
    onChange(rows.filter((_, i) => i !== index))
  }

  function addRow() {
    if (rows.length >= MAX_RATIO_SEGMENTS) return
    let start = 12 * 60
    const used = new Set(rows.map((r) => r.start_minute))
    while (used.has(start) && start < 1439) start += 60
    if (used.has(start)) return
    onChange(
      [...rows, emptySegment(start)].sort(
        (a, b) => a.start_minute - b.start_minute,
      ),
    )
  }

  return (
    <div className="min-w-0 sm:col-span-2 lg:col-span-2">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
      <div className="mt-2 space-y-2">
        {rows.map((row, index) => {
          const isMidnight = row.start_minute === 0
          return (
            <div
              key={`${idPrefix}-${index}-${isMidnight ? '0' : row.start_minute}`}
              className="flex flex-wrap items-end gap-2"
            >
              <div className="w-[7.5rem]">
                <Label
                  htmlFor={`${idPrefix}-start-${index}`}
                  density="stacked"
                  subtitle="Início"
                >
                  Horário
                </Label>
                <Input
                  id={`${idPrefix}-start-${index}`}
                  type="time"
                  value={formatMinuteOfDay(row.start_minute)}
                  disabled={isMidnight}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number)
                    if (!Number.isFinite(h) || !Number.isFinite(m)) return
                    const minute = h * 60 + m
                    if (minute === 0 && !isMidnight) return
                    updateRow(index, { start_minute: minute })
                  }}
                  className="mt-1 font-semibold"
                  required
                />
              </div>
              <div className="min-w-[8rem] flex-1">
                <Label
                  htmlFor={`${idPrefix}-value-${index}`}
                  density="stacked"
                  subtitle={valuePlaceholder}
                >
                  {isMidnight ? label : `${label} ${formatMinuteOfDay(row.start_minute)}`}
                </Label>
                <Input
                  id={`${idPrefix}-value-${index}`}
                  type="number"
                  min={0.1}
                  step="any"
                  value={row.value > 0 ? String(row.value) : ''}
                  aria-label={
                    isMidnight
                      ? label
                      : `${label} ${formatMinuteOfDay(row.start_minute)}`
                  }
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(',', '.'))
                    updateRow(index, {
                      value: Number.isFinite(n) ? n : 0,
                    })
                  }}
                  className="mt-1 font-semibold"
                  required
                />
              </div>
              {!isMidnight ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(index)}
                  aria-label="Remover faixa"
                >
                  Remover
                </Button>
              ) : null}
            </div>
          )
        })}
        {rows.length < MAX_RATIO_SEGMENTS ? (
          <Button type="button" variant="secondary" size="sm" onClick={addRow}>
            Adicionar faixa
          </Button>
        ) : null}
      </div>
    </div>
  )
}
