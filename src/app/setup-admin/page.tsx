import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SetupAdminPage() {
  const existingUsers = await db.user.count();
  if (existingUsers > 0) redirect("/login");

  async function createFirstAdmin(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").toLowerCase().trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim() || email;

    if (!email || !password || password.length < 12) {
      throw new Error("A valid email and password of at least 12 characters are required.");
    }

    await db.$transaction(async (tx) => {
      const userCount = await tx.user.count();
      if (userCount > 0) throw new Error("Initial administrator has already been created.");

      const org = await tx.organization.upsert({
        where: { slug: "stratum-electric" },
        update: {},
        create: { name: "Stratum Electric", slug: "stratum-electric" },
      });

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          systemRole: "SUPER_ADMIN",
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "ADMIN",
        },
      });
    });

    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400">Stratum AI Costing</p>
          <h1 className="mt-3 text-3xl font-semibold">Create first administrator</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            This one-time setup is available only while no application users exist. After the first administrator is created, this page disables itself automatically.
          </p>
        </div>

        <form action={createFirstAdmin} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Name</span>
            <input name="name" defaultValue="Ali Bin Nadeem" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none ring-emerald-400 focus:ring-2" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Email</span>
            <input name="email" type="email" required className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none ring-emerald-400 focus:ring-2" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Password</span>
            <input name="password" type="password" minLength={12} required className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none ring-emerald-400 focus:ring-2" />
          </label>
          <button type="submit" className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
            Create administrator
          </button>
        </form>
      </section>
    </main>
  );
}
