import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { usePatient } from '../../hooks/usePatients';
import type { LabRequest } from '../../services/laboratoryService';

// Only the report is visible when printing; the rest of the app is hidden.
const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  .lab-report-print, .lab-report-print * { visibility: visible !important; }
  .lab-report-print { position: absolute; inset: 0; margin: 0; padding: 24px; box-shadow: none !important; border: none !important; max-height: none !important; overflow: visible !important; }
  .lab-report-no-print { display: none !important; }
  @page { margin: 12mm; }
}
`;

function ageFrom(dob?: string | null) {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

const RESULT_STYLES: Record<string, string> = {
  normal: 'text-gray-900',
  abnormal: 'text-orange-700 font-semibold',
  critical: 'text-red-700 font-bold',
};

export function LabReportModal({ request, onClose }: { request: LabRequest; onClose: () => void }) {
  const { data } = usePatient(request.patient_id);
  const patient = data?.data;
  const age = ageFrom(patient?.date_of_birth);
  const reportedAt = request.items
    .map((i) => i.performed_at)
    .filter(Boolean)
    .sort()
    .pop();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <style>{PRINT_STYLES}</style>
      <div className="lab-report-print bg-white w-full max-w-3xl rounded-xl shadow-xl my-8">
        <div className="lab-report-no-print flex items-center justify-between px-6 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Lab Report</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Printer size={16} />
              Print
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Laboratory Report</h1>
              <p className="text-sm text-gray-500">Department of Pathology & Laboratory Medicine</p>
            </div>
            <div className="text-right text-sm text-gray-700">
              <p className="font-semibold">{request.request_number}</p>
              <p>Requested: {new Date(request.created_at).toLocaleString()}</p>
              {reportedAt && <p>Reported: {new Date(reportedAt).toLocaleString()}</p>}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
            <Field label="Patient" value={request.patient_name} />
            <Field label="Patient #" value={request.patient_number} />
            <Field
              label="Age / Gender"
              value={[age != null ? `${age} yrs` : null, patient?.gender].filter(Boolean).join(' / ') || null}
            />
            <Field label="Referring Doctor" value={request.doctor_name ? `Dr. ${request.doctor_name}` : null} />
            <Field label="Priority" value={request.priority.toUpperCase()} />
            <Field label="Status" value={request.status.replace(/_/g, ' ')} />
          </dl>

          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left">
                <th className="py-2 pr-4 font-semibold text-gray-700">Test</th>
                <th className="py-2 pr-4 font-semibold text-gray-700">Result</th>
                <th className="py-2 pr-4 font-semibold text-gray-700">Unit</th>
                <th className="py-2 pr-4 font-semibold text-gray-700">Reference Range</th>
                <th className="py-2 font-semibold text-gray-700">Flag</th>
              </tr>
            </thead>
            <tbody>
              {request.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-200 align-top">
                  <td className="py-2 pr-4">
                    <p className="font-medium text-gray-900">{item.test_name ?? item.test_code}</p>
                    {item.remarks && <p className="text-xs text-gray-500 mt-0.5">{item.remarks}</p>}
                  </td>
                  <td className={`py-2 pr-4 ${RESULT_STYLES[item.result_status] ?? 'text-gray-400'}`}>
                    {item.result_value ?? 'Pending'}
                  </td>
                  <td className="py-2 pr-4 text-gray-700">{item.unit ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-700">{item.normal_range ?? '—'}</td>
                  <td className="py-2 capitalize text-gray-700">
                    {item.result_status === 'pending' ? '—' : item.result_status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {request.notes && (
            <div className="text-sm mb-6">
              <p className="font-semibold text-gray-700">Clinical Notes</p>
              <p className="text-gray-700 whitespace-pre-wrap">{request.notes}</p>
            </div>
          )}

          <div className="flex justify-between items-end pt-12 text-sm text-gray-600">
            <p>Printed: {new Date().toLocaleString()}</p>
            <div className="text-center">
              <div className="border-t border-gray-400 w-48 mb-1" />
              <p>Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="text-gray-500 w-36 shrink-0">{label}:</dt>
      <dd className="text-gray-900 font-medium capitalize">{value || '—'}</dd>
    </div>
  );
}
