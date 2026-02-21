const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions extends RequestInit {
  token?: string;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "An error occurred" }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    request<{ access_token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<{ access_token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMe: (token: string) =>
    request<User>("/api/auth/me", { token }),
};

// Activities API
export const activitiesApi = {
  getAll: (token: string, params?: { start_date?: string; end_date?: string }) => {
    const queryString = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    return request<ActivityListResponse>(`/api/activities${queryString}`, { token });
  },

  getStats: (token: string, params?: { start_date?: string; end_date?: string }) => {
    const queryString = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    return request<ActivityStats>(`/api/activities/stats/summary${queryString}`, { token });
  },
};

// Strava API
export const stravaApi = {
  getAuthUrl: (token: string) =>
    request<{ auth_url: string }>("/api/strava/auth-url", { token }),

  callback: (token: string, code: string, state: string) =>
    request<{ message: string; athlete_id: number }>("/api/strava/callback", {
      method: "POST",
      token,
      body: JSON.stringify({ code, state }),
    }),

  sync: (token: string) =>
    request<{ message: string }>("/api/strava/sync", {
      method: "POST",
      token,
    }),

  disconnect: (token: string) =>
    request<{ message: string }>("/api/strava/disconnect", {
      method: "POST",
      token,
    }),
};

// Competitions API
export const competitionsApi = {
  getAll: (token: string, includePast = false) =>
    request<Competition[]>(`/api/competitions?include_past=${includePast}`, { token }),

  create: (token: string, data: CompetitionCreate) =>
    request<Competition>("/api/competitions", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  update: (token: string, id: number, data: Partial<CompetitionCreate>) =>
    request<Competition>(`/api/competitions/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: number) =>
    request<void>(`/api/competitions/${id}`, {
      method: "DELETE",
      token,
    }),
};

// Training API
export const trainingApi = {
  getSessions: (token: string, params?: { start_date?: string; end_date?: string }) => {
    const queryString = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    return request<TrainingSession[]>(`/api/training/sessions${queryString}`, { token });
  },

  getWeek: (token: string, weekStart?: string) => {
    const queryString = weekStart ? `?week_start=${weekStart}` : "";
    return request<TrainingWeekResponse>(`/api/training/sessions/week${queryString}`, { token });
  },

  createSession: (token: string, data: TrainingSessionCreate) =>
    request<TrainingSession>("/api/training/sessions", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  updateSession: (token: string, id: number, data: TrainingSessionUpdate) =>
    request<TrainingSession>(`/api/training/sessions/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(data),
    }),

  deleteSession: (token: string, id: number) =>
    request<void>(`/api/training/sessions/${id}`, {
      method: "DELETE",
      token,
    }),

  generateRecommendations: (token: string, data: { start_date: string; end_date: string }) =>
    request<RecommendationsResponse>("/api/training/generate-recommendations", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  convertSession: (token: string, data: { workout: WorkoutDetails; target_type: string }) =>
    request<ConvertSessionResponse>("/api/training/convert-session", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  uploadPlan: async (token: string, file: File, startDate?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (startDate) {
      formData.append("start_date", startDate);
    }

    const response = await fetch(`${API_URL}/api/training/upload-plan`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(error.detail);
    }

    return response.json() as Promise<UploadedPlan>;
  },

  getUploadedPlans: (token: string) =>
    request<UploadedPlan[]>("/api/training/uploaded-plans", { token }),

  deleteUploadedPlan: (token: string, id: number) =>
    request<void>(`/api/training/uploaded-plans/${id}`, {
      method: "DELETE",
      token,
    }),
};

// Types
export interface User {
  id: number;
  email: string;
  name: string;
  preferences: UserPreferences;
  strava_connected: boolean;
  created_at: string;
}

export interface UserPreferences {
  units: string;
  hr_zones: Record<string, { min: number; max: number; name: string }>;
  pace_zones: Record<string, { min: number; max: number; name: string }>;
  max_hr: number;
  resting_hr: number;
}

export interface Activity {
  id: number;
  strava_id?: string;
  name: string;
  activity_type: string;
  description?: string;
  distance?: number;
  duration?: number;
  elevation_gain?: number;
  calories?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  avg_pace?: number;
  start_date: string;
  start_date_local?: string;
}

export interface ActivityListResponse {
  activities: Activity[];
  total: number;
  page: number;
  per_page: number;
}

export interface ActivityStats {
  total_activities: number;
  total_distance_km: number;
  total_duration_hours: number;
  total_elevation_m: number;
  avg_heart_rate: number;
  avg_pace_per_km: number;
}

export interface Competition {
  id: number;
  name: string;
  race_type: string;
  race_date: string;
  distance?: number;
  elevation_gain?: number;
  location?: string;
  goal_time?: number;
  goal_pace?: number;
  priority: string;
  notes?: string;
  days_until?: number;
  created_at: string;
  updated_at: string;
}

export interface CompetitionCreate {
  name: string;
  race_type: string;
  race_date: string;
  distance?: number;
  elevation_gain?: number;
  location?: string;
  goal_time?: number;
  goal_pace?: number;
  priority?: string;
  notes?: string;
}

export interface WorkoutDetails {
  type: string;
  description: string;
  distance_km?: number;
  duration_min?: number;
  intensity?: string;
  hr_zone?: string;
  pace_range?: string;
  intervals?: Array<{
    reps: number;
    distance_m: number;
    target_pace: string;
    recovery: string;
  }>;
  notes?: string;
}

export interface TrainingSession {
  id: number;
  session_date: string;
  source: string;
  status: string;
  planned_workout?: WorkoutDetails;
  recommendation_workout?: WorkoutDetails;
  completed_activity_id?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingSessionCreate {
  session_date: string;
  source?: string;
  planned_workout?: WorkoutDetails;
  recommendation_workout?: WorkoutDetails;
  notes?: string;
}

export interface TrainingSessionUpdate {
  planned_workout?: WorkoutDetails;
  recommendation_workout?: WorkoutDetails;
  status?: string;
  notes?: string;
}

export interface TrainingWeekResponse {
  sessions: TrainingSession[];
  week_start: string;
  week_end: string;
  total_distance_planned: number;
  total_distance_recommended: number;
}

export interface RecommendationsResponse {
  analysis: string;
  weekly_focus: string;
  sessions: WorkoutDetails[];
  warnings: string[];
}

export interface ConvertSessionResponse {
  converted_session: WorkoutDetails;
  conversion_rationale: string;
}

export interface UploadedPlan {
  id: number;
  filename: string;
  is_active: boolean;
  parsed_sessions_count: number;
  upload_date: string;
}
