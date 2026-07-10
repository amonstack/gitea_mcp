import {
  type CandidateCredential,
  type CandidateSummary,
  buildAuthHeader,
  pickNextAttempt,
  markAttemptFailed,
  markAttemptSucceeded,
  findActiveCandidateIndex,
  summarizeCandidates,
} from "./credentials.js";

export interface GiteaConfig {
  baseUrl: string;
  /**
   * Legacy single-token mode. When `candidates` is omitted, this is wrapped
   * as a one-element candidate list with the `token` scheme (preserving the
   * pre-multi-credential behavior exactly).
   */
  token?: string;
  /**
   * Credential candidates in priority order. When provided, enables the
   * fault-tolerant auth state machine: each candidate × scheme is tried in
   * order until one succeeds, with 401/403 advancing to the next attempt.
   */
  candidates?: CandidateCredential[];
}

/**
 * HTTP error from the Gitea API. Carries `status` as a structured field so
 * callers (the retry loop, tests) can branch on it without parsing the
 * message string (AGENTS.md §2.3 forbids substring-based control flow).
 */
export class GiteaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(`Gitea API error (${status}): ${body || statusText}`);
    this.name = "GiteaApiError";
  }
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  state: string;
  body?: string;
  html_url: string;
  url: string;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  labels: Label[];
  assignee?: User;
  assignees?: User[];
  milestone?: Milestone;
  repository: Repository;
}

export interface Label {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface User {
  id: number;
  login: string;
  full_name?: string;
  avatar_url: string;
  email?: string;
}

export interface Milestone {
  id: number;
  title: string;
  description?: string;
  state: string;
  open_issues: number;
  closed_issues: number;
  due_on?: string;
}

export interface Repository {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
}

export interface Comment {
  id: number;
  body: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: User;
}

export interface Repo {
  id: number;
  full_name: string;
  name: string;
  owner: User;
  description?: string;
  html_url: string;
  default_branch?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateIssueParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  assignee?: string;
  assignees?: string[];
  labels?: number[];
  milestone?: number;
}

export interface UpdateIssueParams {
  owner: string;
  repo: string;
  index: number;
  title?: string;
  body?: string;
  assignee?: string;
  assignees?: string[];
  labels?: number[];
  milestone?: number;
  state?: string;
}

export interface ListIssuesParams {
  owner: string;
  repo: string;
  state?: "open" | "closed" | "all";
  labels?: string;
  page?: number;
  limit?: number;
}

export interface SearchIssuesParams {
  query?: string;
  type?: "issues" | "pulls";
  state?: "open" | "closed" | "all";
  labels?: string;
  page?: number;
  limit?: number;
}

export interface CreateLabelParams {
  owner: string;
  repo: string;
  name: string;
  color: string;
  description?: string;
}

export interface UpdateLabelParams {
  owner: string;
  repo: string;
  id: number;
  name?: string;
  color?: string;
  description?: string;
}

export interface CreateMilestoneParams {
  owner: string;
  repo: string;
  title: string;
  description?: string;
  due_on?: string;
}

export interface UpdateMilestoneParams {
  owner: string;
  repo: string;
  id: number;
  title?: string;
  description?: string;
  due_on?: string;
  state?: string;
}

export interface TopicList {
  topics: string[];
}

export interface ListTopicsParams {
  owner: string;
  repo: string;
  page?: number;
  limit?: number;
}

export interface ReplaceTopicsParams {
  owner: string;
  repo: string;
  topics: string[];
}

export class GiteaClient {
  private baseUrl: string;
  private candidates: CandidateCredential[];

  constructor(config: GiteaConfig) {
    // baseUrl originates from git config files and flows into outbound fetch
    // calls. Parse and validate it, then reconstruct from URL components so
    // only sanitized data — never the raw file string — reaches the network.
    let parsed: URL;
    try {
      parsed = new URL(config.baseUrl);
    } catch {
      throw new Error(`Invalid Gitea baseUrl: ${config.baseUrl}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Gitea baseUrl must use http or https, got: ${parsed.protocol}`);
    }
    let path = parsed.pathname;
    while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    this.baseUrl = `${parsed.protocol}//${parsed.host}${path === "/" ? "" : path}`;
    if (config.candidates && config.candidates.length > 0) {
      // Defensive copy so external mutation cannot desync the state machine.
      this.candidates = config.candidates.map((c) => ({ ...c }));
    } else if (config.token) {
      this.candidates = [
        {
          source: "env",
          secret: config.token,
          schemes: ["token"],
          status: "pending",
          nextSchemeIndex: 0,
        },
      ];
    } else {
      this.candidates = [];
    }
  }

  /**
   * Snapshot of the credential state machine — for the `gitea_status` tool.
   * Secrets are never included; only `secretPresent: boolean` and a masked
   * `username`. See `summarizeCandidates` in `credentials.ts`.
   */
  getCredentialStatus(): {
    candidates: CandidateSummary[];
    activeIndex: number | null;
    totalCandidates: number;
  } {
    return {
      candidates: summarizeCandidates(this.candidates),
      activeIndex: findActiveCandidateIndex(this.candidates),
      totalCandidates: this.candidates.length,
    };
  }

  /**
   * Single HTTP call. Throws `GiteaApiError` on non-2xx so the retry loop can
   * branch on `status` (never on the message string). The `authHeader` is
   * pre-built by the caller from the active candidate + scheme.
   */
  private async doRequest<T>(
    method: string,
    path: string,
    body: unknown,
    authHeader: string | null,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/v1${path}`).href;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (authHeader) headers["Authorization"] = authHeader;

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new GiteaApiError(response.status, response.statusText, errorText);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Auth-aware request entry point. Three modes:
   *
   * 1. Active candidate exists (a prior attempt succeeded): reuse its locked
   *    scheme directly, no iteration.
   * 2. No candidates at all: anonymous request (no Authorization header).
   * 3. Otherwise: iterate (candidate, scheme) pairs in priority order, trying
   *    each until one succeeds. On 401/403 the current attempt is marked
   *    failed and the next is tried; non-auth errors propagate immediately
   *    (we do NOT mask 5xx / network errors as auth failures). When every
   *    candidate × scheme is exhausted, the most recent `GiteaApiError` is
   *    re-thrown so the caller sees the underlying status/body; the
   *    `gitea_status` tool surfaces the full attempt history.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const activeIdx = findActiveCandidateIndex(this.candidates);
    if (activeIdx !== null) {
      const active = this.candidates[activeIdx];
      const scheme = active.activeScheme ?? active.schemes[0];
      return this.doRequest<T>(method, path, body, buildAuthHeader(active, scheme));
    }

    if (this.candidates.length === 0) {
      return this.doRequest<T>(method, path, body, null);
    }

    let lastError: GiteaApiError | null = null;
    while (true) {
      const attempt = pickNextAttempt(this.candidates);
      if (!attempt) {
        // Exhausted. Re-throw the underlying API error so the status/body
        // format is preserved. The gitea_status tool reveals the full
        // candidate × scheme attempt history.
        if (lastError) throw lastError;
        throw new GiteaApiError(0, "", "all credential candidates exhausted");
      }
      const candidate = this.candidates[attempt.candidateIndex];
      try {
        const result = await this.doRequest<T>(
          method,
          path,
          body,
          buildAuthHeader(candidate, attempt.scheme),
        );
        markAttemptSucceeded(this.candidates, attempt.candidateIndex, attempt.scheme);
        return result;
      } catch (err) {
        if (err instanceof GiteaApiError && (err.status === 401 || err.status === 403)) {
          markAttemptFailed(this.candidates, attempt.candidateIndex, `${err.status}`);
          lastError = err;
          continue;
        }
        throw err;
      }
    }
  }

  async listIssues(
    params: ListIssuesParams,
  ): Promise<Issue[]> {
    const searchParams = new URLSearchParams();
    if (params.state) searchParams.set("state", params.state);
    if (params.labels) searchParams.set("labels", params.labels);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));

    const query = searchParams.toString();
    const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/issues${query ? `?${query}` : ""}`;
    return this.request<Issue[]>("GET", path);
  }

  async getIssue(owner: string, repo: string, index: number): Promise<Issue> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${index}`;
    return this.request<Issue>("GET", path);
  }

  async createIssue(params: CreateIssueParams): Promise<Issue> {
    const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/issues`;
    return this.request<Issue>("POST", path, {
      title: params.title,
      body: params.body,
      assignee: params.assignee,
      assignees: params.assignees,
      labels: params.labels,
      milestone: params.milestone,
    });
  }

  async updateIssue(params: UpdateIssueParams): Promise<Issue> {
    const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/issues/${params.index}`;
    return this.request<Issue>("PATCH", path, {
      title: params.title,
      body: params.body,
      assignee: params.assignee,
      assignees: params.assignees,
      labels: params.labels,
      milestone: params.milestone,
      state: params.state,
    });
  }

  async deleteIssue(owner: string, repo: string, index: number): Promise<void> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${index}`;
    return this.request<void>("DELETE", path);
  }

  async searchIssues(params: SearchIssuesParams): Promise<Issue[]> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set("q", params.query);
    if (params.type) searchParams.set("type", params.type);
    if (params.state) searchParams.set("state", params.state);
    if (params.labels) searchParams.set("labels", params.labels);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));

    const query = searchParams.toString();
    const path = `/repos/issues/search${query ? `?${query}` : ""}`;
    return this.request<Issue[]>("GET", path);
  }

  async listComments(
    owner: string,
    repo: string,
    index: number,
  ): Promise<Comment[]> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${index}/comments`;
    return this.request<Comment[]>("GET", path);
  }

  async createComment(
    owner: string,
    repo: string,
    index: number,
    body: string,
  ): Promise<Comment> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${index}/comments`;
    return this.request<Comment>("POST", path, { body });
  }

  async updateComment(
    owner: string,
    repo: string,
    id: number,
    body: string,
  ): Promise<Comment> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${id}`;
    return this.request<Comment>("PATCH", path, { body });
  }

  async deleteComment(
    owner: string,
    repo: string,
    id: number,
  ): Promise<void> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${id}`;
    return this.request<void>("DELETE", path);
  }

  async listLabels(
    owner: string,
    repo: string,
    page?: number,
    limit?: number,
  ): Promise<Label[]> {
    const searchParams = new URLSearchParams();
    if (page) searchParams.set("page", String(page));
    if (limit) searchParams.set("limit", String(limit));

    const query = searchParams.toString();
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/labels${query ? `?${query}` : ""}`;
    return this.request<Label[]>("GET", path);
  }

  async createLabel(params: CreateLabelParams): Promise<Label> {
    const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/labels`;
    return this.request<Label>("POST", path, {
      name: params.name,
      color: params.color,
      description: params.description,
    });
  }

  async updateLabel(params: UpdateLabelParams): Promise<Label> {
    const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/labels/${params.id}`;
    return this.request<Label>("PATCH", path, {
      name: params.name,
      color: params.color,
      description: params.description,
    });
  }

  async deleteLabel(owner: string, repo: string, id: number): Promise<void> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/labels/${id}`;
    return this.request<void>("DELETE", path);
  }

  async addIssueLabels(
    owner: string,
    repo: string,
    index: number,
    labels: string[],
  ): Promise<Label[]> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${index}/labels`;
    return this.request<Label[]>("POST", path, { labels });
  }

  async removeIssueLabel(
    owner: string,
    repo: string,
    index: number,
    id: number,
  ): Promise<void> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${index}/labels/${id}`;
    return this.request<void>("DELETE", path);
  }

  async replaceIssueLabels(
    owner: string,
    repo: string,
    index: number,
    labels: string[],
  ): Promise<Label[]> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${index}/labels`;
    return this.request<Label[]>("PUT", path, { labels });
  }

  async clearIssueLabels(
    owner: string,
    repo: string,
    index: number,
  ): Promise<void> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${index}/labels`;
    return this.request<void>("DELETE", path);
  }

  async listMilestones(
    owner: string,
    repo: string,
    state?: string,
    page?: number,
    limit?: number,
  ): Promise<Milestone[]> {
    const searchParams = new URLSearchParams();
    if (state) searchParams.set("state", state);
    if (page) searchParams.set("page", String(page));
    if (limit) searchParams.set("limit", String(limit));

    const query = searchParams.toString();
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones${query ? `?${query}` : ""}`;
    return this.request<Milestone[]>("GET", path);
  }

  async getMilestone(
    owner: string,
    repo: string,
    id: number,
  ): Promise<Milestone> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones/${id}`;
    return this.request<Milestone>("GET", path);
  }

  async createMilestone(params: CreateMilestoneParams): Promise<Milestone> {
    const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/milestones`;
    return this.request<Milestone>("POST", path, {
      title: params.title,
      description: params.description,
      due_on: params.due_on,
    });
  }

  async updateMilestone(params: UpdateMilestoneParams): Promise<Milestone> {
    const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/milestones/${params.id}`;
    return this.request<Milestone>("PATCH", path, {
      title: params.title,
      description: params.description,
      due_on: params.due_on,
      state: params.state,
    });
  }

  async deleteMilestone(
    owner: string,
    repo: string,
    id: number,
  ): Promise<void> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones/${id}`;
    return this.request<void>("DELETE", path);
  }

  async listMyRepos(page?: number, limit?: number): Promise<Repo[]> {
    const searchParams = new URLSearchParams();
    if (page) searchParams.set("page", String(page));
    if (limit) searchParams.set("limit", String(limit));

    const query = searchParams.toString();
    const path = `/user/repos${query ? `?${query}` : ""}`;
    return this.request<Repo[]>("GET", path);
  }

  async listTopics(params: ListTopicsParams): Promise<TopicList> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));

    const query = searchParams.toString();
    const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/topics${query ? `?${query}` : ""}`;
    return this.request<TopicList>("GET", path);
  }

  async replaceTopics(params: ReplaceTopicsParams): Promise<TopicList> {
    const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/topics`;
    return this.request<TopicList>("PUT", path, { topics: params.topics });
  }

  async addTopic(owner: string, repo: string, topic: string): Promise<void> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/topics/${encodeURIComponent(topic)}`;
    return this.request<void>("PUT", path);
  }

  async removeTopic(owner: string, repo: string, topic: string): Promise<void> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/topics/${encodeURIComponent(topic)}`;
    return this.request<void>("DELETE", path);
  }
}
