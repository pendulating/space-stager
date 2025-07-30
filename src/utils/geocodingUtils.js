const STADIA_API_URL = 'https://api.stadiamaps.com/v1/autocomplete';

export const geocodeAddress = async (address) => {
  if (!address || address.trim().length < 3) { // Autocomplete usually requires a few characters
    return null;
  }

  const params = new URLSearchParams({
    text: address,
    // Add any other parameters like 'boundary.country' if needed
  });

  // Note: This assumes local development without an API key is allowed by Stadia.
  // In production, you would need to include an API key:
  // params.append('api_key', 'YOUR_STADIA_API_KEY');

  const url = `${STADIA_API_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Geocoding failed with status: ${response.status}`);
    }
    const data = await response.json();
    
    // Return the full response object, which includes the 'features' array
    return data;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}; 