export interface GiteaConfig {
  baseUrl: string;
  token: string;
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

export class GiteaClient {
  private baseUrl: string;
  private token: string;

  constructor(config: GiteaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.token = config.token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      "Authorization": `token ${this.token}`,
      "Accept": "application/json",
    };

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Gitea API error (${response.status}): ${errorText || response.statusText}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
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
}
