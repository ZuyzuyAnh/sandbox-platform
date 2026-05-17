import useSWR from 'swr'
import { fetchPool } from '@/lib/api'
import { PoolResponse } from '@/types'

export function usePool() {
  const { data, error, isLoading } = useSWR<PoolResponse>(
    'pool',
    fetchPool,
    { refreshInterval: 3000 }
  )
  return {
    pool: data,
    isLoading,
    isError: !!error,
  }
}
