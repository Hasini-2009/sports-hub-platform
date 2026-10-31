export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "athlete" | "coach" | "organizer" | "referee";
  profile_metrics: {
    height?: number;
    weight?: number;
    age?: number;
    fitness_score?: number;
  };
  device_token?: string;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  doc_type: "ID" | "MEDICAL" | "WAIVER";
  storage_url: string;
  is_verified: boolean;
  uploaded_at: string;
}

export interface Event {
  id: string;
  sport_name: string;
  title: string;
  venue: string;
  organizer_id: string;
  date_time: string;
  entry_fee: number;
  capacity: number;
  mandatory_requirements: string[];
  registered_count: number;
}

export interface EligibilityCheckItem {
  requirement: string;
  passed: boolean;
  message: string;
}

export interface EligibilityResult {
  eligible: boolean;
  checks: EligibilityCheckItem[];
}

export interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED";
  payment_id?: string;
  event?: Event;
}

export interface Court {
  id: string;
  name: string;
  sport_name: string;
  venue: string;
  hourly_price: number;
}

export interface SlotAvailability {
  slot_start: string;
  slot_end: string;
  is_available: boolean;
}

export interface Booking {
  id: string;
  user_id: string;
  court_id: string;
  slot_start: string;
  slot_end: string;
  payment_status: "PENDING" | "CONFIRMED" | "FAILED";
  created_at: string;
  court?: Court;
}

export interface PaymentIntent {
  payment_id: string;
  gateway: string;
  order_id: string;
  amount: number;
  currency: string;
  checkout_url_or_token?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  kind: string;
  sent_at: string;
  read: boolean;
}

export interface Match {
  id: string;
  tournament_id: string;
  team_a: string;
  team_b: string;
  court_number: number;
  start_time: string;
  score_a: number;
  score_b: number;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
}

export interface ScheduledMatch {
  match_index: number;
  team_a: string;
  team_b: string;
  court_number: number;
  slot_index: number;
  start_time: string;
  end_time: string;
}

export interface TimetableResponse {
  total_slots: number;
  makespan_minutes: number;
  matches: ScheduledMatch[];
}

// Client helper
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = `Request failed (${res.status})`;
    try {
      const errorJson = await res.json();
      if (typeof errorJson.detail === "string") {
        errorDetail = errorJson.detail;
      } else if (errorJson.detail?.message) {
        errorDetail = errorJson.detail.message;
      } else if (errorJson.message) {
        errorDetail = errorJson.message;
      } else {
        errorDetail = JSON.stringify(errorJson.detail || errorJson);
      }
    } catch {
      // fallback
    }
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  register: (body: any) => request<{ user: User; access_token?: string }>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: any) => request<{ access_token: string; user: User }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(body) }),
  getMe: () => request<User>("/api/v1/auth/me"),
  updateMetrics: (body: any) => request<User>("/api/v1/auth/me/metrics", { method: "PUT", body: JSON.stringify(body) }),
  updateDeviceToken: (device_token: string) => request<User>("/api/v1/auth/me/device-token", { method: "PUT", body: JSON.stringify({ device_token }) }),

  // Vault
  getDocuments: () => request<Document[]>("/api/v1/vault/documents"),
  getPendingVerifications: () => request<Document[]>("/api/v1/vault/pending-verifications"),
  uploadDocument: (doc_type: string, file: File) => {
    const formData = new FormData();
    formData.append("doc_type", doc_type);
    formData.append("file", file);
    return request<Document>("/api/v1/vault/documents", { method: "POST", body: formData });
  },
  verifyDocument: (docId: string) => request<Document>(`/api/v1/vault/documents/${docId}/verify`, { method: "POST" }),

  // Events & Eligibility
  listEvents: (params?: { sport?: string; search?: string; eligible_only?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.sport) query.set("sport", params.sport);
    if (params?.search) query.set("search", params.search);
    if (params?.eligible_only) query.set("eligible_only", "true");
    const qs = query.toString();
    return request<Event[]>(`/api/v1/events${qs ? `?${qs}` : ""}`);
  },
  getEvent: (id: string) => request<Event>(`/api/v1/events/${id}`),
  createEvent: (body: any) => request<Event>("/api/v1/events", { method: "POST", body: JSON.stringify(body) }),
  checkEligibility: (eventId: string) => request<EligibilityResult>(`/api/v1/events/${eventId}/eligibility`),
  registerForEvent: (eventId: string) => request<Registration>(`/api/v1/events/${eventId}/register`, { method: "POST" }),

  // Courts & Bookings
  listCourts: () => request<Court[]>("/api/v1/courts"),
  getCourtAvailability: (courtId: string, dateStr: string) => request<SlotAvailability[]>(`/api/v1/courts/${courtId}/availability?date=${dateStr}`),
  createBooking: (court_id: string, slot_start: string, slot_end: string) =>
    request<Booking>("/api/v1/bookings", { method: "POST", body: JSON.stringify({ court_id, slot_start, slot_end }) }),
  getMyBookings: () => request<Booking[]>("/api/v1/bookings/me"),

  // Payments
  createPaymentIntent: (purpose: "BOOKING" | "REGISTRATION", ref_id: string, gateway: string = "mock") =>
    request<PaymentIntent>("/api/v1/payments/create-intent", { method: "POST", body: JSON.stringify({ purpose, ref_id, gateway }) }),
  completeMockPayment: (paymentId: string) =>
    request<any>(`/api/v1/payments/mock/complete/${paymentId}`, { method: "POST" }),

  // Notifications
  getMyNotifications: () => request<Notification[]>("/api/v1/notifications/me"),
  markNotificationRead: (id: string) => request<Notification>(`/api/v1/notifications/${id}/read`, { method: "POST" }),

  // Scheduler
  generateSchedule: (body: any) => request<TimetableResponse>("/api/v1/scheduler/generate", { method: "POST", body: JSON.stringify(body) }),
  commitSchedule: (eventId: string, body: any) => request<Match[]>(`/api/v1/scheduler/generate/${eventId}/commit`, { method: "POST", body: JSON.stringify(body) }),

  // Live Scores
  getLiveMatches: (tournamentId?: string) => {
    const qs = tournamentId ? `?tournament_id=${tournamentId}` : "";
    return request<Match[]>(`/api/v1/live/matches${qs}`);
  },
  updateMatchScore: (matchId: string, score_a: number, score_b: number, status?: string) =>
    request<Match>(`/api/v1/live/matches/${matchId}/score`, { method: "PUT", body: JSON.stringify({ score_a, score_b, status }) }),

  // Injury Health
  getInjuryHealth: () => request<{ status: string; ollama_reachable: boolean; chromadb_reachable: boolean; model: string }>("/api/v1/injury/health"),
};

