// Minimal RFC-4180-ish CSV parser — handles quoted fields, escaped quotes
// ("" inside a quoted field), and commas/newlines inside quotes. Good enough
// for Bluebeam's Markups List export without pulling in a dependency.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
      continue;
    }

    if (c === '"') { inQuotes = true; }
    else if (c === ",") { pushField(); }
    else if (c === "\r") { }
    else if (c === "\n") { pushRow(); }
    else { field += c; }
  }
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function parseBluebeamMarkupsCsv(text: string) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const subjectIdx = idx("subject");
  const lengthIdx = idx("length");
  const areaIdx = idx("area");
  const countIdx = idx("count");

  if (subjectIdx === -1) return [];

  return rows.slice(1).map((r) => {
    const rawSubject = (r[subjectIdx] ?? "").trim();
    const subject = rawSubject.replace(/\s*\(\d+\)\s*$/, "").trim();
    const countStr = countIdx !== -1 ? (r[countIdx] ?? "").trim() : "";
    const count = countStr ? parseInt(countStr.replace(/,/g, ""), 10) : null;

    return {
      subject: subject || rawSubject,
      length: lengthIdx !== -1 ? (r[lengthIdx] ?? "").trim() || null : null,
      area: areaIdx !== -1 ? (r[areaIdx] ?? "").trim() || null : null,
      count: Number.isFinite(count) ? count : null,
    };
  }).filter((r) => r.subject);
}
