import React from "react";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-slate-200/80 bg-white shadow-card transition-shadow ${className}`}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</div>;
}

export function PageHeader({
  eyebrow, title, subtitle, actions,
}: { eyebrow?: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 animate-fade-up">
      <div>
        {eyebrow && <div className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-signal-600">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

const buttonBase = "inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
const buttonVariants = {
  primary: "bg-signal-600 text-white px-3.5 py-2 hover:bg-signal-700 shadow-sm hover:shadow-glow",
  secondary: "border border-slate-300 bg-white text-slate-700 px-3.5 py-2 hover:border-slate-400 hover:bg-slate-50",
  ghost: "text-slate-500 px-2 py-1.5 hover:text-slate-800 hover:bg-slate-100",
  danger: "text-rose-600 px-2 py-1.5 hover:bg-rose-50",
};

export function Button({
  variant = "secondary", className = "", children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function StatCard({
  label, value, tone = "text-slate-800", icon,
}: { label: string; value: React.ReactNode; tone?: string; icon?: React.ReactNode }) {
  return (
    <Card className="group px-4 py-3.5 hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        </div>
        {icon && <div className="text-slate-300 transition-colors group-hover:text-slate-400">{icon}</div>}
      </div>
    </Card>
  );
}
