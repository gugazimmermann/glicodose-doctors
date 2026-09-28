// AI clinical review of a linked patient's recent history for doctors.
// Deploy: supabase functions deploy analyze-patient-history
// Requires secret: OPENAI_API_KEY (same as patient-app recommend-insulin)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  carbsFromEntry,
  computeHistoryAiStats,
  type HistoryAiEntry,
} from '../_shared/historyAiMetrics.ts'

const ENTRY_CAP = 120

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
  isf_schedule: unknown
  ic_schedule: unknown
  rapid_insulin_name: string | null
  dose_step: number | null
  insulin_duration_hours: number | null
  basal_insulin_name: string | null
  basal_dose_u: number | null
  basal_times_minutes: unknown
}

function summarizeSchedule(raw: unknown, scalar: number | null): string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return scalar != null ? `00:00–24:00: ${scalar}` : '—'
  }
  const parts: string[] = []
  const sorted = [...raw]
    .map((e) => {
      if (e == null || typeof e !== 'object') return null
      const row = e as Record<string, unknown>
      const start = Number(row.start_minute)
      const value = Number(row.value)
      if (!Number.isFinite(start) || !Number.isFinite(value)) return null
      return { start_minute: Math.round(start), value }
    })
    .filter((x): x is { start_minute: number; value: number } => x != null)
    .sort((a, b) => a.start_minute - b.start_minute)
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]
    const end = i + 1 < sorted.length ? sorted[i + 1].start_minute : 1440
    const sh = String(Math.floor(s.start_minute / 60)).padStart(2, '0')
    const sm = String(s.start_minute % 60).padStart(2, '0')
    const endLabel =
      end >= 1440
        ? '24:00'
        : `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
    parts.push(`${sh}:${sm}–${endLabel}: ${s.value}`)
  }
  return parts.join('; ') || (scalar != null ? String(scalar) : '—')
}

type EntryRow = HistoryAiEntry & {
  id: string
  food_text: string | null
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

function formatClockMinute(raw: number | null, fallback: number): string {
  const source = raw != null && Number.isFinite(raw) ? raw : fallback
  const minute = ((Math.round(source) % 1440) + 1440) % 1440
  const h = String(Math.floor(minute / 60)).padStart(2, '0')
  const min = String(minute % 60).padStart(2, '0')
  return `${h}:${min}`
}

function formatBasalTimes(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return '—'
  const labels = raw
    .map((value) => {
      const n = Number(value)
      if (!Number.isFinite(n)) return null
      const minute = ((Math.round(n) % 1440) + 1440) % 1440
      const h = String(Math.floor(minute / 60)).padStart(2, '0')
      const min = String(minute % 60).padStart(2, '0')
      return `${h}:${min}`
    })
    .filter((label): label is string => label != null)
  return labels.length > 0 ? labels.join(', ') : '—'
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

type Prioridade = {
  titulo: string
  porque: string
  o_que_fazer: string
}

type AnalysisResult = {
  resumo: string
  prioridades: Prioridade[]
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

  const prioridadesRaw = Array.isArray(raw.prioridades) ? raw.prioridades : []
  const achadosRaw = Array.isArray(raw.achados) ? raw.achados : []
  const sugestoesRaw = Array.isArray(raw.sugestoes_prescricao)
    ? raw.sugestoes_prescricao
    : []

  const prioridades = prioridadesRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const titulo = String(o.titulo ?? '').trim()
      if (!titulo) return null
      return {
        titulo,
        porque: String(o.porque ?? '').trim(),
        o_que_fazer: String(o.o_que_fazer ?? '').trim(),
      }
    })
    .filter((x): x is Prioridade => x != null)

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
    prioridades,
    achados,
    sugestoes_prescricao,
    disclaimer:
      String(raw.disclaimer ?? '').trim() ||
      'Sugestões de apoio clínico. Não substituem julgamento médico nem ajustam a prescrição automaticamente.',
  }
}

const emptyAnalysis = (): AnalysisResult => ({
  resumo: 'Não há registros no período selecionado para analisar.',
  prioridades: [],
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
  if (!opts.serviceKey) {
    console.error('ai_usage_logs: SUPABASE_SERVICE_ROLE_KEY missing')
    return
  }
  try {
    const admin = createClient(opts.supabaseUrl, opts.serviceKey)
    const total = opts.promptTokens + opts.completionTokens
    const { error } = await admin.from('ai_usage_logs').insert({
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
    if (error) {
      console.error('ai_usage_logs insert failed:', error.message)
    }
  } catch (err) {
    console.error('ai_usage_logs insert threw:', err)
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
      .select('id, supporter_status')
      .eq('id', user.id)
      .maybeSingle()

    if (doctorError || !doctor) {
      return jsonResponse({ error: 'Médico não encontrado' }, 403)
    }

    const supporterStatus = (doctor as { supporter_status?: string })
      .supporter_status
    if (
      supporterStatus !== 'active' &&
      supporterStatus !== 'grace' &&
      supporterStatus !== 'canceled'
    ) {
      return jsonResponse(
        {
          error:
            'A Análise com IA está disponível para médicos que apoiam o GlicoDose.',
        },
        403,
      )
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
        'id, full_name, diabetes_type, target_glucose_mgdl, target_night_mgdl, night_start_minute, night_end_minute, isf_mgdl_per_u, ic_ratio, isf_schedule, ic_schedule, rapid_insulin_name, dose_step, insulin_duration_hours, basal_insulin_name, basal_dose_u, basal_times_minutes',
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
    const stats = computeHistoryAiStats(entries, profileRow)

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
        fsi_faixas: summarizeSchedule(
          profileRow.isf_schedule,
          profileRow.isf_mgdl_per_u,
        ),
        ic_ratio: profileRow.ic_ratio,
        ic_faixas: summarizeSchedule(
          profileRow.ic_schedule,
          profileRow.ic_ratio,
        ),
        insulina_rapida: profileRow.rapid_insulin_name,
        dose_step: profileRow.dose_step,
        duracao_insulina_h: profileRow.insulin_duration_hours,
        basal: {
          nome: profileRow.basal_insulin_name,
          dose_u: profileRow.basal_dose_u,
          horarios: formatBasalTimes(profileRow.basal_times_minutes),
        },
        janela_noturna: `${formatClockMinute(profileRow.night_start_minute, 1200)}–${formatClockMinute(profileRow.night_end_minute, 359)}`,
      },
      metricas: stats,
      registros: summarizeEntries(entries),
    }

    const systemPrompt = `Você é um assistente de apoio clínico para endocrinologistas/médicos que acompanham pacientes com diabetes usando um app de bolus de insulina rápida.
Analise o histórico (glicemias, refeições, insulina recomendada vs aplicada, parâmetros de prescrição incluindo basal e janela noturna) e entregue um briefing de controle: risco, padrão por faixa horária, basal vs bolus, adesão e o que revisar na consulta.

Cubra os itens abaixo nesta ordem. Omita o item quando os dados não sustentarem; não preencha com generalidades.
1. Segurança: hipoglicemia < 70 mg/dL (metricas.hypoCount / hypoPercent), grave < 54 (metricas.severeHypoCount) e noturna (metricas.night, janela em perfil.janela_noturna). Se houver, hipoglicemia nas horas seguintes a um bolus aplicado.
2. Controle: tempo no intervalo 70–180 (metricas.inRange70_180Percent), acima de 180 (metricas.hyperPercent / hyperCount) e ≥ 250 (metricas.veryHighCount / veryHighPercent), média (metricas.avgGlucose) e CV (metricas.glucoseCvPercent).
3. Alavanca por horário, usando metricas.bands, metricas.day e metricas.night:
   - madrugada e noite: hipótese de basal (dose ou horário em perfil.basal), sem sugerir dose em unidades.
   - subida da madrugada para a manhã: fenômeno do alvorecer, se a média da manhã for claramente maior.
   - almoço, tarde e noite pós-refeição: I:C da faixa correspondente (perfil.ic_faixas) e adequação do bolus da refeição.
4. Adesão: viés de dose (metricas.doseGapPercent, appliedLessCount ≥ 2 U a menos, appliedMoreCount ≥ 2 U a mais), refeição com comida ou carboidrato e sem insulina aplicada, e dias do período sem registro.
5. Refeição → glicemia seguinte: nos registros, ligar food_text, carboidratos_g e dose aplicada à glicemia das 2–4 horas seguintes, quando esse par existir.
6. Empilhamento: boluses aplicados com intervalo menor que perfil.duracao_insulina_h.
7. Tendência: compare a primeira metade dos registros com a segunda (melhora ou piora da glicemia média ou do tempo 70–180).
8. O que não mudar: uma frase quando a amostra for pequena ou a faixa tiver poucos registros.

Limites:
- resumo: 4 a 6 frases com status do controle, risco principal, alavanca principal (basal, I:C de uma faixa, ou adesão) e tendência.
- achados: 3 a 6 itens, só com evidência numérica (números, datas, faixas, basal).
- prioridades: 2 a 4 itens, ordenados do que o médico deve revisar primeiro na consulta.

Regras:
- Responda SOMENTE JSON válido, sem markdown.
- Não prescreva doses absolutas de insulina (nem bolus nem basal, em unidades).
- Linguagem em português do Brasil, objetiva, útil para decidir o acompanhamento.
- Severidade: alta (risco clínico evidente), media, baixa.
- Coeficiente de variação (CV) glicêmico: meta típica < 36%. Só classifique como irregularidade de "alta variabilidade" se CV ≥ 36. Se CV < 36, não emita achado de alta variabilidade (pode citar o CV no resumo como dentro da meta, se útil).
- sugestoes_prescricao: somente FSI, I:C, meta_dia, meta_noite, dose_step, duracao_insulina ou outro parâmetro de prescrição já existente. A observacao deve dizer a direção (subir ou descer a sensibilidade ou as gramas por unidade) e a faixa horária. valor_sugerido só quando o padrão se repetir; nunca uma dose de insulina em U.
- Ignore achados genéricos que não mudem a conduta.

Formato:
{
  "resumo": "4 a 6 frases",
  "prioridades": [
    { "titulo": "o que revisar primeiro", "porque": "evidência numérica", "o_que_fazer": "conduta de acompanhamento, sem dose de insulina" }
  ],
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
    { "parametro": "FSI|I:C|meta_dia|meta_noite|dose_step|duracao_insulina|outro", "observacao": "direção e faixa horária", "valor_sugerido": number_or_null }
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
        max_tokens: 1800,
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
    const row = {
      doctor_id: user.id,
      patient_id: patientId,
      period,
      entry_count: entries.length,
      stats,
      analysis,
    }

    const { data: saved, error: saveError } = await userClient
      .from('patient_ai_analyses')
      .insert(row)
      .select('id')
      .maybeSingle()

    if (!saveError && saved?.id) {
      analysisId = saved.id as string
    } else if (serviceKey) {
      if (saveError) {
        console.error(
          'patient_ai_analyses user insert failed:',
          saveError.message,
        )
      }
      const admin = createClient(supabaseUrl, serviceKey)
      const { data: adminSaved, error: adminError } = await admin
        .from('patient_ai_analyses')
        .insert(row)
        .select('id')
        .maybeSingle()
      if (adminError) {
        console.error(
          'patient_ai_analyses service-role insert failed:',
          adminError.message,
        )
      } else if (adminSaved?.id) {
        analysisId = adminSaved.id as string
      }
    } else if (saveError) {
      console.error(
        'patient_ai_analyses insert failed (no service role):',
        saveError.message,
      )
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
