// AI clinical review of a linked patient's recent history for doctors.
// Deploy: supabase functions deploy analyze-patient-history
// Requires secret: OPENAI_API_KEY (same as patient-app recommend-insulin)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const ENTRY_CAP = 120
const CLINICAL_LOW = 70
const CLINICAL_HIGH = 180
const TARGET_TOLERANCE = 0.2

type Period = 'days7' | 'days30' | 'all'

type ProfileRow = {
  id: string
  full_name: string | null
  diabetes_type: string | null
  target_glucose_mgdl: number | null
  target_night_mgdl: number | null
  night_start_minute: number | null
  night_end_minute: number | null
  isf_mgdl_per_u: number | null
  ic_ratio: number | null
  rapid_insulin_name: string | null
  dose_step: number | null
  insulin_duration_hours: number | null
}

type EntryRow = {
  id: string
  recorded_at: string
  glucose_mgdl: number
  food_text: string | null
  recommended_insulin: number | null
  applied_insulin: number | null
  gpt_raw_response: unknown
}

type HistoryStats = {
  count: number
  avgGlucose: number | null
  minGlucose: number | null
  maxGlucose: number | null
  glucoseSd: number | null
  glucoseCvPercent: number | null
  inRange70_180Percent: number | null
  hypoPercent: number | null
  hypoCount: number
  hyperPercent: number | null
  hyperCount: number
  inTargetPercent: number | null
  avgAppliedU: number | null
  avgRecommendedU: number | null
  avgDoseDeltaU: number | null
  avgCarbsG: number | null
}

function periodSince(period: Period, now = new Date()): Date | null {
  switch (period) {
    case 'days7':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case 'days30':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case 'all':
      return null
  }
}

function isNightWindow(
  minuteOfDay: number,
  nightStart: number,
  nightEnd: number,
): boolean {
  if (nightStart === nightEnd) return false
  if (nightStart < nightEnd) {
    return minuteOfDay >= nightStart && minuteOfDay <= nightEnd
  }
  return minuteOfDay >= nightStart || minuteOfDay <= nightEnd
}

function brazilMinuteOfDay(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const h = hour === 24 ? 0 : hour
  return h * 60 + minute
}

function resolveTarget(profile: ProfileRow, recordedAt: string): number {
  const night = isNightWindow(
    brazilMinuteOfDay(recordedAt),
    Number(profile.night_start_minute ?? 1200),
    Number(profile.night_end_minute ?? 359),
  )
  const day = profile.target_glucose_mgdl ?? 110
  const nightTarget = profile.target_night_mgdl ?? day
  return night ? nightTarget : day
}

function isInTarget(glucose: number, target: number): boolean {
  const lo = target * (1 - TARGET_TOLERANCE)
  const hi = target * (1 + TARGET_TOLERANCE)
  return glucose >= lo && glucose <= hi
}

function carbsFromEntry(entry: EntryRow): number | null {
  const raw = entry.gpt_raw_response
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = (raw as Record<string, unknown>).carboidratos_g
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function sampleSd(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  let sumSq = 0
  for (const v of values) {
    const d = v - mean
    sumSq += d * d
  }
  return Math.sqrt(sumSq / (values.length - 1))
}

function round1(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null
  return Math.round(n * 10) / 10
}

function emptyStats(): HistoryStats {
  return {
    count: 0,
    avgGlucose: null,
    minGlucose: null,
    maxGlucose: null,
    glucoseSd: null,
    glucoseCvPercent: null,
    inRange70_180Percent: null,
    hypoPercent: null,
    hypoCount: 0,
    hyperPercent: null,
    hyperCount: 0,
    inTargetPercent: null,
    avgAppliedU: null,
    avgRecommendedU: null,
    avgDoseDeltaU: null,
    avgCarbsG: null,
  }
}

function computeStats(entries: EntryRow[], profile: ProfileRow): HistoryStats {
  if (entries.length === 0) return emptyStats()

  let glucoseSum = 0
  let minG = entries[0].glucose_mgdl
  let maxG = entries[0].glucose_mgdl
  let inTarget = 0
  let inRange = 0
  let hypo = 0
  let hyper = 0
  let appliedSum = 0
  let appliedN = 0
  let recommendedSum = 0
  let recommendedN = 0
  let deltaSum = 0
  let deltaN = 0
  let carbsSum = 0
  let carbsN = 0
  const glucoseValues: number[] = []

  for (const e of entries) {
    const g = e.glucose_mgdl
    glucoseValues.push(g)
    glucoseSum += g
    if (g < minG) minG = g
    if (g > maxG) maxG = g
    if (g < CLINICAL_LOW) hypo++
    else if (g > CLINICAL_HIGH) hyper++
    else inRange++
    if (isInTarget(g, resolveTarget(profile, e.recorded_at))) inTarget++
    if (e.applied_insulin != null) {
      appliedSum += e.applied_insulin
      appliedN++
    }
    if (e.recommended_insulin != null) {
      recommendedSum += e.recommended_insulin
      recommendedN++
    }
    if (e.applied_insulin != null && e.recommended_insulin != null) {
      deltaSum += e.recommended_insulin - e.applied_insulin
      deltaN++
    }
    const carbs = carbsFromEntry(e)
    if (carbs != null) {
      carbsSum += carbs
      carbsN++
    }
  }

  const n = entries.length
  const avgGlucose = glucoseSum / n
  const sd = sampleSd(glucoseValues)
  const cv = sd != null && avgGlucose > 0 ? (sd / avgGlucose) * 100 : null

  return {
    count: n,
    avgGlucose: round1(avgGlucose),
    minGlucose: minG,
    maxGlucose: maxG,
    glucoseSd: round1(sd),
    glucoseCvPercent: round1(cv),
    inRange70_180Percent: round1((inRange / n) * 100),
    hypoPercent: round1((hypo / n) * 100),
    hypoCount: hypo,
    hyperPercent: round1((hyper / n) * 100),
    hyperCount: hyper,
    inTargetPercent: round1((inTarget / n) * 100),
    avgAppliedU: round1(appliedN === 0 ? null : appliedSum / appliedN),
    avgRecommendedU: round1(
      recommendedN === 0 ? null : recommendedSum / recommendedN,
    ),
    avgDoseDeltaU: round1(deltaN === 0 ? null : deltaSum / deltaN),
    avgCarbsG: round1(carbsN === 0 ? null : carbsSum / carbsN),
  }
}

function diabetesLabel(type: string | null): string {
  switch (type) {
    case 'type_1':
      return 'tipo 1'
    case 'type_2':
      return 'tipo 2'
    case 'other':
      return 'outro'
    default:
      return type ?? 'não informado'
  }
}

function summarizeEntries(entries: EntryRow[]) {
  return entries.map((e) => {
    const carbs = carbsFromEntry(e)
    return {
      recorded_at: e.recorded_at,
      glucose_mgdl: e.glucose_mgdl,
      food_text: e.food_text?.trim()?.slice(0, 120) || null,
      recommended_insulin: e.recommended_insulin,
      applied_insulin: e.applied_insulin,
      carboidratos_g: carbs,
      dose_delta_u:
        e.recommended_insulin != null && e.applied_insulin != null
          ? Math.round((e.recommended_insulin - e.applied_insulin) * 10) / 10
          : null,
    }
  })
}

type AchadoTipo = 'discrepancia' | 'irregularidade' | 'melhoria' | 'ajuste'
type Severidade = 'alta' | 'media' | 'baixa'

type AnalysisResult = {
  resumo: string
  achados: Array<{
    tipo: AchadoTipo
    severidade: Severidade
    titulo: string
    detalhe: string
    evidencia: string
  }>
  sugestoes_prescricao: Array<{
    parametro: string
    observacao: string
    valor_sugerido: number | null
  }>
  disclaimer: string
}

function normalizeAnalysis(raw: Record<string, unknown>): AnalysisResult {
  const tipos = new Set(['discrepancia', 'irregularidade', 'melhoria', 'ajuste'])
  const sevs = new Set(['alta', 'media', 'baixa'])

  const achadosRaw = Array.isArray(raw.achados) ? raw.achados : []
  const sugestoesRaw = Array.isArray(raw.sugestoes_prescricao)
    ? raw.sugestoes_prescricao
    : []

  const achados = achadosRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const tipo = String(o.tipo ?? '')
      const severidade = String(o.severidade ?? 'media')
      if (!tipos.has(tipo)) return null
      return {
        tipo: tipo as AchadoTipo,
        severidade: (sevs.has(severidade) ? severidade : 'media') as Severidade,
        titulo: String(o.titulo ?? '').trim() || 'Achado',
        detalhe: String(o.detalhe ?? '').trim() || '',
        evidencia: String(o.evidencia ?? '').trim() || '',
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  const sugestoes_prescricao = sugestoesRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const parametro = String(o.parametro ?? '').trim()
      const observacao = String(o.observacao ?? '').trim()
      if (!parametro && !observacao) return null
      const rawValor = o.valor_sugerido
      let valor_sugerido: number | null = null
      if (rawValor != null && rawValor !== '') {
        const n = Number(rawValor)
        if (Number.isFinite(n) && n > 0) valor_sugerido = n
      }
      return { parametro: parametro || 'outro', observacao, valor_sugerido }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  return {
    resumo: String(raw.resumo ?? '').trim() || 'Análise concluída.',
    achados,
    sugestoes_prescricao,
    disclaimer:
      String(raw.disclaimer ?? '').trim() ||
      'Sugestões de apoio clínico. Não substituem julgamento médico nem ajustam a prescrição automaticamente.',
  }
}

const emptyAnalysis = (): AnalysisResult => ({
  resumo: 'Não há registros no período selecionado para analisar.',
  achados: [],
  sugestoes_prescricao: [],
  disclaimer:
    'Sugestões de apoio clínico. Não substituem julgamento médico.',
})

const GPT4O_INPUT_PER_M = 2.5
const GPT4O_OUTPUT_PER_M = 10

function estimateCostUsd(promptTokens: number, completionTokens: number) {
  return (
    (promptTokens / 1_000_000) * GPT4O_INPUT_PER_M +
    (completionTokens / 1_000_000) * GPT4O_OUTPUT_PER_M
  )
}

async function logAiUsage(opts: {
  supabaseUrl: string
  serviceKey: string | undefined
  userId: string
  model: string
  promptTokens: number
  completionTokens: number
  latencyMs: number
  success: boolean
  errorMessage?: string
  meta?: Record<string, unknown>
}) {
  if (!opts.serviceKey) return
  try {
    const admin = createClient(opts.supabaseUrl, opts.serviceKey)
    const total = opts.promptTokens + opts.completionTokens
    await admin.from('ai_usage_logs').insert({
      function_name: 'analyze-patient-history',
      user_id: opts.userId,
      model: opts.model,
      prompt_tokens: opts.promptTokens,
      completion_tokens: opts.completionTokens,
      total_tokens: total,
      latency_ms: opts.latencyMs,
      success: opts.success,
      error_message: opts.errorMessage ?? null,
      estimated_cost_usd: estimateCostUsd(
        opts.promptTokens,
        opts.completionTokens,
      ),
      meta: opts.meta ?? {},
    })
  } catch {
    // ignore
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return jsonResponse({ error: 'OPENAI_API_KEY não configurada' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body = (await req.json()) as {
      patientId?: string
      period?: string
    }

    const patientId = body.patientId?.trim()
    if (!patientId) {
      return jsonResponse({ error: 'patientId é obrigatório' }, 400)
    }

    const period: Period =
      body.period === 'days7' || body.period === 'all'
        ? body.period
        : 'days30'

    const { data: doctor, error: doctorError } = await userClient
      .from('doctors')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (doctorError || !doctor) {
      return jsonResponse({ error: 'Médico não encontrado' }, 403)
    }

    const { data: link, error: linkError } = await userClient
      .from('doctor_patients')
      .select('patient_id')
      .eq('doctor_id', user.id)
      .eq('patient_id', patientId)
      .maybeSingle()

    if (linkError || !link) {
      return jsonResponse({ error: 'Paciente não vinculado a este médico' }, 403)
    }

    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select(
        'id, full_name, diabetes_type, target_glucose_mgdl, target_night_mgdl, night_start_minute, night_end_minute, isf_mgdl_per_u, ic_ratio, rapid_insulin_name, dose_step, insulin_duration_hours',
      )
      .eq('id', patientId)
      .maybeSingle()

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500)
    }
    if (!profile) {
      return jsonResponse({ error: 'Perfil do paciente não encontrado' }, 404)
    }

    const profileRow = profile as ProfileRow
    const since = periodSince(period)

    let entriesQuery = userClient
      .from('entries')
      .select(
        'id, recorded_at, glucose_mgdl, food_text, recommended_insulin, applied_insulin, gpt_raw_response',
      )
      .eq('user_id', patientId)
      .order('recorded_at', { ascending: false })
      .limit(ENTRY_CAP)

    if (since) {
      entriesQuery = entriesQuery.gte('recorded_at', since.toISOString())
    }

    const { data: entriesData, error: entriesError } = await entriesQuery
    if (entriesError) {
      return jsonResponse({ error: entriesError.message }, 500)
    }

    const entries = ((entriesData ?? []) as EntryRow[]).slice().reverse()
    const stats = computeStats(entries, profileRow)

    if (entries.length === 0) {
      return jsonResponse({
        period,
        entryCount: 0,
        stats,
        analysis: emptyAnalysis(),
      })
    }

    const periodLabel =
      period === 'days7' ? '7 dias' : period === 'days30' ? '30 dias' : 'tudo'

    const payload = {
      periodo: periodLabel,
      perfil: {
        diabetes: diabetesLabel(profileRow.diabetes_type),
        meta_dia_mgdl: profileRow.target_glucose_mgdl,
        meta_noite_mgdl: profileRow.target_night_mgdl,
        fsi_mgdl_por_u: profileRow.isf_mgdl_per_u,
        ic_ratio: profileRow.ic_ratio,
        insulina_rapida: profileRow.rapid_insulin_name,
        dose_step: profileRow.dose_step,
        duracao_insulina_h: profileRow.insulin_duration_hours,
      },
      metricas: stats,
      registros: summarizeEntries(entries),
    }

    const systemPrompt = `Você é um assistente de apoio clínico para endocrinologistas/médicos que acompanham pacientes com diabetes usando um app de bolus de insulina rápida.
Analise o histórico (glicemias, refeições, insulina recomendada vs aplicada, parâmetros de prescrição) e identifique:
- discrepâncias (ex.: dose aplicada ≠ recomendada de forma recorrente)
- irregularidades (hipos/hipers, alta variabilidade, padrões horários)
- possíveis melhorias de adesão ou registro
- ajustes possíveis de parâmetros (FSI, I:C, meta dia/noite) — apenas como hipóteses para o médico revisar

Regras:
- Responda SOMENTE JSON válido, sem markdown.
- Não prescreva doses absolutas de insulina.
- Seja específico e cite evidências dos dados (números, datas, padrões).
- Linguagem em português do Brasil, objetiva.
- Severidade: alta (risco clínico evidente), media, baixa.

Formato:
{
  "resumo": "string curta",
  "achados": [
    {
      "tipo": "discrepancia|irregularidade|melhoria|ajuste",
      "severidade": "alta|media|baixa",
      "titulo": "string",
      "detalhe": "string",
      "evidencia": "string com dados"
    }
  ],
  "sugestoes_prescricao": [
    { "parametro": "FSI|I:C|meta_dia|meta_noite|dose_step|duracao_insulina|outro", "observacao": "string", "valor_sugerido": number_or_null }
  ],
  "disclaimer": "string curta lembrando que é apoio clínico"
}`

    const model = 'gpt-4o'
    const startedAt = Date.now()
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Dados do paciente (JSON):\n${JSON.stringify(payload)}`,
          },
        ],
      }),
    })

    const latencyMs = Date.now() - startedAt
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      await logAiUsage({
        supabaseUrl,
        serviceKey,
        userId: user.id,
        model,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs,
        success: false,
        errorMessage: errText.slice(0, 500),
        meta: { patientId, period },
      })
      return jsonResponse({ error: `OpenAI: ${errText}` }, 502)
    }

    const openaiJson = await openaiRes.json()
    const usage = openaiJson.usage ?? {}
    const promptTokens = Number(usage.prompt_tokens) || 0
    const completionTokens = Number(usage.completion_tokens) || 0

    const rawContent = openaiJson.choices?.[0]?.message?.content
    if (!rawContent || typeof rawContent !== 'string') {
      await logAiUsage({
        supabaseUrl,
        serviceKey,
        userId: user.id,
        model,
        promptTokens,
        completionTokens,
        latencyMs,
        success: false,
        errorMessage: 'empty response',
        meta: { patientId, period },
      })
      return jsonResponse({ error: 'Resposta vazia da OpenAI' }, 502)
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      await logAiUsage({
        supabaseUrl,
        serviceKey,
        userId: user.id,
        model,
        promptTokens,
        completionTokens,
        latencyMs,
        success: false,
        errorMessage: 'invalid json',
        meta: { patientId, period },
      })
      return jsonResponse({ error: 'JSON inválido da OpenAI' }, 502)
    }

    const analysis = normalizeAnalysis(parsed)

    await logAiUsage({
      supabaseUrl,
      serviceKey,
      userId: user.id,
      model,
      promptTokens,
      completionTokens,
      latencyMs,
      success: true,
      meta: { patientId, period, entryCount: entries.length },
    })

    let analysisId: string | null = null
    const { data: saved, error: saveError } = await userClient
      .from('patient_ai_analyses')
      .insert({
        doctor_id: user.id,
        patient_id: patientId,
        period,
        entry_count: entries.length,
        stats,
        analysis,
      })
      .select('id')
      .maybeSingle()

    if (!saveError && saved?.id) {
      analysisId = saved.id as string
    }

    return jsonResponse({
      period,
      entryCount: entries.length,
      stats,
      analysis,
      analysisId,
    })
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500)
  }
})
