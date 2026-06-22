import type { ApiResponse } from '../../shared/types';
import type { OfficeAPI } from '../../preload/api';

declare global {
  interface Window {
    officeAPI: OfficeAPI;
  }
}

export const api: OfficeAPI = (typeof window !== 'undefined' && window.officeAPI)
  ? window.officeAPI
  : ({} as OfficeAPI);

export class ApiError extends Error {
  readonly code?: string;
  readonly response?: ApiResponse<unknown>;

  constructor(message: string, response?: ApiResponse<unknown>, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.response = response;
    this.code = code;
  }
}

export function unwrap<T>(response: ApiResponse<T>): T {
  if (!response) {
    throw new ApiError('Empty API response');
  }
  if (!response.success) {
    throw new ApiError(response.error ?? 'Unknown API error', response as ApiResponse<unknown>);
  }
  if (response.data === undefined) {
    throw new ApiError('API response succeeded but returned no data', response as ApiResponse<unknown>);
  }
  return response.data;
}

export function safeUnwrap<T>(response: ApiResponse<T> | null | undefined, fallback: T): T {
  if (!response || !response.success || response.data === undefined) return fallback;
  return response.data;
}

export async function callApi<T>(promise: Promise<ApiResponse<T>>): Promise<T> {
  const res = await promise;
  return unwrap(res);
}