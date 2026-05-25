import axios from 'axios';

/** Empty string = use Vite dev proxy (same origin, fast WebSocket). */
const API_URL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: API_URL,
});

export function setAuthToken(token: string) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function clearAuthToken() {
  delete api.defaults.headers.common['Authorization'];
}

const stored = localStorage.getItem('smartbin_token');
if (stored) setAuthToken(stored);

export interface Bin {
  id: string;
  name: string;
  location: string | null;
  max_depth_cm: number;
  threshold_pct: number;
  created_at: string;
}

export interface Reading {
  id: string;
  bin_id: string;
  fill_pct: number;
  temperature: number | null;
  humidity: number | null;
  gas_ppm: number | null;
  moisture_pct: number | null;
  recorded_at: string;
  fan_on?: boolean;
}

export interface Alert {
  id: string;
  bin_id: string;
  type: string;
  message: string;
  resolved: boolean;
  created_at: string;
  bin_name?: string | null;
  status?: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
}

export interface RegistrationStatus {
  open: boolean;
  admin_exists: boolean;
}

export const getRegistrationStatus = async (): Promise<RegistrationStatus> => {
  const { data } = await api.get('/auth/registration-status');
  return data;
};

export const registerAdmin = async (email: string, password: string) => {
  const { data } = await api.post('/auth/register', { email, password });
  return data;
};

export const loginAdmin = async (email: string, password: string) => {
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);
  const { data } = await api.post('/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data as { access_token: string; token_type: string };
};

export const getMe = async (): Promise<User> => {
  const { data } = await api.get('/auth/me');
  return data;
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const { data } = await api.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
};

export const getBins = async (): Promise<Bin[]> => {
  const { data } = await api.get('/bins/');
  return data;
};

export const getBin = async (id: string): Promise<Bin> => {
  const { data } = await api.get(`/bins/${id}`);
  return data;
};

export const getReadings = async (binId: string): Promise<Reading[]> => {
  const { data } = await api.get(`/bins/${binId}/history`);
  return data;
};

export const getAlerts = async (): Promise<Alert[]> => {
  const { data } = await api.get('/alerts/');
  return data;
};

export const getLiveReadings = async (): Promise<Reading[]> => {
  const { data } = await api.get('/live/readings');
  return data;
};

export const createBin = async (bin: Omit<Bin, 'id' | 'created_at'>): Promise<Bin> => {
  const { data } = await api.post('/bins/', bin);
  return data;
};
