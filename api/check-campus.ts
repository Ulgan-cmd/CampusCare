import type { VercelRequest, VercelResponse } from "@vercel/node";

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

  const radarRes = await fetch("https://api.radar.io/v1/track", {
    method: "POST",
    headers: {
      Authorization: process.env.RADAR_API_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: "student",
      location: {
        latitude,
        longitude,
      },
      geofenceExternalIds: ["srmist_campus"],
    }),
  });

  const data = await radarRes.json();

  const insideCampus = data?.geofences?.length > 0;

  return res.status(200).json({ insideCampus });
}
