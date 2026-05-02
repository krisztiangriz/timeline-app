export function parseTicketId(text: string): string | null {
  const match = text.match(/ticket-(\d+)/i)
  return match ? match[1] : null
}
