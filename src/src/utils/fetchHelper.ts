export async function fetchApi(url: string, options: RequestInit) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
    const fullUrl = `${baseUrl}${url}`;
  
    const response = await fetch(fullUrl, options);
  
    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.status}`);
    }
  
    return await response.json();
  }