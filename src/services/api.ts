// src/services/apiService.ts
import { fetchApi } from '../utils/fetchHelper';

export async function getSessions(filterType?: string) {
  const url = '/api/v1/sessions/';
  const params = {};

  if (filterType) {
    params['filter_type'] = filterType;
  }

  return fetchApi(url, { method: 'GET', params });
}

export async function getSessionDetails(sessionId: number) {
  return fetchApi(`/api/v1/sessions/${sessionId}/`, { method: 'GET' });
}

export async function getOrderPrice(payload: any) {
  return fetchApi('/api/v1/orders/get_price/', { method: 'POST', body: payload });
}

export async function createOrder(payload: any) {
  return fetchApi('/api/v1/orders/', { method: 'POST', body: payload });
}