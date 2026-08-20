import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-base font-semibold text-slate-800">No organization yet</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account isn&apos;t attached to an organization. Ask an admin to invite you, or sign out and create a new one.
        </p>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
