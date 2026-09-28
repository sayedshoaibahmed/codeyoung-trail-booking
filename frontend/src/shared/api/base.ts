export const API_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public message: string,
    public errors?: Array<{ field: string; message: string }>,
    public alternateSlots?: any[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse error if response is not JSON
    }

    throw new ApiError(
      response.status,
      errorData.code || 'UNKNOWN_ERROR',
      errorData.message || `Request failed (HTTP ${response.status}).`,
      errorData.errors,
      errorData.alternateSlots
    );
  }

  // Handle empty responses (like 204 No Content or empty JSON) safely
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}
