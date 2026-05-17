import useSWR from 'swr'
import { fetchSessions } from '@/lib/api'
import { SessionListResponse } from '@/types'

export function useSessions() {
  const { data, error, isLoading, mutate } = useSWR<SessionListResponse>(
    'sessions',
    fetchSessions,
    { refreshInterval: 10000 }
  )
  return {
    sessions: data?.sessions ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError: !!error,
    mutate,
  }
}
