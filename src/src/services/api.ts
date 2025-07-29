import { fetchApi } from '../utils/fetchHelper';

type FilterType = 'nearest' | 'weekend' | 'custom';

export async function getSessions(filterType: FilterType, customDate?: string) {
  const params: Record<string, string> = {};
  
  if (filterType === 'custom') {
    if (!customDate) throw new Error('Custom date is required');
    params.filter_type = 'custom';
    params.custom_date = customDate;
  } else {
    params.filter_type = filterType;
  }
  
  return fetchApi('api/v1/sessions/', { 
    method: 'GET',
    params 
  });
}

export async function getSessionDetails(sessionId: number) {
  return fetchApi(`api/v1/sessions/${sessionId}/`, { method: 'GET' });
}

export async function getOrderPrice(payload: any) {
  return fetchApi('api/v1/orders/get_price/', { 
    method: 'POST', 
    body: payload 
  });
}

export async function createOrder(payload: any) {
  return fetchApi('api/v1/orders/', { 
    method: 'POST', 
    body: payload 
  });
}

export async function checkOrderStatus(uuid: string) {
  return fetchApi(`api/v1/orders/check_status/?uuid=${uuid}`, { 
    method: 'GET' 
  });
}