import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";
import { money } from "@/lib/costing";
import { createRfqFromEstimateAction } from "./actions";

export default async function EstimateRfqPage({ params }: { params: Promise<{ estimateId: string }> }) {
  const { estimateId } = await params;
  const ctx = await requireTenantContext();
  const estimate = await db.costEstimate.findFirst({
    where: { id: estimateId, accountId: ctx.account.id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } }, project: true },
  });
  if (!estimate) notFound();

  const suppliers = await db.supplier.findMany({
    where: { accountId: ctx.account.id },
    orderBy: { name: "asc" },
  });

  return <div className="space-y-5">
    <section className="stratum-sheet">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Procurement · Estimate to RFQ</p>
          <h1 className="stratum-sheet-title">Build RFQ from EST-{String(estimate.number).padStart(4, "0")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#9CB2C2]">Select estimate lines and suppliers. The RFQ inherits the estimate quantities and keeps the originating estimate identified in its procurement record.</p>
        </div>
        <Link href={`/costing/estimates/${estimate.id}`} className="btn-secondary">Back to estimate</Link>
      </div>
    </section>

    {!estimate.projectId ? <section className="stratum-sheet border border-amber-700/40">
      <div className="text-sm text-amber-200">This estimate is not linked to a project. Link it to a project before creating an RFQ.</div>
    </section> : <form action={createRfqFromEstimateAction} className="space-y-5">
      <input type="hidden" name="estimateId" value={estimate.id} />

      <section className="stratum-sheet space-y-3">
        <h2 className="text-sm font-semibold text-[#DCEBF5]">RFQ details</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="md:col-span-2"><span className="cat">Title</span><input name="title" required defaultValue={`${estimate.project?.name || estimate.name} Material RFQ`} className="mt-1 w-full" /></label>
          <label><span className="cat">Due date</span><input name="dueDate" type="date" className="mt-1 w-full" /></label>
          <label className="md:col-span-3"><span className="cat">Notes</span><textarea name="notes" rows={3} className="mt-1 w-full" placeholder="Scope clarifications, alternates, quote requirements, delivery expectations…" /></label>
        </div>
      </section>

      <section className="stratum-sheet">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-[#DCEBF5]">Estimate lines</h2><span className="cat">{estimate.lineItems.length} available</span></div>
        <div className="table-scroll"><table className="min-w-[850px]"><thead><tr><th></th><th>Description</th><th className="num">Qty</th><th>Unit</th><th className="num">Material / unit</th><th className="num">Extended material</th></tr></thead><tbody>{estimate.lineItems.map((line) => <tr key={line.id}>
          <td><input type="checkbox" name="lineId" value={line.id} defaultChecked /></td>
          <td className="desc-cell">{line.description}<span className="cat">{line.category || "Estimate line"}</span></td>
          <td className="num">{line.quantity}</td><td>{line.unit}</td><td className="num">{money(line.materialCost)}</td><td className="num text-[#6FD6C9]">{money(line.materialCost * line.quantity)}</td>
        </tr>)}</tbody></table></div>
      </section>

      <section className="stratum-sheet">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-[#DCEBF5]">Suppliers</h2><span className="cat">Select one or more</span></div>
        {suppliers.length === 0 ? <div className="empty-state">No suppliers are configured in this account yet.</div> : <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{suppliers.map((supplier) => <label key={supplier.id} className="flex items-start gap-3 border border-[#1C3A57] bg-[#0B1F32] p-3">
          <input type="checkbox" name="supplierId" value={supplier.id} className="mt-1" />
          <span><span className="block text-sm font-semibold text-[#DCEBF5]">{supplier.name}</span><span className="cat">{supplier.contactName || supplier.email}</span>{supplier.categories.length > 0 && <span className="mt-1 block text-[11px] text-[#6D8AA0]">{supplier.categories.join(" · ")}</span>}</span>
        </label>)}</div>}
      </section>

      <section className="stratum-sheet flex items-center justify-between gap-4"><div><div className="text-sm font-semibold text-[#DCEBF5]">Create procurement package</div><div className="cat">RFQ will be created inside {estimate.project?.name}</div></div><button className="btn" disabled={suppliers.length === 0}>Create RFQ from estimate</button></section>
    </form>}
  </div>;
}
