import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <FileQuestion className="h-8 w-8 text-slate-500" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-slate-800">Page not found</h2>
      <p className="mt-2 text-sm text-slate-500">The page you're looking for doesn't exist.</p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
