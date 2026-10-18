import { useState } from 'react';
import { Bell, Check, CheckCheck, Mail, Calendar, FlaskConical, CreditCard, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import type { NotificationPreferencesUpdate, Notification } from '../../services/notificationService';
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead, useNotificationPreferences, useUpdateNotificationPreferences } from '../../hooks/useNotifications';

type PrefKey = keyof NotificationPreferencesUpdate;

const typeIcons: Record<string, LucideIcon> = { appointment: Calendar, lab_result: FlaskConical, billing: CreditCard, system: Settings };
const typeColors: Record<string, string> = { appointment: 'bg-blue-100 text-blue-600', lab_result: 'bg-purple-100 text-purple-600', billing: 'bg-green-100 text-green-600', system: 'bg-gray-100 text-gray-600' };

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationList() {
  const [tab, setTab] = useState<'all' | 'unread' | 'settings'>('all');
  const [page] = useState(1);

  const { data, isLoading } = useNotifications({
    page,
    limit: 50,
    ...(tab === 'unread' ? { is_read: false } : {}),
  });
  const { data: unreadData } = useUnreadCount();
  const { data: prefsData } = useNotificationPreferences();
  const markReadMutation = useMarkAsRead();
  const markAllMutation = useMarkAllAsRead();
  const updatePrefsMutation = useUpdateNotificationPreferences();

  const notifications = data?.data || [];
  const unreadCount = unreadData?.data?.unread_count ?? 0;
  const prefs = prefsData?.data;
  const filtered = notifications;

  const togglePref = (key: PrefKey, value: boolean) => {
    updatePrefsMutation.mutate({ [key]: value });
  };

  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${unreadCount} unread`} actions={
        unreadCount > 0 && tab !== 'settings' ? (
          <button onClick={() => markAllMutation.mutate()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <CheckCheck size={16} /> Mark All Read
          </button>
        ) : undefined
      } />

      <div className="flex gap-3 mb-6">
        {(['all', 'unread', 'settings'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t === 'unread' && unreadCount > 0 ? `Unread (${unreadCount})` : t === 'settings' ? 'Preferences' : t}
          </button>
        ))}
      </div>

      {tab !== 'settings' ? (
        <div className="space-y-2">
          {isLoading ? <LoadingSpinner className="py-12" /> : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <Bell size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-600">{tab === 'unread' ? 'No unread notifications' : 'No notifications'}</p>
            </div>
          ) : filtered.map((n: Notification) => {
            const Icon = typeIcons[n.type] || Bell;
            const color = typeColors[n.type] || 'bg-gray-100 text-gray-600';
            return (
              <div key={n.id} onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
                className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer ${n.is_read ? 'bg-white border-gray-200' : 'bg-blue-50/50 border-blue-200 hover:bg-blue-50'}`}>
                <div className={`p-2 rounded-lg ${color}`}><Icon size={18} /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>{n.title}</p>
                    {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                    {(n.sent_via === 'email' || n.sent_via === 'both') && <span className="flex items-center gap-1 text-xs text-gray-400"><Mail size={12} /> Emailed</span>}
                  </div>
                </div>
                {!n.is_read && (
                  <button onClick={(e) => { e.stopPropagation(); markReadMutation.mutate(n.id); }} className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"><Check size={16} /></button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Email Preferences</h3>
          <div className="space-y-4">
            {([
              { key: 'appointment_email', label: 'Appointments', desc: 'Reminders for upcoming appointments', icon: Calendar },
              { key: 'lab_result_email', label: 'Lab Results', desc: 'When results are ready', icon: FlaskConical },
              { key: 'billing_email', label: 'Billing', desc: 'Invoice and payment updates', icon: CreditCard },
              { key: 'system_email', label: 'System', desc: 'System announcements', icon: Settings },
            ] as { key: PrefKey; label: string; desc: string; icon: LucideIcon }[]).map(({ key, label, desc, icon: I }) => (
              <div key={key} className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  <I size={20} className="text-gray-400" />
                  <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
                </div>
                <button onClick={() => togglePref(key, !prefs?.[key])} className={`relative w-11 h-6 rounded-full transition-colors ${prefs?.[key] ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs?.[key] ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
