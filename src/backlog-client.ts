export interface WikiPage {
  id: number;
  projectId: number;
  name: string;
  content: string;
  tags: { id: number; name: string }[];
  attachments: WikiAttachment[];
  createdUser: { id: number; name: string };
  created: string;
  updatedUser: { id: number; name: string };
  updated: string;
}

export interface WikiPageSummary {
  id: number;
  projectId: number;
  name: string;
  tags: { id: number; name: string }[];
  createdUser: { id: number; name: string };
  created: string;
  updatedUser: { id: number; name: string };
  updated: string;
}

export interface WikiAttachment {
  id: number;
  name: string;
  size: number;
  createdUser: { id: number; name: string };
  created: string;
}

export class BacklogClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(space: string, apiKey: string) {
    this.baseUrl = `https://${space}/api/v2`;
    this.apiKey = apiKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.baseUrl}${path}${separator}apiKey=${this.apiKey}`;

    const response = await fetch(url, options);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Backlog API error: ${response.status} ${response.statusText}\n${body}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private async requestBinary(path: string): Promise<{
    data: ArrayBuffer;
    filename: string;
  }> {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.baseUrl}${path}${separator}apiKey=${this.apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Backlog API error: ${response.status} ${response.statusText}\n${body}`,
      );
    }

    const contentDisposition = response.headers.get("content-disposition");
    let filename = "unknown";
    if (contentDisposition) {
      const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?(.+)/i);
      if (match) {
        filename = decodeURIComponent(match[1].replace(/"/g, ""));
      }
    }

    const data = await response.arrayBuffer();
    return { data, filename };
  }

  async getWikiList(projectIdOrKey: string): Promise<WikiPageSummary[]> {
    return this.request<WikiPageSummary[]>(
      `/wikis?projectIdOrKey=${encodeURIComponent(projectIdOrKey)}`,
    );
  }

  async getWiki(wikiId: number): Promise<WikiPage> {
    return this.request<WikiPage>(`/wikis/${wikiId}`);
  }

  async createWiki(
    projectId: number,
    name: string,
    content: string,
  ): Promise<WikiPage> {
    return this.request<WikiPage>("/wikis", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        projectId: String(projectId),
        name,
        content,
      }),
    });
  }

  async updateWiki(wikiId: number, content: string): Promise<WikiPage> {
    return this.request<WikiPage>(`/wikis/${wikiId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ content }),
    });
  }

  async getAttachment(
    wikiId: number,
    attachmentId: number,
  ): Promise<{ data: ArrayBuffer; filename: string }> {
    return this.requestBinary(
      `/wikis/${wikiId}/attachments/${attachmentId}`,
    );
  }
}

export function resolveApiKey(optionApiKey?: string): string {
  const apiKey = optionApiKey || process.env.BACKLOG_API_KEY;
  if (!apiKey) {
    throw new Error(
      "API キーが指定されていません。--api-key オプションまたは環境変数 BACKLOG_API_KEY を設定してください。",
    );
  }
  return apiKey;
}
