import { currencySymbol } from '../../lib/currency';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import { useUpdateInvoice } from '../../hooks/useBilling';
import type { Invoice, InvoiceItemType } from '../../services/billingService';

const itemTypes = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'lab_test', label: 'Lab Test' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'bed_charge', label: 'Bed Charge' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'other', label: 'Other' },
];

interface LineItem {
  item_type: InvoiceItemType;
  item_reference_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceEditModalProps {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
}

const formatRs = (value: number) => `${currencySymbol()} ${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function InvoiceEditModal({ invoice, open, onClose }: InvoiceEditModalProps) {
  const updateInvoice = useUpdateInvoice();
  const [items, setItems] = useState<LineItem[]>([]);
  const [taxAmount, setTaxAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Reset the form from the invoice every time the modal opens
  useEffect(() => {
    if (!open) return;
    setItems(
      (invoice.items ?? []).map((item) => ({
        item_type: item.item_type as InvoiceItemType,
        item_reference_id: item.item_reference_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))
    );
    setTaxAmount(invoice.tax_amount ?? 0);
    setDiscount(invoice.discount_amount ?? 0);
    setDueDate(invoice.due_date ?? '');
    setNotes(invoice.notes ?? '');
    setError('');
  }, [open, invoice]);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const total = Math.max(subtotal + taxAmount - discount, 0);

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleSave = () => {
    if (items.length === 0) {
      setError('An invoice needs at least one line item');
      return;
    }
    if (items.some((item) => !item.description.trim() || item.quantity < 1 || item.unit_price < 0)) {
      setError('Every item needs a description, a quantity of at least 1 and a non-negative price');
      return;
    }
    if (taxAmount < 0 || discount < 0) {
      setError('Tax and discount cannot be negative');
      return;
    }
    setError('');
    updateInvoice.mutate(
      {
        id: invoice.id,
        data: {
          items: items.map((item) => ({
            item_type: item.item_type,
            item_reference_id: item.item_reference_id ?? undefined,
            description: item.description.trim(),
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
          tax_amount: taxAmount,
          discount_amount: discount,
          due_date: dueDate || null,
          notes: notes.trim() || null,
        },
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Draft ${invoice.invoice_number}`}
      size="xl"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateInvoice.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updateInvoice.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <FormField label={idx === 0 ? 'Type' : ''} className="col-span-12 sm:col-span-2">
                <Select
                  options={itemTypes}
                  value={item.item_type}
                  onChange={(e) => updateItem(idx, 'item_type', e.target.value)}
                />
              </FormField>
              <FormField label={idx === 0 ? 'Description' : ''} className="col-span-12 sm:col-span-5">
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(idx, 'description', e.target.value)}
                  placeholder="Item description"
                />
              </FormField>
              <FormField label={idx === 0 ? 'Qty' : ''} className="col-span-4 sm:col-span-1">
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                />
              </FormField>
              <FormField label={idx === 0 ? 'Unit Price' : ''} className="col-span-5 sm:col-span-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                />
              </FormField>
              <div className="col-span-2 sm:col-span-1 pb-2 text-right text-sm font-medium text-gray-900">
                {(item.quantity * item.unit_price).toLocaleString('en-IN')}
              </div>
              <div className="col-span-1 pb-1.5 text-right">
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={items.length === 1}
                  className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30"
                  aria-label="Remove item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setItems((prev) => [...prev, { item_type: 'consultation', description: '', quantity: 1, unit_price: 0 }])
            }
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label={`Tax Amount (${currencySymbol()})`}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={taxAmount}
              onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
            />
          </FormField>
          <FormField label={`Discount (${currencySymbol()})`}>
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
        </div>

        <FormField label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes shown on the invoice" />
        </FormField>

        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1 max-w-xs ml-auto">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium">{formatRs(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Tax</span>
            <span className="font-medium">{formatRs(taxAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Discount</span>
            <span className="font-medium text-red-500">-{formatRs(discount)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="font-bold text-gray-900">{formatRs(total)}</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
