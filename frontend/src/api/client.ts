/**
 * Type-safe API client for Recall backend
 */

import type {
  SessionListResponse,
  SessionDetailsResponse,
  SessionEventsResponse,
  HealthCheckResponse,
  SessionListQuery,
  SessionEventsQuery,
  ApiError,
  SessionEvent,
  Observation,
  UserPrompt,
} from '../../../shared/types';

/**
 * API Client configuration
 */
export interface ApiClientConfig {
  baseUrl?: string;
  timeout?: number;
}

/**
 * API Client error class
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ApiClientConfig> = {
  baseUrl: 'http://localhost:3001',
  timeout: 30000,
};

/**
 * API Client class
 */
export class ApiClient {
  private config: Required<ApiClientConfig>;

  constructor(config: ApiClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Internal fetch wrapper with error handling
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData: ApiError;
        try {
          errorData = await response.json();
        } catch {
          errorData = {
            error: response.statusText,
            statusCode: response.status,
          };
        }

        throw new ApiClientError(
          errorData.message || errorData.error,
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiClientError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiClientError('Request timeout', 408);
        }
        throw new ApiClientError(error.message);
      }

      throw new ApiClientError('Unknown error occurred');
    }
  }

  /**
   * Build query string from parameters
   */
  private buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Health check endpoint
   * GET /api/health
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.fetch<HealthCheckResponse>('/api/health');
  }

  /**
   * List sessions with optional filtering
   * GET /api/sessions?offset=0&limit=20&project=...&dateStart=...&dateEnd=...
   */
  async listSessions(
    query: SessionListQuery = {}
  ): Promise<SessionListResponse> {
    const queryString = this.buildQueryString(query);
    return this.fetch<SessionListResponse>(`/api/sessions${queryString}`);
  }

  /**
   * Get session details by ID
   * GET /api/sessions/:id
   */
  async getSession(id: string | number): Promise<SessionDetailsResponse> {
    return this.fetch<SessionDetailsResponse>(`/api/sessions/${id}`);
  }

  /**
   * Get session events with optional filtering
   * GET /api/sessions/:id/events?offset=0&limit=100&types=...&afterTs=...
   */
  async getSessionEvents(
    id: string | number,
    query: SessionEventsQuery = {}
  ): Promise<SessionEventsResponse> {
    const queryString = this.buildQueryString(query);
    return this.fetch<SessionEventsResponse>(
      `/api/sessions/${id}/events${queryString}`
    );
  }

  /**
   * Get a specific event by type and ID
   * GET /api/sessions/:sessionId/events/:eventType/:eventId
   */
  async getEvent(
    sessionId: string | number,
    eventType: 'prompt' | 'observation',
    eventId: string | number
  ): Promise<SessionEvent | Observation | UserPrompt> {
    return this.fetch<SessionEvent | Observation | UserPrompt>(
      `/api/sessions/${sessionId}/events/${eventType}/${eventId}`
    );
  }

  /**
   * Update base URL (useful for testing or different environments)
   */
  setBaseUrl(baseUrl: string): void {
    this.config.baseUrl = baseUrl;
  }

  /**
   * Update timeout
   */
  setTimeout(timeout: number): void {
    this.config.timeout = timeout;
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();

/**
 * Named exports for convenience
 */
export const {
  healthCheck,
  listSessions,
  getSession,
  getSessionEvents,
  getEvent,
} = {
  healthCheck: () => apiClient.healthCheck(),
  listSessions: (query?: SessionListQuery) => apiClient.listSessions(query),
  getSession: (id: string | number) => apiClient.getSession(id),
  getSessionEvents: (id: string | number, query?: SessionEventsQuery) =>
    apiClient.getSessionEvents(id, query),
  getEvent: (
    sessionId: string | number,
    eventType: 'prompt' | 'observation',
    eventId: string | number
  ) => apiClient.getEvent(sessionId, eventType, eventId),
};
