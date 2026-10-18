import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search, UserPlus, X } from 'lucide-react';
import { useUnlinkedUsers } from '../../hooks/useUsers';
import type { User, UserRole } from '../../types/auth.types';

interface UserPickerProps {
  /** Which profile table the user must not already be linked to */
  link: 'doctor' | 'staff';
  roles?: UserRole[];
  value: string;
  onChange: (userId: string, user?: User) => void;
  error?: boolean;
  disabled?: boolean;
  /** Shown instead of the search when disabled (e.g. editing an existing record) */
  selectedLabel?: string;
  onCreateNew?: () => void;
  /** Lets the parent preselect a user it already has (e.g. one just created inline) */
  selectedUser?: User | null;
  placeholder?: string;
}

const userLabel = (u: User) => `${u.full_name} (${u.email})`;

export function UserPicker({
  link,
  roles,
  value,
  onChange,
  error,
  disabled,
  selectedLabel,
  onCreateNew,
  selectedUser,
  placeholder = 'Search user by name or email...',
}: UserPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<User | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Form reset clears the value; drop the cached selection with it
  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  useEffect(() => {
    if (selectedUser && selectedUser.id === value) setSelected(selectedUser);
  }, [selectedUser, value]);

  const { data, isLoading } = useUnlinkedUsers(
    { link, role: roles, search: debounced || undefined, limit: 20 },
    open && !disabled,
  );
  const users: User[] = data?.data ?? [];

  const borderClass = error ? 'border-red-300 bg-red-50' : 'border-gray-300';

  if (disabled) {
    return (
      <div className={`w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-gray-600 ${borderClass}`}>
        {selectedLabel || (selected ? userLabel(selected) : value) || '—'}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      {selected && value ? (
        <div className={`flex items-center justify-between w-full px-3 py-2 border rounded-lg text-sm ${borderClass}`}>
          <span className="truncate text-gray-900">{userLabel(selected)}</span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              onChange('');
              setOpen(true);
            }}
            className="ml-2 text-gray-400 hover:text-gray-600"
            title="Clear"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className={`w-full pl-9 pr-8 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${borderClass}`}
          />
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      )}

      {open && !(selected && value) && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Loading users...
            </div>
          ) : users.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500">
              No available users{debounced ? ' match your search' : ''}. Users already linked to a{' '}
              {link === 'doctor' ? 'doctor' : 'staff'} profile are hidden.
            </p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setSelected(u);
                  setSearch('');
                  setOpen(false);
                  onChange(u.id, u);
                }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0"
              >
                <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                <p className="text-xs text-gray-500">
                  {u.email} · <span className="capitalize">{u.role.replace(/_/g, ' ')}</span>
                </p>
              </button>
            ))
          )}
          {onCreateNew && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreateNew();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 border-t border-gray-100"
            >
              <UserPlus size={14} /> Create new user account
            </button>
          )}
        </div>
      )}
    </div>
  );
}
