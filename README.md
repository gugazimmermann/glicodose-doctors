# GlicoDose Médicos

Portal web para médicos acompanharem o histórico de pacientes do app GlicoDose.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Supabase (mesmo projeto do app Flutter em `/diabetes`)

## Setup

```bash
cp .env.example .env
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
# (os mesmos valores de SUPABASE_URL / SUPABASE_ANON_KEY do app paciente)

npm install
npm run dev
```

## Fluxo

1. Médico cria conta (e-mail, senha, nome) ou faz login
2. Digita o código de 6 caracteres do perfil do paciente no app
3. Acompanha o histórico (glicemia, comida, insulina) em modo leitura
