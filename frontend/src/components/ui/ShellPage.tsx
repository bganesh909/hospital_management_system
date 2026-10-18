import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';

interface ShellPageProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

export default function ShellPage({
  title,
  description,
  icon: Icon = Construction,
}: ShellPageProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
        <Icon className="h-8 w-8 text-primary-600" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-slate-800">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">
        {description ?? 'This module is coming soon. Stay tuned for updates.'}
      </p>
      <div className="mt-6 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-700">
        Under Development
      </div>
    </div>
  );
}
