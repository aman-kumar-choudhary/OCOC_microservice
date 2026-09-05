// Date formatting utilities — always dd/mm/yyyy

/**
 * Returns dd/mm/yyyy from an ISO date string or Date object.
 */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB') // gives dd/mm/yyyy
}

/**
 * Returns dd/mm/yyyy HH:MM from an ISO date string or Date object.
 */
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/**
 * Returns a relative time string like "2 min ago".
 */
export function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return formatDate(iso)
}
