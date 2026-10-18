import { Fragment, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, RotateCcw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Input, Select } from '../../components/shared/FormField';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { useAuditEntityTypes, useAuditLogs } from '../../hooks/useAudit';
import { useUsers } from '../../hooks/useUsers';
import type { AuditAction, AuditLog, AuditLogParams } from '../../services/auditService';

const LIMIT = 50;

const ACTION_STYLES: Record<AuditAction, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
};

const ACTION_OPTIONS = [
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' },
];

const EMPTY_FILTERS: AuditLogParams = {
  entity_type: '',
  action: undefined,
  user_id: '',
  date_from: '',
  date_to: '',
};

const humanize = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function summarize(log: AuditLog): string {
  if (log.action === 'update' && log.new_values) {
    const fields = Object.keys(log.new_values);
    const shown = fields.slice(0, 3).map(humanize).join(', ');
    return fields.length > 3 ? `${shown} +${fields.length - 3} more` : shown;
  }
  const values = log.new_values ?? log.old_values ?? {};
  const label =
    values['name'] ??
    values['hospital_name'] ??
    [values['first_name'], values['last_name']].filter(Boolean).join(' ') ??
    '';
  const number = Object.entries(values).find(([k]) => k.endsWith('_number'))?.[1];
  return [number, label].filter(Boolean).join(' · ') || `${Object.keys(values).length} fields`;
}

function DiffTable({ log }: { log: AuditLog }) {
  const keys = Array.from(
    new Set([...Object.keys(log.old_values ?? {}), ...Object.keys(log.new_values ?? {})]),
  ).sort();

  if (keys.length === 0) {
    return <p className="text-sm text-gray-500">No field changes recorded.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="py-2 pr-4 font-semibold w-1/4">Field</th>
          {log.action !== 'create' && <th className="py-2 pr-4 font-semibold">Before</th>}
          {log.action !== 'delete' && <th className="py-2 font-semibold">After</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {keys.map((key) => (
          <tr key={key} className="align-top">
            <td className="py-2 pr-4 font-medium text-gray-700">{humanize(key)}</td>
            {log.action !== 'create' && (
              <td className="py-2 pr-4 text-red-700 break-all">
                {formatValue(log.old_values?.[key])}
              </td>
            )}
            {log.action !== 'delete' && (
              <td className="py-2 text-green-700 break-all">{formatValue(log.new_values?.[key])}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState<AuditLogParams>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useAuditLogs({ ...filters, page, limit: LIMIT });
  const { data: entityTypes = [] } = useAuditEntityTypes();
  const { data: usersData } = useUsers({ limit: 100 });

  const logs = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const users: any[] = usersData?.data ?? [];

  const setFilter = (key: keyof AuditLogParams, value: string) => {
    setFilters((f) => ({ ...f, [key]: value || (key === 'action' ? undefined : '') }));
    setPage(1);
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Every create, update and delete made in the system, with who made it"
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Select
            value={filters.entity_type ?? ''}
            onChange={(e) => setFilter('entity_type', e.target.value)}
            placeholder="All records"
            options={entityTypes.map((t) => ({ value: t, label: humanize(t) }))}
          />
          <Select
            value={filters.action ?? ''}
            onChange={(e) => setFilter('action', e.target.value)}
            placeholder="All actions"
            options={ACTION_OPTIONS}
          />
          <Select
            value={filters.user_id ?? ''}
            onChange={(e) => setFilter('user_id', e.target.value)}
            placeholder="All users"
            options={users.map((u) => ({ value: u.id, label: `${u.full_name} (${humanize(u.role)})` }))}
          />
          <Input
            type="date"
            value={filters.date_from ?? ''}
            max={filters.date_to || undefined}
            onChange={(e) => setFilter('date_from', e.target.value)}
            aria-label="From date"
          />
          <div className="flex gap-2">
            <Input
              type="date"
              value={filters.date_to ?? ''}
              min={filters.date_from || undefined}
              onChange={(e) => setFilter('date_to', e.target.value)}
              aria-label="To date"
            />
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setPage(1);
                }}
                className="inline-flex items-center px-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                title="Clear filters"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 font-semibold text-gray-600">When</th>
                <th className="px-4 py-3 font-semibold text-gray-600">User</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Action</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Record</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Details</th>
                <th className="px-4 py-3 font-semibold text-gray-600">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <LoadingSpinner className="mx-auto" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No audit entries{hasFilters ? ' match these filters' : ' yet'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isOpen = expanded === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr
                        className={`cursor-pointer hover:bg-gray-50 ${isOpen ? 'bg-gray-50' : ''}`}
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-gray-400">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                          {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm:ss')}
                        </td>
                        <td className="px-4 py-3">
                          {log.user_name ? (
                            <div>
                              <div className="font-medium text-gray-900">{log.user_name}</div>
                              <div className="text-xs text-gray-500">{humanize(log.user_role ?? '')}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">System</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_STYLES[log.action] ?? 'bg-gray-100 text-gray-700'}`}
                          >
                            {humanize(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{humanize(log.entity_type)}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{summarize(log)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{log.ip_address ?? '—'}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50">
                          <td />
                          <td colSpan={6} className="px-4 pb-4">
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                              <DiffTable log={log} />
                              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                                {log.entity_id && <div>Record ID: {log.entity_id}</div>}
                                {log.user_email && <div>User email: {log.user_email}</div>}
                                {log.user_agent && <div className="break-all">Device: {log.user_agent}</div>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
          <span>
            {total === 0
              ? '0 entries'
              : `${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} of ${total} entries`}
            {isFetching && !isLoading && <span className="ml-2 text-gray-400">Updating…</span>}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
