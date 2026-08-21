import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { atLeast } from "@/lib/rbac";
import { money } from "@/lib/costing";
import { applyQuoteToItemAction, createSupplierQuoteAction } from "../actions";

export default async function QuotesPage() {
  const ctx = await requireTenantContext();
  const [quotes, suppliers, items, projects] = await Promise.all([
    db.supplierQuote.findMany({ where: { accountId: ctx.account.id }, include: { supplier: true, costItem: true, project: true }, orderBy: { quoteDate: "desc" }, take: 250 }),
    db.supplier.findMany({ where: { accountId: ctx.account.id }, orderBy: { name: "asc" } }),
    db.costItem.findMany({ where: { accountId: ctx.account.id }, orderBy: { description: "asc" } }),
    db.project.findMany({ where: { accountId: ctx.account.id, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);
  const canApply = atLeast(ctx.accountRole, "ADMIN");
  const canCreate = atLeast(ctx.accountRole, "MEMBER");

  return <div className="space-y-5">
    <section className="stratum-sheet"><h1 className="stratum-sheet-title">Supplier Quotes</h1><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">{ctx.organization.name} · {ctx.account.name} · vendor pricing and catalog calibration</p></section>
    {canCreate && <section className="stratum-sheet"><form action={createSupplierQuoteAction} className="grid gap-2 md:grid-cols-4"><input name="description" required placeholder="Quoted item / package" className="md:col-span-2"/><select name="supplierId"><option value="">Supplier</option>{suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select><select name="projectId"><option value="">No project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select><select name="costItemId" className="md:col-span-2"><option value="">No catalog item</option>{items.map(item=><option key={item.id} value={item.id}>{item.description}</option>)}</select><input name="quantity" type="number" step="0.01" defaultValue="1" placeholder="Qty"/><input name="unit" defaultValue="EA" placeholder="Unit"/><input name="unitMaterialCost" type="number" step="0.01" placeholder="Unit material $"/><input name="quoteDate" type="date" defaultValue={new Date().toISOString().slice(0,10)}/><input name="validUntil" type="date"/><input name="reference" placeholder="Quote # / reference"/><button className="btn">Log quote</button></form></section>}
    <section className="stratum-sheet"><div className="table-scroll"><table className="min-w-[900px]"><thead><tr><th>Quote</th><th>Supplier</th><th>Catalog item</th><th className="num">Unit price</th><th className="num">Extended</th><th>Valid until</th><th/></tr></thead><tbody>{quotes.map(quote=><tr key={quote.id}><td className="desc-cell">{quote.description}<span className="cat">{quote.quoteDate.toISOString().slice(0,10)} {quote.reference?`· ${quote.reference}`:""}</span></td><td>{quote.supplier?.name||"—"}</td><td>{quote.costItem?.description||"—"}</td><td className="num">{money(quote.unitMaterialCost)}</td><td className="num text-[#6FD6C9]">{money(quote.unitMaterialCost*quote.quantity)}</td><td>{quote.validUntil?.toISOString().slice(0,10)||"—"}</td><td>{canApply&&quote.costItemId&&<form action={applyQuoteToItemAction}><input type="hidden" name="quoteId" value={quote.id}/><button className="btn small">Apply price</button></form>}</td></tr>)}</tbody></table></div>{quotes.length===0&&<div className="empty-state mt-3">No supplier quotes logged in this account yet.</div>}</section>
  </div>;
}
