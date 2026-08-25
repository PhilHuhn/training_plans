import apiClient from './client'

export const stravaApi = {
  /**
   * `returnTo` is a key, not a path — the server resolves it against a
   * whitelist because it round-trips through Strava.
   */
  getAuthUrl: (returnTo?: 'settings' | 'welcome') =>
    apiClient.get<{ auth_url: string }>('/strava/auth-url', {
      params: returnTo ? { return_to: returnTo } : undefined,
    }),

  disconnect: () => apiClient.post('/strava/disconnect'),

  sync: (days_back = 90) =>
    apiClient.post<{ message: string; count: number }>('/strava/sync', null, {
      params: { days_back },
    }),
}
