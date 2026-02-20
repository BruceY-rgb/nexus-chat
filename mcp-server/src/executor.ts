/**
 * API Executor - 负责调用 Internal API
 */

import { config } from "./config.js";

interface FetchOptions extends RequestInit {
  headers: Record<string, string>;
}

export class APIExecutor {
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || config.INTERNAL_API_URL;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    userToken: string,
    body?: unknown,
    queryParams?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.baseURL}${endpoint}`);

    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          url.searchParams.append(key, value);
        }
      });
    }

    const options: FetchOptions = {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: `auth_token=${userToken}`,
      },
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = (await response.json()) as {
          message?: string;
          error?: string;
        };
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as Record<string, unknown>;

    // Auth endpoints return {success, data, message} wrapper; others return data directly
    if ("success" in data) {
      if (!data.success) {
        throw new Error(
          (data.error as string) || (data.message as string) || "Unknown error",
        );
      }
      return data.data as T;
    }

    return data as T;
  }

  async get<T>(
    endpoint: string,
    userToken: string,
    params?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>("GET", endpoint, userToken, undefined, params);
  }

  async post<T>(
    endpoint: string,
    userToken: string,
    body?: unknown,
  ): Promise<T> {
    return this.request<T>("POST", endpoint, userToken, body);
  }

  async put<T>(
    endpoint: string,
    userToken: string,
    body?: unknown,
  ): Promise<T> {
    return this.request<T>("PUT", endpoint, userToken, body);
  }

  async patch<T>(
    endpoint: string,
    userToken: string,
    body?: unknown,
  ): Promise<T> {
    return this.request<T>("PATCH", endpoint, userToken, body);
  }

  async delete<T>(endpoint: string, userToken: string): Promise<T> {
    return this.request<T>("DELETE", endpoint, userToken);
  }

  // 不需要认证的请求 (用于register, login)
  async publicPost<T>(endpoint: string, body?: unknown): Promise<T> {
    const url = new URL(`${this.baseURL}${endpoint}`);

    const options: FetchOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = (await response.json()) as {
          message?: string;
          error?: string;
        };
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    // Extract token from set-cookie header for login/register
    const setCookie = response.headers.get("set-cookie");
    let token: string | undefined;
    if (setCookie) {
      const match = setCookie.match(/auth_token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }

    const data = (await response.json()) as Record<string, unknown>;

    // Auth endpoints return {success, data, message} wrapper; others return data directly
    if ("success" in data) {
      if (!data.success) {
        throw new Error(
          (data.error as string) || (data.message as string) || "Unknown error",
        );
      }
      const result = data.data as Record<string, unknown>;
      // Attach token if extracted from cookie
      if (token && typeof result === "object" && result !== null) {
        result.token = token;
      }
      return result as T;
    }

    return data as T;
  }
}

// Singleton instance
export const apiExecutor = new APIExecutor();
