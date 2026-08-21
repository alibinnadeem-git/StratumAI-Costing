import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { atLeast } from "@/lib/rbac";
import { saveCostSettingsAction } from "../actions";

export default async function CostingSettingsPage() {
  const ctx = await requireTenantContext();
  const settings = await db.costSettings.findUnique({ where: { accountId: ctx.account.id } });
  const canManage = atLeast(ctx.accountRole, "ADMIN");

  return (
    <div className="max-w-4xl space-y-5">
      <section className="stratum-sheet">
        <h1 className="stratum-sheet-title">Costing Settings</h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">
          {ctx.organization.name} · {ctx.account.name} · account-specific estimating defaults
        </p>
      </section>

      <section className="stratum-sheet">
        <form action={saveCostSettingsAction} className="grid gap-4 sm:grid-cols-2">
          <label>Labor rate ($/hr)<input name="laborRate" type="number" step="0.01" defaultValue={settings?.laborRate ?? 95} disabled={!canManage} /></label>
          <label>Overhead (%)<input name="overheadPercent" type="number" step="0.1" defaultValue={settings?.overheadPercent ?? 12} disabled={!canManage} /></label>
          <label>Profit margin (%)<input name="profitMarginPercent" type="number" step="0.1" defaultValue={settings?.profitMarginPercent ?? 15} disabled={!canManage} /></label>
          <label>Difficulty multiplier<input name="difficultyMultiplier" type="number" step="0.05" defaultValue={settings?.difficultyMultiplier ?? 1} disabled={!canManage} /></label>
          <label className="sm:col-span-2">Default NECA / install condition<select name="defaultCondition" defaultValue={settings?.defaultCondition ?? "NORMAL"} disabled={!canManage}><option>NORMAL</option><option>DIFFICULT</option><option>VERY_DIFFICULT</option></select></label>
          {canManage && <button className="btn justify-self-start">Save account defaults</button>}
        </form>
      </section>

      {!canManage && <section className="stratum-sheet font-mono text-[11px] text-[#9FB6C7]">Your {ctx.accountRole} account role can view these settings. Account Admins and Owners can change the shared cost basis.</section>}
    </div>
  );
}
