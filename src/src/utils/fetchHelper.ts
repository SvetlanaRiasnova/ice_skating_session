export async function fetchApi(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    params?: Record<string, string>;
  } = {}
) {

  // const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
const baseUrl = 'https://u4hhxp-212-19-10-25.ru.tuna.am'
 
  let url = `${baseUrl}/${endpoint}`.replace(/([^:]\/)\/+/g, '$1');
 
  if (options?.params) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value) queryParams.append(key, value);
    }
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    method: options?.method || 'GET',
    headers,
  };

  if (options?.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
   
    if (!response.ok) {

      let errorData = null;
      try {
        errorData = await response.json();
      } catch {

        errorData = { message: response.statusText };
      }

      const apiError = {
        response: {
          status: response.status,
          data: errorData
        }
      };
      
      throw apiError;
    }

    return await response.json();
  } catch (error) {

    if (error && typeof error === 'object' && 'response' in error) {
      throw error;
    }
    
    console.error('Fetch error:', error);
    throw {
      response: {
        status: 0,
        data: { message: error instanceof Error ? error.message : 'Network error' }
      }
    };
  }
}