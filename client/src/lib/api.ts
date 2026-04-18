import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export interface Project {
  id: number;
  name: string;
  description: string | null;
  targetUrl: string;
  cronExpression: string;
  cronEnabled: boolean;
  searchKeywords: string[];
  createdAt: string;
}

export interface ProjectDetail extends Project {
  lastRun: ScriptRun | null;
}

export type NoticeStatus = "new" | "details_collected" | "rejected" | "error";

export interface Notice {
  id: number;
  projectId: number;
  noticeId: string;
  organizer: string | null;
  title: string | null;
  searchKeyword: string | null;
  status: NoticeStatus;
  details: Record<string, unknown> | null;
  collectedAt: string | null;
  updatedAt: string;
}

export interface NoticeListResponse {
  rows: Notice[];
  page: number;
  pageSize: number;
  total: number;
}

export type ScriptRunStatus = "running" | "success" | "error" | "cancelled";

export interface ScriptRun {
  id: number;
  projectId: number;
  noticeId: number | null;
  scriptName: string;
  status: ScriptRunStatus;
  log: string;
  screenshotPath: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ScriptRunsResponse {
  runs: ScriptRun[];
  total: number;
}

export interface AuthStatus {
  authorized: boolean;
  inProgress: boolean;
  checkedAt: string;
}

export const queries = {
  listProjects: () => api.get<Project[]>("/projects").then((r) => r.data),
  getProject: (id: number) => api.get<ProjectDetail>(`/projects/${id}`).then((r) => r.data),
  listNotices: (id: number, params: { status?: string; page?: number; pageSize?: number }) =>
    api.get<NoticeListResponse>(`/projects/${id}/notices`, { params }).then((r) => r.data),
  listScriptRuns: (id: number, limit = 50, offset = 0) =>
    api.get<ScriptRunsResponse>(`/projects/${id}/script-runs`, { params: { limit, offset } }).then((r) => r.data),
  getScriptRun: (id: number, runId: number) =>
    api.get<ScriptRun>(`/projects/${id}/script-runs/${runId}`).then((r) => r.data),
  authStatus: (id: number) =>
    api.get<AuthStatus>(`/projects/${id}/auth-status`).then((r) => r.data),
};

export const mutations = {
  updateCron: (id: number, body: { cronExpression?: string; cronEnabled?: boolean }) =>
    api.patch<Project>(`/projects/${id}/cron`, body).then((r) => r.data),
  updateKeywords: (id: number, searchKeywords: string[]) =>
    api.patch<Project>(`/projects/${id}/keywords`, { searchKeywords }).then((r) => r.data),
  rejectNotice: (projectId: number, noticeRowId: number) =>
    api.patch<Notice>(`/projects/${projectId}/notices/${noticeRowId}/reject`).then((r) => r.data),
  collectNotice: (projectId: number, noticeRowId: number) =>
    api.post<{ runId: number }>(`/projects/${projectId}/notices/${noticeRowId}/collect`).then((r) => r.data),
  bulkCollect: (projectId: number) =>
    api.post<{ runIds: number[] }>(`/projects/${projectId}/run/step2/bulk`).then((r) => r.data),
  runStep1: (projectId: number) =>
    api.post<{ runId: number }>(`/projects/${projectId}/run/step1`).then((r) => r.data),
  startAuth: (projectId: number) =>
    api.post<{ status: string; pid: number }>(`/projects/${projectId}/authorize`).then((r) => r.data),
  stopAuth: (projectId: number) =>
    api.delete<{ status: string }>(`/projects/${projectId}/authorize`).then((r) => r.data),
  stopRun: (projectId: number, runId: number) =>
    api
      .post<{ ok: true; alreadyFinished?: boolean }>(
        `/projects/${projectId}/script-runs/${runId}/stop`,
      )
      .then((r) => r.data),
  stopAll: (projectId: number) =>
    api
      .post<{
        ok: true;
        cronDisabled: boolean;
        cancelledRuns: number;
        totalRunning: number;
      }>(`/projects/${projectId}/stop-all`)
      .then((r) => r.data),
};
