import Link from "next/link";
import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { getSupplierLeadTimes } from "@/lib/commercial-intelligence";
import { saveSupplierLeadTimeAction } from "./actions";

export default async function SupplierLeadTimesPage() {
  const ctx = await requireTenantContext();
  const suppliers = await db.supplier.findMany({ where: { accountId: ctx.account.id }, orderBy: { name: "asc" } });
  const leadTimes = await getSupplierLeadTimes(ctx.account.id, suppliers.map((s) => s.id));
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const today = new Date().toISOString().slice(0, 10);
  const risk = leadTimes.filter((r) => r.leadTimeDays >= 42).length;
  const long = leadTimes.filter((r) => r.leadTimeDays >= 21 && r.leadTimeDays < 42).length;

  return <div className="space-y-5">
    <section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Procurement Intelligence · {ctx.account.name}</p><h1 className="stratum-sheet-title">Supplier Lead Times</h1><p className="mt-2 text-sm text-[#9CB2C2]">Maintain category-specific lead-time evidence for procurement planning, quote evaluation, and commercial risk.</p></div><Link href="/suppliers" className="btn-secondary">Supplier directory</Link></div></section>

    <section className="grid gap-3 sm:grid-cols-3"><div className="stratum-sheet"><span className="cat">Tracked categories</span><div className="mt-2 text-2xl font-semibold text-[#DCEBF5]">{leadTimes.length}</div></div><div className="stratum-sheet"><span className="cat">Long lead ≥21d</span><div className="mt-2 text-2xl font-semibold text-amber-300">{long}</div></div><div className="stratum-sheet"><span className="cat">Critical ≥42d</span><div className="mt-2 text-2xl font-semibold text-rose-400">{risk}</div></div></section>

    <section className="stratum-sheet"><h2 className="text-sm font-semibold text-[#DCEBF5]">Update lead-time evidence</h2><form action={saveSupplierLeadTimeAction} className="mt-3 grid gap-2 md:grid-cols-4 xl:grid-cols-8"><select name="supplierId" required><option value="">Supplier</option>{suppliers.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input name="category" required placeholder="Switchgear, conduit…"/><input name="leadTimeDays" type="number" min="0" required placeholder="Days"/><input name="asOf" type="date" defaultValue={today}/><input name="validUntil" type="date"/><input name="source" placeholder="Quote / call / email"/><input name="notes" placeholder="Evidence notes"/><button className="btn">Save</button></form></section>

    <section className="stratum-sheet"><div className="table-scroll"><table className="min-w-[950px]"><thead><tr><th>Supplier</th><th>Category</th><th className="num">Lead time</th><th>As of</th><th>Valid until</th><th>Source</th><th>Risk</th></tr></thead><tbody>{leadTimes.map((row)=><tr key={row.id}><td className="font-medium text-[#DCEBF5]">{supplierById.get(row.supplierId)?.name || "Unknown supplier"}</td><td>{row.category}</td><td className="num">{row.leadTimeDays}d</td><td>{new Date(row.asOf).toISOString().slice(0,10)}</td><td>{row.validUntil ? new Date(row.validUntil).toISOString().slice(0,10) : "—"}</td><td>{row.source || "—"}</td><td><span className={`tag ${row.leadTimeDays >= 42 ? "RFI" : row.leadTimeDays >= 21 ? "QUOTE" : "REF"}`}>{row.leadTimeDays >= 42 ? "CRITICAL" : row.leadTimeDays >= 21 ? "LONG" : "NORMAL"}</span></td></tr>)}</tbody></table></div>{leadTimes.length===0&&<div className="empty-state mt-3">No lead-time records yet. Add supplier/category evidence above.</div>}</section>
  </div>;
}
