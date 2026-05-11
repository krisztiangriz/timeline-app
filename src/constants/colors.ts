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
