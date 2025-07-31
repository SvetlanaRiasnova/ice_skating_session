export async function fetchApi(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    params?: Record<string, string>;
  }
) {

  // const baseUrl = import.meta.env.VITE_API_BASE_URL;

  //временно для тестов
  const baseUrl =   "https://8ta3nr-212-19-10-25.ru.tuna.am";

  
  let url = `${baseUrl}/${endpoint}`.replace(/([^:]\/)\/+/g, '$1');
  
  if (options.params) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value) queryParams.append(key, value);
    }
    url += `?${queryParams.toString()}`;
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}