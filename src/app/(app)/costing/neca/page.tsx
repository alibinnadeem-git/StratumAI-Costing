import { requireTenantContext } from "@/lib/session";
import { atLeast } from "@/lib/rbac";
import { NECA_META, NECA_RATES } from "@/lib/costing-data";
import { importNecaRateAction } from "../actions";

export default async function NecaLibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; unit?: string; condition?: string }> }) {
  const ctx = await requireTenantContext();
  const sp = await searchParams;
  const q = (sp.q || "").toLowerCase().trim();
  const unit = sp.unit || "";
  const condition = sp.condition || "NORMAL";
  const canImport = atLeast(ctx.accountRole, "ADMIN");
  const filtered = NECA_RATES.map((rate, index) => ({ rate, index })).filter(({ rate }) => (!q || rate.description.toLowerCase().includes(q) || String(rate.sourcePage).includes(q)) && (!unit || rate.unit === unit));
  const units = [...new Set(NECA_RATES.map(rate => rate.unit))].sort();

  return <div className="space-y-5">
    <section className="stratum-sheet"><h1 className="stratum-sheet-title">NECA Labor Library</h1><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">{ctx.organization.name} · {ctx.account.name} · {NECA_META.rowCount} source-page-QA rows · import creates account-owned cost items</p></section>
    <div className="banner"><b>QA policy:</b> only rows retained after direct source-page review are present. Uncertain OCR values stay excluded from estimating.</div>
    <section className="stratum-sheet"><form className="grid gap-2 sm:grid-cols-[1fr_140px_190px_auto]"><input name="q" defaultValue={sp.q||""} placeholder="Search description or PDF page…"/><select name="unit" defaultValue={unit}><option value="">All units</option>{units.map(value=><option key={value}>{value}</option>)}</select><select name="condition" defaultValue={condition}><option value="NORMAL">Normal</option><option value="DIFFICULT">Difficult</option><option value="VERY_DIFFICULT">Very difficult</option></select><button className="btn secondary">Filter</button></form></section>
    <section className="stratum-sheet"><div className="table-scroll"><table className="min-w-[900px]"><thead><tr><th>PDF page</th><th>Description</th><th>Unit</th><th className="num">Normal</th><th className="num">Difficult</th><th className="num">Very difficult</th><th>QA</th>{canImport&&<th/>}</tr></thead><tbody>{filtered.map(({rate,index})=><tr key={`${rate.sourcePage}-${index}`}><td>{rate.sourcePage}</td><td>{rate.description}</td><td>{rate.unit}</td><td className="num">{rate.normal}</td><td className="num">{rate.difficult}</td><td className="num">{rate.veryDifficult}</td><td><span className="tag HIST">VERIFIED</span></td>{canImport&&<td><form action={importNecaRateAction}><input type="hidden" name="index" value={index}/><input type="hidden" name="condition" value={condition}/><button className="btn small">Import to account</button></form></td>}</tr>)}</tbody></table></div>{filtered.length===0&&<div className="empty-state mt-3">No matching verified rows.</div>}</section>
  </div>;
}
