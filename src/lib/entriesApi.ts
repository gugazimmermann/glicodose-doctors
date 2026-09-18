import { supabase } from './supabase'
import {
  historyPeriodSince,
  type HistoryPeriod,
} from './historyPeriod'
import type { Entry } from '../types/database'

export type FetchPatientEntriesOptions =
  | {
      mode: 'page'
      page: number
      pageSize?: number
      sort: 'newest' | 'oldest'
    }
  | {
      mode: 'series'
      period: HistoryPeriod
      allLimit?: number
    }

export type FetchPatientEntriesResult = {
  entries: Entry[]
  /** Exact count only for mode: 'page'; otherwise null. */
  total: number | null
}

const DEFAULT_PAGE_SIZE = 50
const DEFAULT_ALL_LIMIT = 200

export async function fetchPatientEntries(
  patientId: string,
  options: FetchPatientEntriesOptions,
): Promise<FetchPatientEntriesResult> {
  if (options.mode === 'page') {
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
    const from = options.page * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('entries')
      .select('*', { count: 'exact' })
      .eq('user_id', patientId)
      .order('recorded_at', { ascending: options.sort === 'oldest' })
      .range(from, to)

    if (error) throw error

    return {
      entries: (data ?? []) as Entry[],
      total: count ?? 0,
    }
  }

  const allLimit = options.allLimit ?? DEFAULT_ALL_LIMIT
  const since = historyPeriodSince(options.period)
  let query = supabase
    .from('entries')
    .select('*')
    .eq('user_id', patientId)
    .order('recorded_at', { ascending: true })

  if (since) {
    query = query.gte('recorded_at', since.toISOString())
  } else {
    query = query.limit(allLimit)
  }

  const { data, error } = await query
  if (error) throw error

  return {
    entries: (data ?? []) as Entry[],
    total: null,
  }
}
