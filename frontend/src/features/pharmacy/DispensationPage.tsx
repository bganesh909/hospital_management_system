import { currencySymbol } from '../../lib/currency';
import { useState } from 'react';
import { Package, CheckCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { Modal } from '../../components/shared/Modal';
import { FormField, Textarea } from '../../components/shared/FormField';
import { usePendingPrescriptions, useCreateDispensation, useDispensations } from '../../hooks/usePharmacy';
import type { Dispensation, PendingPrescription } from '../../services/pharmacyService';

const formatPrice = (value?: number | null) => (value == null ? '--' : `${currencySymbol()} ${Number(value).toFixed(2)}`);

export default function DispensationPage() {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDispense, setShowDispense] = useState<PendingPrescription | null>(null);
  const [notes, setNotes] = useState('');
  const [page] = useState(1);

  const { data: pendingData, isLoading: pendingLoading } = usePendingPrescriptions();
  const { data: historyData, isLoading: historyLoading } = useDispensations({ page, limit: 20 });
  const dispenseMutation = useCreateDispensation();

  const handleDispense = () => {
    if (!showDispense) return;
    // Free-text prescription items have no medicine_id; the backend matches them by name
    const items = showDispense.items.map((item) => ({
      medicine_id: item.medicine_id ?? undefined,
      medicine_name: item.medicine_name,
      quantity: item.quantity,
    }));

    dispenseMutation.mutate(
      { prescription_id: showDispense.id, items, notes: notes.trim() || undefined },
      {
        onSuccess: () => { setShowDispense(null); setNotes(''); },
      }
    );
  };

  const pending: PendingPrescription[] = pendingData?.data || [];
  const history: Dispensation[] = historyData?.data || [];
  const dispenseTotal = (showDispense?.items || []).reduce(
    (sum, item) => sum + (item.unit_price ?? 0) * item.quantity,
    0,
  );
  const hasUnpricedItems = (showDispense?.items || []).some((item) => item.unit_price == null);

  return (
    <div>
      <PageHeader title="Dispensation" subtitle="Dispense medicines for prescriptions" />

      <div className="flex gap-3 mb-6">
        <button onClick={() => setTab('pending')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${tab === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Clock size={16} /> Pending Queue
          {pending.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{pending.length}</span>}
        </button>
        <button onClick={() => setTab('history')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${tab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <CheckCircle size={16} /> History
        </button>
      </div>

      {tab === 'pending' && (
        <div className="space-y-3">
          {pendingLoading ? <LoadingSpinner className="py-12" /> : pending.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
              <Package size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No pending prescriptions</p>
            </div>
          ) : pending.map((rx) => (
            <div key={rx.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expandedId === rx.id ? null : rx.id)}>
                <div className="flex items-center gap-4">
                  <span className="text-gray-400">{expandedId === rx.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</span>
                  <div>
                    <p className="font-medium text-gray-900">{rx.prescription_number}</p>
                    <p className="text-sm text-gray-500">
                      {rx.patient_name ?? 'Unknown patient'}
                      {rx.doctor_name && <span className="text-gray-400"> · {rx.doctor_name}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{rx.items?.length || 0} items</span>
                  <StatusBadge status={rx.status} />
                  <button onClick={(e) => { e.stopPropagation(); setShowDispense(rx); }} className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">Dispense</button>
                </div>
              </div>
              {expandedId === rx.id && rx.items && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500"><th className="pb-2">Medicine</th><th className="pb-2">Dosage</th><th className="pb-2">Frequency</th><th className="pb-2">Duration</th><th className="pb-2 text-right">Qty</th></tr></thead>
                    <tbody>
                      {rx.items.map((item, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="py-2 font-medium">{item.medicine_name}</td>
                          <td className="py-2 text-gray-600">{item.dosage}</td>
                          <td className="py-2 text-gray-600">{item.frequency}</td>
                          <td className="py-2 text-gray-600">{item.duration}</td>
                          <td className="py-2 text-right">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Dispensation #</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Prescription</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Patient</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Total</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
            </tr></thead>
            <tbody>
              {historyLoading ? <tr><td colSpan={6} className="px-4 py-8 text-center"><LoadingSpinner size="sm" /></td></tr>
              : history.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No history</td></tr>
              : history.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.dispensation_number}</td>
                  <td className="px-4 py-3 text-gray-600">{d.prescription_number ?? '--'}</td>
                  <td className="px-4 py-3 text-gray-600">{d.patient_name ?? '--'}</td>
                  <td className="px-4 py-3">{formatPrice(d.total_amount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(d.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!showDispense} onClose={() => setShowDispense(null)} title="Confirm Dispensation" size="lg" footer={
        <div className="flex gap-3">
          <button onClick={() => setShowDispense(null)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={handleDispense} disabled={dispenseMutation.isPending} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {dispenseMutation.isPending ? 'Dispensing...' : 'Confirm Dispense'}
          </button>
        </div>
      }>
        {showDispense && (
          <div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="font-medium">{showDispense.prescription_number}</p>
              {showDispense.patient_name && <p className="text-sm text-gray-500">{showDispense.patient_name}</p>}
            </div>
            <table className="w-full text-sm mb-4">
              <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Medicine</th><th className="pb-2">Qty</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-right">Total</th></tr></thead>
              <tbody>
                {showDispense.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-2">{item.medicine_name}</td>
                    <td className="py-2">{item.quantity}</td>
                    <td className="py-2 text-right">{formatPrice(item.unit_price)}</td>
                    <td className="py-2 text-right font-medium">
                      {item.unit_price == null ? '--' : formatPrice(item.unit_price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-2 text-right font-semibold">Total</td>
                  <td className="pt-2 text-right font-semibold">{formatPrice(dispenseTotal)}</td>
                </tr>
              </tfoot>
            </table>
            {hasUnpricedItems && (
              <p className="mb-4 text-sm text-amber-700 bg-amber-50 rounded-lg p-2">
                Some medicines aren't in the inventory under this name and can't be dispensed.
              </p>
            )}
            <FormField label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dispensation notes..." /></FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
