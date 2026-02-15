/**
 * API Executor - 负责调用 Internal API
 */

import { config } from './config.js';
import { APIResponse } from './types.js';

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
    queryParams?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseURL}${endpoint}`);

    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          url.searchParams.append(key, value);
        }
      });
    }

    const options: FetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${userToken}`,
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const data = await response.json() as APIResponse<T>;

    if (!data.success) {
      throw new Error(data.error || data.message || 'Unknown error');
    }

    return data.data as T;
  }

  async get<T>(
    endpoint: string,
    userToken: string,
    params?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('GET', endpoint, userToken, undefined, params);
  }

  async post<T>(
    endpoint: string,
    userToken: string,
    body?: unknown
  ): Promise<T> {
    return this.request<T>('POST', endpoint, userToken, body);
  }

  async put<T>(
    endpoint: string,
    userToken: string,
    body?: unknown
  ): Promise<T> {
    return this.request<T>('PUT', endpoint, userToken, body);
  }

  async delete<T>(
    endpoint: string,
    userToken: string
  ): Promise<T> {
    return this.request<T>('DELETE', endpoint, userToken);
  }

  // 不需要认证的请求 (用于register, login)
  async publicPost<T>(endpoint: string, body?: unknown): Promise<T> {
    const url = new URL(`${this.baseURL}${endpoint}`);

    const options: FetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const data = await response.json() as APIResponse<T>;

    if (!data.success) {
      throw new Error(data.error || data.message || 'Unknown error');
    }

    return data.data as T;
  }
}

// Singleton instance
export const apiExecutor = new APIExecutor();
