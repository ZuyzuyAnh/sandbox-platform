import useSWR from 'swr'
import { fetchMetrics } from '@/lib/api'
import { Metrics } from '@/types'

export function useMetrics() {
  const { data, error, isLoading } = useSWR<Metrics>(
    'metrics',
    fetchMetrics,
    { refreshInterval: 10000 }
  )
  return {
    metrics: data,
    isLoading,
    isError: !!error,
  }
}
