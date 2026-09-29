import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDoctor } from '../test/fixtures'

const invokeMock = vi.fn()
vi.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}))

import {
  formatDoctorCrm,
  sendDoctorContactMessage,
} from './contactApi'

describe('formatDoctorCrm', () => {
  it('joins CRM and UF', () => {
    expect(formatDoctorCrm(makeDoctor())).toBe('123456/SP')
  })

  it('returns CRM alone when UF is missing', () => {
    expect(formatDoctorCrm(makeDoctor({ crm_uf: null }))).toBe('123456')
  })

  it('returns UF alone when CRM is missing', () => {
    expect(formatDoctorCrm(makeDoctor({ crm: '  ', crm_uf: 'RJ' }))).toBe('RJ')
  })

  it('returns undefined when both are empty or the profile is missing', () => {
    expect(formatDoctorCrm(makeDoctor({ crm: null, crm_uf: '  ' }))).toBeUndefined()
    expect(formatDoctorCrm(null)).toBeUndefined()
  })
})

describe('sendDoctorContactMessage', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('invokes send-contact with the doctor portal source', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null })

    await sendDoctorContactMessage({
      name: 'Dr. Teste',
      email: 'doc@test.com',
      category: 'Sugestão',
      message: 'Um atalho no histórico.',
      crm: '123456/SP',
    })

    expect(invokeMock).toHaveBeenCalledWith('send-contact', {
      body: {
        source: 'medicos',
        name: 'Dr. Teste',
        email: 'doc@test.com',
        category: 'Sugestão',
        message: 'Um atalho no histórico.',
        crm: '123456/SP',
      },
    })
  })

  it('sends an empty CRM when the profile has none', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null })

    await sendDoctorContactMessage({
      name: 'Dr. Teste',
      email: 'doc@test.com',
      category: 'Dúvida',
      message: 'Como vincular?',
    })

    expect(invokeMock).toHaveBeenCalledWith(
      'send-contact',
      expect.objectContaining({
        body: expect.objectContaining({ crm: '' }),
      }),
    )
  })

  it('throws the function error message', async () => {
    invokeMock.mockResolvedValue({
      data: { error: 'Tipo de mensagem inválido.' },
      error: null,
    })

    await expect(
      sendDoctorContactMessage({
        name: 'Dr. Teste',
        email: 'doc@test.com',
        category: 'Outro',
        message: 'Oi',
      }),
    ).rejects.toThrow('Tipo de mensagem inválido.')
  })

  it('throws the invoke error', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: new Error('network'),
    })

    await expect(
      sendDoctorContactMessage({
        name: 'Dr. Teste',
        email: 'doc@test.com',
        category: 'Reclamação',
        message: 'Falhou',
      }),
    ).rejects.toThrow('network')
  })
})
