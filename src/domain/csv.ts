/**
 * Escape a single CSV cell. Values that a spreadsheet would treat as a formula
 * (starting with = + - @ or a tab/CR) are prefixed with an apostrophe so they
 * open as text. The cell is quoted when it contains delimiters or quotes.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  // Plain numbers (including negatives) stay numeric; anything else that a
  // spreadsheet could read as a formula is prefixed with an apostrophe.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
