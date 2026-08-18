// ============================================================
// WAYTERO ADMIN — REPORT CSV EXPORT
// Builds a CSV from the rows currently loaded in a report tab
// and triggers a browser download.
// ============================================================

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  // Prefixing formula-leading characters stops spreadsheets treating a cell as a formula.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  const head = columns.map(c => escapeCell(c.header)).join(",");
  const body = rows.map(r => columns.map(c => escapeCell(c.value(r))).join(","));
  const csv = "﻿" + [head, ...body].join("\r\n");

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
