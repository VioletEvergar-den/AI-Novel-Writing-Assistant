import type { ApiResponse } from "@ai-novel/shared/types/api";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { ModelRouteConfig, ModelRouteTaskType } from "@ai-novel/shared/types/novel";
import { apiClient } from "./client";

export type EmbeddingProvider = Extract<LLMProvider, "openai" | "siliconflow">;

export interface APIKeyStatus {
  provider: LLMProvider;
  name: string;
  currentModel: string;
  models: string[];
  defaultModel: string;
  isConfigured: boolean;
  isActive: boolean;
}

export interface RagProviderStatus {
  provider: EmbeddingProvider;
  name: string;
  isConfigured: boolean;
  isActive: boolean;
}

export interface RagEmbeddingModelStatus {
  provider: EmbeddingProvider;
  name: string;
  models: string[];
  defaultModel: string;
  isConfigured: boolean;
  isActive: boolean;
  source: "remote" | "fallback";
}

export interface RagSettingsStatus {
  embeddingProvider: EmbeddingProvider;
  embeddingModel: string;
  collectionVersion: number;
  collectionMode: "auto" | "manual";
  collectionName: string;
  collectionTag: string;
  autoReindexOnChange: boolean;
  embeddingBatchSize: number;
  embeddingTimeoutMs: number;
  embeddingMaxRetries: number;
  embeddingRetryBaseMs: number;
  suggestedCollectionName: string;
  reindexQueuedCount?: number;
  providers: RagProviderStatus[];
}

export interface ModelRoutesResponse {
  taskTypes: ModelRouteTaskType[];
  routes: Array<{
    taskType: string;
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number | null;
  }>;
}

export interface ModelRouteConnectivityStatus {
  taskType: ModelRouteTaskType;
  provider: string;
  model: string;
  ok: boolean;
  latency: number | null;
  error: string | null;
}

export interface ModelRouteConnectivityResponse {
  testedAt: string;
  statuses: ModelRouteConnectivityStatus[];
}

export async function getAPIKeySettings() {
  const { data } = await apiClient.get<ApiResponse<APIKeyStatus[]>>("/settings/api-keys");
  return data;
}

export async function getRagSettings() {
  const { data } = await apiClient.get<ApiResponse<RagSettingsStatus>>("/settings/rag");
  return data;
}

export async function saveRagSettings(payload: {
  embeddingProvider: EmbeddingProvider;
  embeddingModel: string;
  collectionMode: "auto" | "manual";
  collectionName: string;
  collectionTag: string;
  autoReindexOnChange: boolean;
  embeddingBatchSize: number;
  embeddingTimeoutMs: number;
  embeddingMaxRetries: number;
  embeddingRetryBaseMs: number;
}) {
  const { data } = await apiClient.put<
    ApiResponse<
      Pick<
        RagSettingsStatus,
        | "embeddingProvider"
        | "embeddingModel"
        | "collectionVersion"
        | "collectionMode"
        | "collectionName"
        | "collectionTag"
        | "autoReindexOnChange"
        | "embeddingBatchSize"
        | "embeddingTimeoutMs"
        | "embeddingMaxRetries"
        | "embeddingRetryBaseMs"
        | "suggestedCollectionName"
        | "reindexQueuedCount"
      >
    >
  >("/settings/rag", payload);
  return data;
}

export async function getRagEmbeddingModels(provider: EmbeddingProvider) {
  const { data } = await apiClient.get<ApiResponse<RagEmbeddingModelStatus>>(`/settings/rag/models/${provider}`);
  return data;
}

export async function saveAPIKeySetting(
  provider: LLMProvider,
  payload: {
    key: string;
    model?: string;
    isActive?: boolean;
  },
) {
  const { data } = await apiClient.put<
    ApiResponse<{
      provider: string;
      model: string | null;
      isActive: boolean;
      models: string[];
    }>
  >(`/settings/api-keys/${provider}`, payload);
  return data;
}

export async function refreshProviderModelList(provider: LLMProvider) {
  const { data } = await apiClient.post<
    ApiResponse<{
      provider: string;
      models: string[];
      currentModel: string;
    }>
  >(`/settings/api-keys/${provider}/refresh-models`);
  return data;
}

export async function getLLMProviders() {
  const { data } = await apiClient.get<ApiResponse<Record<string, unknown>>>("/llm/providers");
  return data;
}

export async function getModelRoutes() {
  const { data } = await apiClient.get<ApiResponse<ModelRoutesResponse>>("/llm/model-routes");
  return data;
}

export async function testModelRouteConnectivity() {
  const { data } = await apiClient.post<ApiResponse<ModelRouteConnectivityResponse>>("/llm/model-routes/connectivity");
  return data;
}

export async function saveModelRoute(payload: ModelRouteConfig) {
  const { data } = await apiClient.put<ApiResponse<null>>("/llm/model-routes", payload);
  return data;
}

export async function testLLMConnection(payload: { provider: LLMProvider; apiKey?: string; model?: string }) {
  const { data } = await apiClient.post<
    ApiResponse<{
      success: boolean;
      model: string;
      latency: number;
    }>
  >("/llm/test", payload);
  return data;
}

export interface WebDAVConfig {
  serverUrl: string;
  username: string;
  password: string;
  remotePath: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  syncOnStartup: boolean;
  isConfigured: boolean;
}

export interface WebDAVSyncStatus {
  isConfigured: boolean;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  syncOnStartup: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "failed" | null;
  lastSyncError: string | null;
  localDatabaseMtime: number | null;
  remoteDatabaseMtime: number | null;
}

export interface SyncResult {
  success: boolean;
  message: string;
  direction?: "upload" | "download" | "none";
  localMtime?: number;
  remoteMtime?: number;
  syncedAt: string;
}

export async function getWebDAVConfig() {
  const { data } = await apiClient.get<ApiResponse<WebDAVConfig>>("/webdav/config");
  return data;
}

export async function saveWebDAVConfig(payload: Omit<WebDAVConfig, "isConfigured">) {
  const { data } = await apiClient.post<ApiResponse<WebDAVConfig>>("/webdav/config", payload);
  return data;
}

export async function deleteWebDAVConfig() {
  const { data } = await apiClient.delete<ApiResponse<null>>("/webdav/config");
  return data;
}

export async function testWebDAVConnection(payload: {
  serverUrl: string;
  username: string;
  password: string;
  remotePath: string;
}) {
  const { data } = await apiClient.post<ApiResponse<null>>("/webdav/test", payload);
  return data;
}

export async function syncWebDAV(direction?: "upload" | "download" | "auto") {
  const { data } = await apiClient.post<ApiResponse<SyncResult>>("/webdav/sync", { direction });
  return data;
}

export async function getWebDAVSyncStatus() {
  const { data } = await apiClient.get<ApiResponse<WebDAVSyncStatus>>("/webdav/status");
  return data;
}
