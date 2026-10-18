import { currencySymbol } from '../../lib/currency';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Invoice, Payment, Refund } from '../../services/billingService';

/** Subset of GET /settings used on the printout; every field is optional so printing works without it. */
export interface HospitalInfo {
  hospital_name?: string;
  tagline?: string | null;
  registration_number?: string | null;
  tax_id?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
}

interface InvoicePrintProps {
  invoice: Invoice;
  payments: Payment[];
  refunds: Refund[];
  hospital?: HospitalInfo | null;
}

const rs = (value: number | null | undefined) =>
  `${currencySymbol()} ${(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const date = (value?: string | null) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');

export function InvoicePrint({ invoice, payments, refunds, hospital }: InvoicePrintProps) {
  const cityLine = [hospital?.city, hospital?.state, hospital?.zip_code].filter(Boolean).join(', ');
  const addressLines = [hospital?.address_line1, hospital?.address_line2, cityLine, hospital?.country].filter(Boolean);
  const contact = [hospital?.phone, hospital?.email, hospital?.website].filter(Boolean).join(' | ');
  const completedPayments = payments.filter((p) => p.status === 'completed' || p.status === 'refunded');

  return (
    <div className="p-10 text-gray-900 text-sm bg-white">
      <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4">
        <div className="flex items-start gap-4">
          {hospital?.logo_url && <img src={hospital.logo_url} alt="" className="h-16 w-16 object-contain" />}
          <div>
            <h1 className="text-2xl font-bold">{hospital?.hospital_name || 'Hospital'}</h1>
            {hospital?.tagline && <p className="text-gray-600">{hospital.tagline}</p>}
            {addressLines.map((line) => (
              <p key={line} className="text-gray-600">{line}</p>
            ))}
            {contact && <p className="text-gray-600">{contact}</p>}
            {(hospital?.registration_number || hospital?.tax_id) && (
              <p className="text-gray-600">
                {hospital?.registration_number && <>Reg. No: {hospital.registration_number} </>}
                {hospital?.tax_id && <>Tax ID: {hospital.tax_id}</>}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold uppercase tracking-wide">Invoice</h2>
          <p className="font-medium">{invoice.invoice_number}</p>
          <p className="text-gray-600">Date: {date(invoice.created_at)}</p>
          {invoice.due_date && <p className="text-gray-600">Due: {date(invoice.due_date)}</p>}
          <p className="mt-1 font-semibold uppercase">{invoice.status}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-gray-500 uppercase text-xs font-semibold">Bill To</p>
        <p className="font-medium text-base">{invoice.patient_name || '-'}</p>
      </div>

      <table className="w-full mt-6 border-collapse">
        <thead>
          <tr className="border-b border-gray-800 text-left">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 pr-2">Type</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            <th className="py-2 pr-2 text-right">Unit Price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item, idx) => (
            <tr key={item.id || idx} className="border-b border-gray-200">
              <td className="py-2 pr-2">{idx + 1}</td>
              <td className="py-2 pr-2">{item.description}</td>
              <td className="py-2 pr-2 capitalize">{item.item_type.replace(/_/g, ' ')}</td>
              <td className="py-2 pr-2 text-right">{item.quantity}</td>
              <td className="py-2 pr-2 text-right">{rs(item.unit_price)}</td>
              <td className="py-2 text-right">{rs(item.total_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-72 space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span>{rs(invoice.subtotal)}</span></div>
        <div className="flex justify-between"><span>Tax</span><span>{rs(invoice.tax_amount)}</span></div>
        {invoice.discount_amount > 0 && (
          <div className="flex justify-between"><span>Discount</span><span>-{rs(invoice.discount_amount)}</span></div>
        )}
        <div className="flex justify-between border-t border-gray-800 pt-1 font-bold">
          <span>Total</span><span>{rs(invoice.total_amount)}</span>
        </div>
        <div className="flex justify-between"><span>Paid</span><span>{rs(invoice.paid_amount)}</span></div>
        <div className="flex justify-between font-bold"><span>Balance Due</span><span>{rs(invoice.due_amount)}</span></div>
      </div>

      {completedPayments.length > 0 && (
        <div className="mt-6">
          <p className="font-semibold mb-1">Payments</p>
          <table className="w-full border-collapse">
            <tbody>
              {completedPayments.map((p) => (
                <tr key={p.id} className="border-b border-gray-200">
                  <td className="py-1 pr-2">{date(p.payment_date)}</td>
                  <td className="py-1 pr-2">{p.payment_number}</td>
                  <td className="py-1 pr-2 capitalize">{p.method.replace(/_/g, ' ')}</td>
                  <td className="py-1 text-right">{rs(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {refunds.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold mb-1">Refunds</p>
          <table className="w-full border-collapse">
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id} className="border-b border-gray-200">
                  <td className="py-1 pr-2">{date(r.refunded_at)}</td>
                  <td className="py-1 pr-2">{r.refund_number}</td>
                  <td className="py-1 pr-2">{r.reason}</td>
                  <td className="py-1 text-right">-{rs(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invoice.notes && (
        <div className="mt-6">
          <p className="font-semibold">Notes</p>
          <p className="whitespace-pre-line text-gray-700">{invoice.notes}</p>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-gray-500">This is a computer-generated invoice.</p>
    </div>
  );
}

/**
 * Print the invoice from a hidden iframe so the app's sidebar and header are not printed.
 * The page's stylesheets are copied in so the Tailwind classes apply.
 */
export function printInvoice(props: InvoicePrintProps) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n');
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${props.invoice.invoice_number}</title>` +
      `<base href="${document.baseURI}">${styles}` +
      `<style>@page { margin: 12mm; } body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>` +
      `</head><body>${renderToStaticMarkup(<InvoicePrint {...props} />)}</body></html>`
  );
  doc.close();

  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  win.addEventListener('afterprint', cleanup, { once: true });
  // Give stylesheets and the logo a moment to load before opening the print dialog
  setTimeout(() => {
    win.focus();
    win.print();
    // Some browsers never fire afterprint for iframes
    setTimeout(cleanup, 60_000);
  }, 400);
}
