// src/services/apiService.ts
import { fetchApi } from '../utils/fetchHelper';

export async function getSessions(filterType?: string) {
  const url = 'sessions/';
  const params = {};
  
  if (filterType) {
    params['filter_type'] = filterType;
  }

return fetchApi(url, { method: 'GET', params});}

export async function getSessionDetails(sessionId: number) {
  return fetchApi(`sessions/${sessionId}/`, { method: 'GET' });
}

export async function getOrderPrice(payload: any) {
  return fetchApi('/orders/get_price/', { method: 'POST', body: payload });
}

export async function createOrder(payload: any) {
  return fetchApi('orders/', { method: 'POST', body: payload });
}