// ---- Color palette for charts ----
export const CHART_COLORS = [
  '#7EB3FF', // pastel blue (primary)
  '#6DD4B1', // pastel green
  '#B497F0', // pastel purple
  '#FFB870', // pastel orange
  '#6CC7CC', // pastel teal
  '#A3B1C2', // pastel grey

  '#6AA3F0', // mid blue
  '#5BC4A0', // mid green
  '#A080E0', // mid purple
  '#F0A050', // mid orange
  '#5AB8BD', // mid teal
  '#8E9DAF', // mid grey

  '#99C8FF', // light blue
  '#88E0C4', // light green
  '#CCAFFF', // light purple
]

export function getColor(index: number, palette: string[]) {
  return palette[index % palette.length]
}

/** Curated palette options for color picking (accessible, ≥3:1 contrast) */
export const PALETTE_OPTIONS = [
  '#4A9AF5', '#3D87E0', '#2E6FC4', '#5BA8FF',
  '#3BB88E', '#2FA37A', '#258A66', '#4CC9A0',
  '#9B7CE0', '#8563CC', '#6E4DB5', '#B08EF0',
  '#E8923B', '#D47E28', '#C06A18', '#F0A050',
  '#3FAFB5', '#339AA0', '#28868C', '#50BFC5',
  '#7B8FA6', '#6B7F96', '#5A6E85', '#8EA2B8',
  '#E07090', '#CC5C7C', '#B84A6A', '#F080A0',
]
