"use client";

import { useMemo, useState } from "react";

type Extracted = {
  sheetNumber: string | null;
  revision: string | null;
  sheetTitle: string | null;
  titleBlockText: string[];
  fullText: string[];
  pageWidth: number;
  pageHeight: number;
};

type TextToken = { text: string; x: number; y: number };

const PDF_WORKER_SRC = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

function normalizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function groupLines(tokens: TextToken[]) {
  const sorted = [...tokens].sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);
  const lines: Array<{ y: number; tokens: TextToken[] }> = [];
  for (const token of sorted) {
    const line = lines.find((row) => Math.abs(row.y - token.y) <= 3);
    if (line) line.tokens.push(token);
    else lines.push({ y: token.y, tokens: [token] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((row) => normalizeLine(row.tokens.sort((a, b) => a.x - b.x).map((token) => token.text).join(" ")))
    .filter(Boolean);
}

function infer(lines: string[]) {
  const joined = lines.join("\n");
  const labeledSheet = joined.match(/(?:SHEET|DRAWING|DWG)\s*(?:NO\.?|NUMBER|#)?\s*[:.-]?\s*([A-Z]{1,4}[-.]?\d{1,4}(?:\.\d+)?)/i)?.[1] ?? null;
  const genericSheet = lines.flatMap((line) => line.match(/\b[A-Z]{1,4}[-.]?\d{1,4}(?:\.\d+)?\b/g) ?? [])[0] ?? null;
  const revision = joined.match(/(?:REV(?:ISION)?|ISSUE)\s*(?:NO\.?|#)?\s*[:.-]?\s*([A-Z0-9.-]{1,10})/i)?.[1] ?? null;
  const titleCandidates = lines
    .map(normalizeLine)
    .filter((line) => line.length >= 8 && line.length <= 90)
    .filter((line) => !/^(sheet|drawing|dwg|rev|revision|date|scale|project|job|checked|drawn|approved)\b/i.test(line))
    .filter((line) => !/^\d+[\s./-]/.test(line))
    .sort((a, b) => b.length - a.length);
  return { sheetNumber: labeledSheet ?? genericSheet, revision, sheetTitle: titleCandidates[0] ?? null };
}

export default function PdfTextInspector({ url, pageNumber }: { url: string | null; pageNumber: number }) {
  const [result, setResult] = useState<Extracted | null>(null);
  const [state, setState] = useState<"IDLE" | "LOADING" | "READY" | "ERROR">("IDLE");
  const [error, setError] = useState<string | null>(null);
  const candidates = useMemo(() => result ? [result.sheetNumber, result.revision, result.sheetTitle].filter(Boolean).length : 0, [result]);

  async function extract() {
    if (!url) return;
    setState("LOADING");
    setError(null);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
      const task = pdfjs.getDocument({ url });
      const pdf = await task.promise;
      const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), pdf.numPages));
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const tokens: TextToken[] = content.items.flatMap((item) => {
        if (!("str" in item) || typeof item.str !== "string" || !item.str.trim()) return [];
        const transform = "transform" in item && Array.isArray(item.transform) ? item.transform : null;
        if (!transform || transform.length < 6) return [];
        return [{ text: item.str.trim(), x: Number(transform[4]) || 0, y: Number(transform[5]) || 0 }];
      });
      const fullText = groupLines(tokens);
      const titleBlockTokens = tokens.filter((token) => token.x >= viewport.width * 0.45 && token.y <= viewport.height * 0.38);
      const titleBlockText = groupLines(titleBlockTokens);
      const inferred = infer(titleBlockText.length ? titleBlockText : fullText);
      setResult({ ...inferred, titleBlockText, fullText, pageWidth: viewport.width, pageHeight: viewport.height });
      setState("READY");
      await task.destroy();
    } catch (e) {
      setState("ERROR");
      setError(e instanceof Error ? e.message : "Text extraction failed.");
    }
  }

  if (!url) return <div className="border border-[#1C3A57] p-3 text-xs text-[#6D8AA0]">No controlled PDF URL is available for text intelligence.</div>;

  return <div className="border border-[#1C3A57] bg-[#0B1F32] p-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><div className="font-semibold text-[#DCEBF5]">PDF text intelligence</div><div className="cat mt-1">Reads embedded PDF text only. No OCR, no server proxy, no image guessing.</div></div>
      <button type="button" className="btn-secondary min-h-11" disabled={state === "LOADING"} onClick={extract}>{state === "LOADING" ? "Extracting…" : result ? "Re-extract" : "Extract title block"}</button>
    </div>
    {error && <div className="mt-2 border border-[#6A2C2C] bg-[#1A0C0C] p-2 text-[#F0A0A0]">{error}</div>}
    {result && <div className="mt-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="border border-[#1C3A57] p-2"><div className="cat">Sheet candidate</div><div className="mt-1 font-mono text-[#DCEBF5]">{result.sheetNumber || "—"}</div></div>
        <div className="border border-[#1C3A57] p-2"><div className="cat">Revision candidate</div><div className="mt-1 font-mono text-[#DCEBF5]">{result.revision || "—"}</div></div>
        <div className="border border-[#1C3A57] p-2"><div className="cat">Candidates</div><div className="mt-1 font-mono text-[#6FD6C9]">{candidates}/3</div></div>
      </div>
      <div className="border border-[#1C3A57] p-2"><div className="cat">Title candidate</div><div className="mt-1 text-[#DCEBF5]">{result.sheetTitle || "No reliable title candidate detected"}</div></div>
      <details><summary className="cursor-pointer text-[#6FD6C9]">Title-block zone text ({result.titleBlockText.length} lines)</summary><pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap border border-[#1C3A57] p-2 text-[10px] text-[#9CB2C2]">{result.titleBlockText.join("\n") || "No embedded text detected in the lower-right title-block zone."}</pre></details>
      <details><summary className="cursor-pointer text-[#6FD6C9]">Full page embedded text ({result.fullText.length} lines)</summary><pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap border border-[#1C3A57] p-2 text-[10px] text-[#9CB2C2]">{result.fullText.join("\n")}</pre></details>
      <div className="cat">Page {pageNumber} · {Math.round(result.pageWidth)}×{Math.round(result.pageHeight)} PDF units · client-side PDF.js extraction</div>
    </div>}
  </div>;
}
