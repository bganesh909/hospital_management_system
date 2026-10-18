import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, Send, ArrowLeft } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import { useCreateInvoice } from '../../hooks/useBilling';
import { useSearchPatients } from '../../hooks/usePatients';
import { useSettings } from '../../hooks/useSettings';
import { useAdmissions } from '../../hooks/useIpd';
import type { Admission } from '../../services/ipdService';
import type { InvoiceItemType } from '../../services/billingService';

const itemTypes = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'lab_test', label: 'Lab Test' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'bed_charge', label: 'Bed Charge' },
  { value: 'procedure', label: 'Procedure' },
];

interface LineItem {
  item_type: InvoiceItemType;
  description: string;
  quantity: number;
  unit_price: number;
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();

  const [patientId, setPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const { data: patientResults } = useSearchPatients(patientSearch);
  const patientOptions: any[] = patientResults?.data ?? [];
  const [admissionId, setAdmissionId] = useState('');
  const { data: patientAdmissions } = useAdmissions(
    patientId ? { patient_id: patientId, limit: 50 } : undefined,
  );
  const admissionOptions = patientId
    ? (patientAdmissions?.data ?? []).map((a: Admission) => ({
        value: a.id,
        label: `${a.admission_number} · ${a.admission_date.slice(0, 10)}${a.ward_name ? ` · ${a.ward_name}` : ''}`,
      }))
    : [];
  const [items, setItems] = useState<LineItem[]>([
    { item_type: 'consultation', description: '', quantity: 1, unit_price: 0 },
  ]);
  const [taxPercent, setTaxPercent] = useState(0);
  const { data: settings } = useSettings();
  const currency = settings?.currency_symbol ?? 'Rs.';
  const taxDefaulted = useRef(false);

  // Default the tax rate from hospital settings once, without overriding user edits
  useEffect(() => {
    if (settings && !taxDefaulted.current) {
      taxDefaulted.current = true;
      setTaxPercent(Number(settings.tax_rate) || 0);
    }
  }, [settings]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = (subtotal * taxPercent) / 100;
  const total = subtotal + taxAmount - discount;

  const addItem = () => {
    setItems([...items, { item_type: 'consultation', description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSubmit = (issueImmediately: boolean) => {
    if (!patientId) return;
    if (items.some((item) => !item.description || item.quantity <= 0 || item.unit_price <= 0)) return;

    createInvoice.mutate(
      {
        patient_id: patientId,
        ipd_admission_id: admissionId || undefined,
        items: items.map((item) => ({
          item_type: item.item_type,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        tax_amount: Math.round(taxAmount * 100) / 100,
        discount_amount: discount,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        issue: issueImmediately,
      },
      {
        onSuccess: () => {
          navigate('/billing');
        },
      }
    );
  };

  return (
    <div>
      <PageHeader
        title="Create Invoice"
        subtitle="Generate a new billing invoice"
        actions={
          <button
            onClick={() => navigate('/billing')}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        }
      />

      <div className="max-w-4xl space-y-6">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Patient Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Patient" required>
              <div className="relative">
                <Input
                  placeholder="Search patient by name or ID..."
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setPatientId('');
                    setAdmissionId('');
                    setShowPatientResults(true);
                  }}
                  onFocus={() => setShowPatientResults(true)}
                />
                {showPatientResults && !patientId && patientOptions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {patientOptions.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPatientId(p.id);
                            setPatientSearch(`${p.first_name} ${p.last_name} (${p.patient_number})`);
                            setShowPatientResults(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                        >
                          {p.first_name} {p.last_name}
                          <span className="ml-2 text-xs text-gray-500">{p.patient_number}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </FormField>
            <FormField label="IPD Admission (Optional)">
              <Select
                value={admissionId}
                onChange={(e) => setAdmissionId(e.target.value)}
                options={admissionOptions}
                placeholder={patientId ? 'Not linked to an admission' : 'Select a patient first'}
                disabled={!patientId}
              />
            </FormField>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Line Items</h3>
            <button
              onClick={addItem}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 font-medium"
            >
              <Plus size={14} />
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left font-semibold text-gray-600 w-36">Type</th>
                  <th className="pb-2 text-left font-semibold text-gray-600">Description</th>
                  <th className="pb-2 text-right font-semibold text-gray-600 w-24">Qty</th>
                  <th className="pb-2 text-right font-semibold text-gray-600 w-32">Unit Price</th>
                  <th className="pb-2 text-right font-semibold text-gray-600 w-32">Total</th>
                  <th className="pb-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-2 pr-2">
                      <Select
                        options={itemTypes}
                        value={item.item_type}
                        onChange={(e) => updateItem(idx, 'item_type', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                        className="text-right"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="text-right"
                      />
                    </td>
                    <td className="py-2 pr-2 text-right font-medium text-gray-900">
                      {currency} {(item.quantity * item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals & Tax */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Additional Details</h3>
            <div className="space-y-4">
              <FormField label="Tax (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                />
              </FormField>
              <FormField label={`Discount (${currency})`}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
              </FormField>
              <FormField label="Due Date">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </FormField>
              <FormField label="Notes">
                <Textarea
                  placeholder="Additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </FormField>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Invoice Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{currency} {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax ({taxPercent}%)</span>
                <span className="font-medium">{currency} {taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="font-medium text-red-500">-{currency} {discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="text-base font-semibold text-gray-900">Total</span>
                <span className="text-base font-bold text-gray-900">{currency} {total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => handleSubmit(true)}
                disabled={createInvoice.isPending || !patientId || total <= 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                {createInvoice.isPending ? 'Creating...' : 'Issue Invoice'}
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={createInvoice.isPending || !patientId || total <= 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
