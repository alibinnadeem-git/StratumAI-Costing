import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { acceptPendingInviteAction } from "./actions";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login");

  const email = session.user.email.toLowerCase().trim();
  const invites = await db.invite.findMany({
    where: { email, acceptedAt: null },
    include: { organization: true, account: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-base font-semibold text-slate-800">Workspace access</h1>
        {invites.length>0 ? <>
          <p className="mt-2 text-sm text-slate-500">You have pending STRATUM Electric workspace invitations for <b>{email}</b>.</p>
          <div className="mt-4 space-y-3">{invites.map(invite=>{
            const accountName=invite.account?.name||"Main Account";
            return <div key={invite.id} className="rounded-md border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-800">{invite.organization.name}</div>
              <div className="mt-1 text-xs text-slate-500">{accountName} · {invite.role}</div>
              <form action={acceptPendingInviteAction.bind(null, invite.id)} className="mt-3">
                <button className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">Accept workspace invite</button>
              </form>
            </div>;
          })}</div>
        </> : <>
          <p className="mt-2 text-sm text-slate-500">Your account isn&apos;t attached to an organization or account tenant yet. Ask an admin to invite this email address, or sign out and create a new organization.</p>
        </>}
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="mt-5 rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Sign out</button>
        </form>
      </div>
    </div>
  );
}
