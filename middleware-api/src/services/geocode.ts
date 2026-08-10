/**
 * Reverse geocoding via OpenStreetMap Nominatim, proxied server-side so we
 * can send the identifying User-Agent that OSM's usage policy requires
 * (browsers can't set one). Results are cached by ~11 m grid to stay well
 * under Nominatim's 1 req/s limit.
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'RilazCustomerApp/0.1 (middleware dev; contacto: soporte@rilaz.sv)';

const cache = new Map<string, string>();

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  residential?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
};

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lon}&format=jsonv2&accept-language=es&zoom=18`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;

  const data = (await res.json()) as { address?: NominatimAddress; display_name?: string };
  const a = data.address ?? {};
  const parts = [
    [a.road, a.house_number].filter(Boolean).join(' '),
    a.neighbourhood || a.suburb || a.residential,
    a.city || a.town || a.village || a.municipality,
    a.state,
  ].filter((p): p is string => Boolean(p));
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  const address = unique.length ? unique.join(', ') : (data.display_name ?? null);

  if (address) cache.set(key, address);
  return address;
}
