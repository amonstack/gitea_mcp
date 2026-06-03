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
}
