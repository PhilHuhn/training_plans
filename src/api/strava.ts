import apiClient from './client'

export const stravaApi = {
  getAuthUrl: () => apiClient.get<{ auth_url: string }>('/strava/auth-url'),

  disconnect: () => apiClient.post('/strava/disconnect'),

  sync: (days_back = 90) =>
    apiClient.post<{ message: string; count: number }>('/strava/sync', null, {
      params: { days_back },
    }),
}
