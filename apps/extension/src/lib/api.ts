/** Typed HTTP client for the FastAPI backend. */

export interface CreateMeetingResult {
  id: string;
  workspace_id: string;
  title: string;
  status: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  baseUrl: string,
  path: string,
  token: string,
  init: RequestInit & { workspaceId?: string | null } = {}
): Promise<T> {
  const { workspaceId, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (workspaceId) headers.set("X-Workspace-Id", workspaceId);
  if (rest.body && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, { ...rest, headers });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      // non-JSON error body — keep the status line
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

export async function createMeeting(
  baseUrl: string,
  token: string,
  workspaceId: string | null,
  payload: { title: string; meet_url?: string | null; platform?: string }
): Promise<CreateMeetingResult> {
  const result = await request<{ meeting: CreateMeetingResult }>(baseUrl, "/api/meetings", token, {
    method: "POST",
    body: JSON.stringify(payload),
    workspaceId,
  });
  return result.meeting;
}

export async function uploadChunkHttp(
  baseUrl: string,
  token: string,
  workspaceId: string | null,
  meetingId: string,
  seq: number,
  blob: Blob
): Promise<void> {
  const form = new FormData();
  form.append("seq", String(seq));
  form.append("file", blob, `${seq}.webm`);

  await request(baseUrl, `/api/meetings/${meetingId}/chunks`, token, {
    method: "POST",
    body: form,
    workspaceId,
  });
}

export async function finaliseMeeting(
  baseUrl: string,
  token: string,
  workspaceId: string | null,
  meetingId: string,
  payload: {
    title?: string;
    duration_secs?: number;
    auto_summarise?: boolean;
    template?: string;
  }
): Promise<void> {
  await request(baseUrl, `/api/meetings/${meetingId}/finalise`, token, {
    method: "POST",
    body: JSON.stringify(payload),
    workspaceId,
  });
}

export async function deleteMeeting(
  baseUrl: string,
  token: string,
  workspaceId: string | null,
  meetingId: string
): Promise<void> {
  try {
    await request(baseUrl, `/api/meetings/${meetingId}`, token, {
      method: "DELETE",
      workspaceId,
    });
  } catch {
    // Ignore cleanup error
  }
}

export async function checkHealth(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
