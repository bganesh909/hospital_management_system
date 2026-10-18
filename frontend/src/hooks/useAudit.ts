import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { auditService } from '../services/auditService';
import type { AuditLogParams } from '../services/auditService';

export function useAuditLogs(params: AuditLogParams) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditService.getAuditLogs(params),
    placeholderData: keepPreviousData,
  });
}

export function useAuditEntityTypes() {
  return useQuery({
    queryKey: ['audit-logs', 'entity-types'],
    queryFn: auditService.getEntityTypes,
    select: (res) => res.data,
  });
}
