import type { VercelRequest, VercelResponse } from "@vercel/node";

const CAMPUS_CENTER = {
  latitude: 12.823,
  longitude: 80.0444,
};

// meters
const MAX_DISTANCE = 1000; // 1 km strict radius

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) *
      Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Location required" });
  }

  const distance = getDistance(
    latitude,
    longitude,
    CAMPUS_CENTER.latitude,
    CAMPUS_CENTER.longitude
  );

  const insideCampus = distance <= MAX_DISTANCE;

  return res.status(200).json({
    insideCampus,
    distanceInMeters: Math.round(distance),
  });
}
