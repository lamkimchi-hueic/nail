import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Services
export const servicesAPI = {
  getAll: () => api.get('/services'),
  get: (id) => api.get(`/services/${id}`),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`)
};

// Appointments
export const appointmentsAPI = {
  getAll: (params) => api.get('/appointments', { params }),
  getByDateRange: (startDate, endDate) => 
    api.get('/appointments/date-range', { params: { start_date: startDate, end_date: endDate } }),
  getByPhone: (phone) => api.get(`/appointments/phone/${phone}`),
  getMyAppointments: () => api.get('/my-appointments'),
  create: (data) => api.post('/appointments', data),
  createManual: (data) => api.post('/appointments/create-manual', data),
  confirm: (id) => api.patch(`/appointments/${id}/confirm`),
  reject: (id) => api.patch(`/appointments/${id}/reject`),
  reschedule: (id, date) => api.patch(`/appointments/${id}/reschedule`, { appointment_date: date }),
  updateStatus: (id, status) => api.patch(`/appointments/${id}/status`, { status })
};

// Customers
export const customersAPI = {
  getAll: (page = 1, perPage = 15) => api.get('/customers', { params: { page, per_page: perPage } }),
  get: (id) => api.get(`/customers/${id}`),
  search: (query) => api.get(`/customers/search/${query}`)
};

// Salon Settings
export const salonSettingsAPI = {
  getPublic: () => api.get('/salon-settings'),
  getAll: () => api.get('/salon-settings'),
  update: (data) => api.put('/salon-settings', data)
};

// Auth
export const authAPI = {
  register: (data) => api.post('/register', data),
  login: (data) => api.post('/login', data),
  getUser: () => api.get('/user'),
  logout: () => api.post('/logout')
};

export default api;
