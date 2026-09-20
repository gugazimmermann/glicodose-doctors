# GlicoDose Médicos

Portal web para médicos acompanharem pacientes do app GlicoDose: vínculo por código, histórico, gráficos, alertas clínicos, edição de prescrição e Análise com IA.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Supabase (mesmo projeto do app Flutter em `/diabetes`)
- OpenAI via Edge Function `analyze-patient-history`
- Stripe (assinatura opcional “Apoiar”)

## Funcionalidades

- Conta do profissional + perfil (CRM/UF, clínica, etc.)
- Vincular / desvincular paciente por código de 6 caracteres
- **Prescrição editável:** meta dia/noite, FSI, I:C, insulina, passo da dose, duração IOB, janela noturna
- Audit trail de alterações (`prescription_change_log` — migration 012)
- Histórico paginado + fotos de refeição (URL assinada)
- Gráficos e estatísticas do período
- **Alertas clínicos** determinísticos (hipos em sequência, gap recomendada vs aplicada, CV alto) — sem LLM
- **Análise com IA:** achados + sugestões com valor; botão **Aplicar** na prescrição; análises salvas para revisitar
- Apoiar (Stripe)

## Setup

```bash
cp .env.example .env
# VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (iguais ao app paciente)

npm install
npm run dev
```

Migrations de schema ficam em `/diabetes/supabase/migrations` (inclua até `012_rx_ai_ops.sql`).

## Fluxo

1. Criar conta e completar perfil profissional
2. Digitar o código do paciente
3. Revisar alertas, histórico e gráficos
4. Ajustar prescrição usada no app do paciente
5. Opcionalmente: Análise com IA → aplicar sugestões com confirmação

## Edge Functions

Ver [`supabase/README.md`](supabase/README.md) (Stripe + `analyze-patient-history`).

```bash
# No projeto Supabase linkado (mesmo do app paciente):
supabase secrets set OPENAI_API_KEY=sk-sua-chave
supabase functions deploy analyze-patient-history
```

A função persiste em `patient_ai_analyses` e registra uso em `ai_usage_logs` (migration 012).

## Testes

```bash
npm test
```

## Projetos irmãos

| Repo | Papel |
| --- | --- |
| `diabetes` (Flutter) | App do paciente — dono das migrations |
| `diabetes-admin` | Ops: KPIs, doações, métricas de IA |
| `diabetes-site` | Marketing |
