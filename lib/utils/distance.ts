/**
 * Utilitas Penghitungan Jarak & Geolokasi Food Rescue (W5)
 *
 * Menggunakan rumus Haversine untuk menghitung jarak lingkaran besar
 * antara dua pasang koordinat lintang (latitude) dan bujur (longitude).
 * Tidak memerlukan dependensi pihak ketiga atau library eksternal.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Memvalidasi apakah koordinat lintang dan bujur bernilai numerik yang sah.
 */
export function isValidCoordinate(
  lat: unknown,
  lon: unknown
): lat is number {
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return false;
  }
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (isNaN(nLat) || isNaN(nLon)) return false;
  return nLat >= -90 && nLat <= 90 && nLon >= -180 && nLon <= 180;
}

/**
 * Mengubah derajat sudut menjadi radian.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Menghitung jarak antara dua titik koordinat GPS dalam satuan kilometer (km).
 *
 * @param lat1 Lintang titik pertama (misal: lokasi toko mitra penjual)
 * @param lon1 Bujur titik pertama
 * @param lat2 Lintang titik kedua (misal: lokasi alamat pengantaran pembeli)
 * @param lon2 Bujur titik kedua
 * @returns Jarak dalam kilometer (km), atau null jika salah satu koordinat tidak valid
 */
export function calculateDistance(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined
): number | null {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return null;
  }

  const dLat = toRadians(Number(lat2) - Number(lat1));
  const dLon = toRadians(Number(lon2) - Number(lon1));

  const rLat1 = toRadians(Number(lat1));
  const rLat2 = toRadians(Number(lat2));

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Memformat nilai jarak numerik ke representasi ramah pengguna.
 * Contoh: 0.35 km -> "350 m", 2.45 km -> "2.5 km"
 */
export function formatDistance(km: number | null | undefined): string {
  if (km === null || km === undefined || isNaN(km)) {
    return "Jarak tidak diketahui";
  }

  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} m`;
  }

  return `${km.toFixed(1)} km`;
}

