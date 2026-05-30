import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sessionApi,
  webhookApi,
  apiKeyApi,
  auditApi,
  infraApi,
  pluginsApi,
  messageApi,
  contactApi,
  scheduledMessageApi,
  templateApi,
  googleSheetsApi,
  type Webhook,
} from '../services/api';

// ── Query Keys ────────────────────────────────────────────────────────

export const queryKeys = {
  sessions: ['sessions'] as const,
  sessionStats: ['sessions', 'stats'] as const,
  sessionGroups: (sessionId: string) => ['sessions', sessionId, 'groups'] as const,
  webhooks: ['webhooks'] as const,
  apiKeys: ['apiKeys'] as const,
  logs: (params: { severity?: string; page: number; limit: number }) =>
    ['logs', params] as const,
  infraStatus: ['infra', 'status'] as const,
  messages: (sessionId: string, chatId?: string) => ['messages', sessionId, chatId] as const,
  contacts: (sessionId: string) => ['contacts', sessionId] as const,
  scheduledMessages: (sessionId?: string) => ['scheduledMessages', sessionId] as const,
  templates: (category?: string) => ['templates', category] as const,
  templateCategories: ['templates', 'categories'] as const,
  plugins: ['plugins'] as const,
  engines: ['engines'] as const,
  currentEngine: ['engines', 'current'] as const,
  googleAccounts: ['google', 'accounts'] as const,
  googleSpreadsheets: (tokenLabel?: string) => ['google', 'spreadsheets', tokenLabel] as const,
};

// ── Session Queries ───────────────────────────────────────────────────

export function useSessionsQuery() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: sessionApi.list,
    staleTime: 30_000,
  });
}

export function useSessionStatsQuery() {
  return useQuery({
    queryKey: queryKeys.sessionStats,
    queryFn: sessionApi.getStats,
    staleTime: 30_000,
  });
}

export function useSessionGroupsQuery(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.sessionGroups(sessionId),
    queryFn: () => sessionApi.getGroups(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 60_000,
  });
}

export function useCreateSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => sessionApi.create(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionStats });
    },
  });
}

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionStats });
    },
  });
}

export function useStartSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionApi.start(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

export function useStopSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionApi.stop(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

// ── Webhook Queries ───────────────────────────────────────────────────

export function useWebhooksQuery() {
  return useQuery({
    queryKey: queryKeys.webhooks,
    queryFn: webhookApi.listAll,
    staleTime: 30_000,
  });
}

export function useCreateWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; url: string; events: string[] }) =>
      webhookApi.create(params.sessionId, { url: params.url, events: params.events }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

export function useUpdateWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; id: string; data: Partial<Webhook> }) =>
      webhookApi.update(params.sessionId, params.id, params.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

export function useDeleteWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; id: string }) =>
      webhookApi.delete(params.sessionId, params.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

// ── API Key Queries ───────────────────────────────────────────────────

export function useApiKeysQuery() {
  return useQuery({
    queryKey: queryKeys.apiKeys,
    queryFn: apiKeyApi.list,
    staleTime: 30_000,
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; role: string; allowedIps?: string[]; allowedSessions?: string[]; expiresAt?: string }) =>
      apiKeyApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

export function useDeleteApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiKeyApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiKeyApi.revoke(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

// ── Logs Queries ──────────────────────────────────────────────────────

export function useLogsQuery(params: { severity?: string; page: number; limit: number }) {
  return useQuery({
    queryKey: queryKeys.logs(params),
    queryFn: () =>
      auditApi.list({
        severity: params.severity,
        limit: params.limit,
        offset: (params.page - 1) * params.limit,
      }),
    staleTime: 15_000,
  });
}

// ── Infrastructure Queries ────────────────────────────────────────────

export function useInfraStatusQuery() {
  return useQuery({
    queryKey: queryKeys.infraStatus,
    queryFn: infraApi.getStatus,
    staleTime: 30_000,
  });
}

// ── Plugin Queries ────────────────────────────────────────────────────

export function usePluginsQuery() {
  return useQuery({
    queryKey: queryKeys.plugins,
    queryFn: pluginsApi.list,
    staleTime: 30_000,
  });
}

export function useEnginesQuery() {
  return useQuery({
    queryKey: queryKeys.engines,
    queryFn: pluginsApi.getEngines,
    staleTime: 60_000,
  });
}

export function useCurrentEngineQuery() {
  return useQuery({
    queryKey: queryKeys.currentEngine,
    queryFn: pluginsApi.getCurrentEngine,
    staleTime: 60_000,
  });
}

// ── Message Queries ──────────────────────────────────────────────────

export function useMessagesQuery(sessionId: string, chatId?: string, limit = 50) {
  return useQuery({
    queryKey: queryKeys.messages(sessionId, chatId),
    queryFn: () => messageApi.getMessages(sessionId, chatId, limit),
    enabled: !!sessionId,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
}

export function useContactMapQuery(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.contacts(sessionId),
    queryFn: () => contactApi.getMap(sessionId),
    enabled: !!sessionId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

// ── Scheduled Messages Queries ──────────────────────────────────────

export function useScheduledMessagesQuery(sessionId?: string) {
  return useQuery({
    queryKey: queryKeys.scheduledMessages(sessionId),
    queryFn: () => scheduledMessageApi.list(sessionId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useCreateScheduledMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { sessionId: string; chatId: string; message: string; scheduledAt: string }) =>
      scheduledMessageApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scheduledMessages'] });
    },
  });
}

export function useUpdateScheduledMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; data: { chatId?: string; message?: string; scheduledAt?: string } }) =>
      scheduledMessageApi.update(params.id, params.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scheduledMessages'] });
    },
  });
}

export function useCancelScheduledMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => scheduledMessageApi.cancel(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scheduledMessages'] });
    },
  });
}

// ── Template Queries ──────────────────────────────────────────────────

export function useTemplatesQuery(category?: string) {
  return useQuery({
    queryKey: queryKeys.templates(category),
    queryFn: () => templateApi.list(category),
    staleTime: 30_000,
  });
}

export function useTemplateCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.templateCategories,
    queryFn: templateApi.getCategories,
    staleTime: 60_000,
  });
}

export function useCreateTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; category?: string; body: string; language?: string }) =>
      templateApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; data: Partial<{ name: string; category: string; body: string; language: string; isActive: boolean }> }) =>
      templateApi.update(params.id, params.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templateApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

// ── Google Sheets Queries ────────────────────────────────────────────

export function useGoogleAccountsQuery() {
  return useQuery({
    queryKey: queryKeys.googleAccounts,
    queryFn: googleSheetsApi.listAccounts,
    staleTime: 30_000,
  });
}

export function useGoogleSpreadsheetsQuery(tokenLabel?: string) {
  return useQuery({
    queryKey: queryKeys.googleSpreadsheets(tokenLabel),
    queryFn: () => googleSheetsApi.listSpreadsheets(tokenLabel),
    staleTime: 30_000,
  });
}

export function useConnectGoogleMutation() {
  return useMutation({
    mutationFn: (label: string) => googleSheetsApi.getAuthUrl(label),
  });
}

export function useRemoveGoogleAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label: string) => googleSheetsApi.removeAccount(label),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.googleAccounts });
    },
  });
}

export function useCreateSpreadsheetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { tokenLabel: string; title: string; sheetNames?: string[]; headers?: string[] }) =>
      googleSheetsApi.createSpreadsheet(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['google', 'spreadsheets'] });
    },
  });
}

export function useDeleteSpreadsheetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { spreadsheetId: string; tokenLabel: string }) =>
      googleSheetsApi.deleteSpreadsheet(params.spreadsheetId, params.tokenLabel),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['google', 'spreadsheets'] });
    },
  });
}

export function useShareSpreadsheetMutation() {
  return useMutation({
    mutationFn: (params: { spreadsheetId: string; data: { tokenLabel: string; emailAddress: string; role?: string; sendNotification?: boolean; message?: string } }) =>
      googleSheetsApi.shareSpreadsheet(params.spreadsheetId, params.data),
  });
}

export function useSendSheetWhatsAppMutation() {
  return useMutation({
    mutationFn: (params: { spreadsheetId: string; data: { tokenLabel: string; sessionId: string; chatId: string; format?: string; caption?: string } }) =>
      googleSheetsApi.sendViaWhatsApp(params.spreadsheetId, params.data),
  });
}

export function useSyncFromDriveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tokenLabel: string) => googleSheetsApi.syncFromDrive(tokenLabel),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['google', 'spreadsheets'] });
    },
  });
}

export function useImportByUrlMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { tokenLabel: string; spreadsheetUrl: string }) =>
      googleSheetsApi.importByUrl(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['google', 'spreadsheets'] });
    },
  });
}
