import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Plus, AlertCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { SearchInput } from '../../components/shared/SearchInput';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Modal } from '../../components/shared/Modal';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import { useLabRequests, useCreateLabRequest, useUpdateRequestStatus, useUpdateItemResult, useTestCatalog } from '../../hooks/useLaboratory';
import type { LabPriority, LabRequest, LabRequestItem, LabRequestStatus, LabResultStatus, TestCatalogItem } from '../../services/laboratoryService';
import { PatientPicker } from '../../components/shared/PatientPicker';
import { DoctorPicker } from '../../components/shared/DoctorPicker';
import { LabReportModal } from './LabReportModal';

export default function LabRequestListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showResult, setShowResult] = useState<LabRequest | null>(null);
  const [showReport, setShowReport] = useState<LabRequest | null>(null);
  const [formData, setFormData] = useState({ patient_id: '', doctor_id: '', priority: 'normal' as LabPriority, notes: '', test_ids: [] as string[] });
  const [resultData, setResultData] = useState({ item_id: '', result_value: '', result_status: 'normal' as LabResultStatus, remarks: '' });

  const { data, isLoading } = useLabRequests({ page, limit: 20, status: statusFilter || undefined, search: search || undefined });
  const { data: catalog } = useTestCatalog({ page: 1, limit: 100, is_active: true });
  const createMutation = useCreateLabRequest();
  const statusMutation = useUpdateRequestStatus();
  const resultMutation = useUpdateItemResult();

  const tabs = [
    { label: 'All', value: '' },
    { label: 'Requested', value: 'requested' },
    { label: 'Sample Collected', value: 'sample_collected' },
    { label: 'Processing', value: 'processing' },
    { label: 'Completed', value: 'completed' },
  ];

  const columns = [
    { key: 'request_number', label: 'Request #' },
    {
      key: 'patient_name', label: 'Patient', render: (r: LabRequest) => (
        <div>
          <p className="font-medium text-gray-900">{r.patient_name || '—'}</p>
          {r.patient_number && <p className="text-xs text-gray-500">{r.patient_number}</p>}
        </div>
      )
    },
    { key: 'doctor_name', label: 'Doctor', render: (r: LabRequest) => r.doctor_name || '—' },
    {
      key: 'items', label: 'Tests', render: (r: LabRequest) => (
        <span className="text-xs text-gray-600">{r.items.map((i) => i.test_name || i.test_code).filter(Boolean).join(', ') || '—'}</span>
      )
    },
    {
      key: 'priority', label: 'Priority', render: (r: any) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.priority === 'stat' ? 'bg-red-100 text-red-700' : r.priority === 'urgent' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
          {r.priority === 'stat' && <AlertCircle size={12} />}
          {r.priority}
        </span>
      )
    },
    { key: 'status', label: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
    { key: 'created_at', label: 'Date', render: (r: any) => new Date(r.created_at).toLocaleDateString() },
    {
      key: 'actions', label: 'Actions', render: (r: any) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {r.status === 'requested' && (
            <button onClick={() => handleStatusChange(r.id, 'sample_collected')} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Collect Sample</button>
          )}
          {r.status === 'sample_collected' && (
            <button onClick={() => handleStatusChange(r.id, 'processing')} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Start Processing</button>
          )}
          {r.status === 'processing' && r.items.some((i: LabRequestItem) => i.result_status === 'pending') && (
            <button onClick={() => openResultEntry(r)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">Enter Result</button>
          )}
          {r.items.some((i: LabRequestItem) => i.result_status !== 'pending') && (
            <button onClick={() => setShowReport(r)} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
              <Eye size={12} /> Report
            </button>
          )}
        </div>
      )
    },
  ];

  const handleStatusChange = (id: string, newStatus: LabRequestStatus) => {
    statusMutation.mutate({ id, status: newStatus });
  };

  const openResultEntry = (request: LabRequest) => {
    const firstPending = request.items.find((i) => i.result_status === 'pending');
    setResultData({ item_id: firstPending?.id || '', result_value: '', result_status: 'normal', remarks: '' });
    setShowResult(request);
  };

  const handleCreateRequest = () => {
    if (!formData.patient_id || !formData.doctor_id || formData.test_ids.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    const { test_ids, notes, ...rest } = formData;
    createMutation.mutate({ ...rest, notes: notes || undefined, items: test_ids.map((test_id) => ({ test_id })) }, {
      onSuccess: () => { setShowCreate(false); setFormData({ patient_id: '', doctor_id: '', priority: 'normal', notes: '', test_ids: [] }); },
    });
  };

  const handleSubmitResult = () => {
    if (!showResult || !resultData.item_id) return;
    if (!resultData.result_value) { toast.error('Result value is required'); return; }
    resultMutation.mutate(
      { itemId: resultData.item_id, data: { result_value: resultData.result_value, result_status: resultData.result_status, remarks: resultData.remarks || undefined } },
      { onSuccess: () => setShowResult(null) }
    );
  };

  const requests = data?.data || [];
  const total = data?.meta?.total || 0;

  return (
    <div>
      <PageHeader
        title="Lab Requests"
        subtitle="Manage laboratory test requests and results"
        actions={
          <>
          <Link to="/laboratory/catalog" className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
            Test Catalog
          </Link>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus size={16} /> New Request
          </button>
          </>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        {tabs.map((tab) => (
          <button key={tab.value} onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${statusFilter === tab.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {tab.label}
          </button>
        ))}
        <div className="ml-auto"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search requests..." className="w-64" /></div>
      </div>

      <DataTable columns={columns} data={requests} totalItems={total} page={page} limit={20} onPageChange={setPage} loading={isLoading} emptyMessage="No lab requests found" />

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Lab Request" size="lg" footer={
        <div className="flex gap-3">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={handleCreateRequest} disabled={createMutation.isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {createMutation.isPending ? 'Creating...' : 'Create Request'}
          </button>
        </div>
      }>
        <div className="space-y-4">
          <FormField label="Patient" required><PatientPicker value={formData.patient_id} onChange={(patientId) => setFormData({ ...formData, patient_id: patientId })} /></FormField>
          <FormField label="Doctor" required><DoctorPicker value={formData.doctor_id} onChange={(doctorId) => setFormData({ ...formData, doctor_id: doctorId })} /></FormField>
          <FormField label="Priority">
            <Select options={[{ value: 'normal', label: 'Normal' }, { value: 'urgent', label: 'Urgent' }, { value: 'stat', label: 'STAT' }]} value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as LabPriority })} />
          </FormField>
          <FormField label="Tests" required>
            <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
              {(catalog?.data || []).map((test: TestCatalogItem) => (
                <label key={test.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input type="checkbox" checked={formData.test_ids.includes(test.id)} onChange={(e) => {
                    setFormData({ ...formData, test_ids: e.target.checked ? [...formData.test_ids, test.id] : formData.test_ids.filter((id) => id !== test.id) });
                  }} className="rounded border-gray-300" />
                  <span className="text-sm">{test.name}</span>
                  <span className="text-xs text-gray-500 ml-auto">{test.test_code} - ${test.price}</span>
                </label>
              ))}
            </div>
          </FormField>
          <FormField label="Clinical Notes"><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></FormField>
        </div>
      </Modal>

      {/* Result Entry Modal */}
      <Modal open={!!showResult} onClose={() => setShowResult(null)} title="Enter Test Result" footer={
        <div className="flex gap-3">
          <button onClick={() => setShowResult(null)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={handleSubmitResult} disabled={resultMutation.isPending} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {resultMutation.isPending ? 'Saving...' : 'Save Result'}
          </button>
        </div>
      }>
        <div className="space-y-4">
          <FormField label="Test" required>
            <Select
              options={(showResult?.items || []).filter((i) => i.result_status === 'pending').map((i) => ({ value: i.id, label: `${i.test_name || 'Test'}${i.test_code ? ` (${i.test_code})` : ''}` }))}
              value={resultData.item_id}
              onChange={(e) => setResultData({ ...resultData, item_id: e.target.value })}
            />
          </FormField>
          {(() => {
            const item = showResult?.items.find((i) => i.id === resultData.item_id);
            return item?.normal_range ? (
              <p className="text-xs text-gray-500">Normal range: {item.normal_range} {item.unit || ''}</p>
            ) : null;
          })()}
          <FormField label="Result Value" required><Input value={resultData.result_value} onChange={(e) => setResultData({ ...resultData, result_value: e.target.value })} placeholder="Enter result value" /></FormField>
          <FormField label="Status" required>
            <Select options={[{ value: 'normal', label: 'Normal' }, { value: 'abnormal', label: 'Abnormal' }, { value: 'critical', label: 'Critical' }]} value={resultData.result_status} onChange={(e) => setResultData({ ...resultData, result_status: e.target.value as LabResultStatus })} />
          </FormField>
          <FormField label="Remarks"><Textarea value={resultData.remarks} onChange={(e) => setResultData({ ...resultData, remarks: e.target.value })} /></FormField>
        </div>
      </Modal>
      {showReport && <LabReportModal request={showReport} onClose={() => setShowReport(null)} />}
    </div>
  );
}
