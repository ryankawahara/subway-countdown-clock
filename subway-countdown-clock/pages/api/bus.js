const MTA_BUS_API_BASE = "https://bustime.mta.info/api/siri/stop-monitoring.json";

// Stop coordinates for map centering (from MTA GTFS/OneBusAway)
const STOP_COORDINATES = {
  MTA_503472: { lat: 40.730283, lon: -73.887154 },
  MTA_503528: { lat: 40.7301, lon: -73.888385 },
  MTA_551557: { lat: 40.734607, lon: -73.888347 },
  MTA_551558: { lat: 40.734474, lon: -73.888682 },
};

module.exports = async function handler(req, res) {
  const apiKey = process.env.MTA_BUS_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "MTA_BUS_API_KEY is not configured. Add it to .env.local",
    });
    return;
  }

  const stopIds = req.query.stops ? req.query.stops.split(",") : null;
  if (!stopIds || stopIds.length === 0) {
    res.status(400).json({
      error: "Missing or invalid stops query parameter. Use ?stops=MTA_308214,MTA_308209",
    });
    return;
  }

  try {
    const results = await Promise.all(
      stopIds.map(async (stopId) => {
        const url = `${MTA_BUS_API_BASE}?key=${apiKey}&MonitoringRef=${encodeURIComponent(
          stopId.trim()
        )}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`MTA API error: ${response.status}`);
        }
        const data = await response.json();
        return { stopId: stopId.trim(), data };
      })
    );

    const stops = {};
    for (const { stopId, data } of results) {
      const delivery =
        data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0];
      const visits = delivery?.MonitoredStopVisit || [];
      const stopName =
        visits[0]?.MonitoredVehicleJourney?.MonitoredCall?.StopPointName ||
        stopId;

      const arrivals = visits.map((visit) => {
        const journey = visit.MonitoredVehicleJourney;
        const call = journey?.MonitoredCall;
        const expectedTime = call?.ExpectedArrivalTime;
        const distance = call?.Extensions?.Distances?.PresentableDistance;
        const location = journey?.VehicleLocation;

        return {
          route: journey?.PublishedLineName || "?",
          destination: journey?.DestinationName || "",
          expectedArrival: expectedTime || null,
          presentableDistance: distance || null,
          location:
            location && location.Latitude != null && location.Longitude != null
              ? { lat: location.Latitude, lon: location.Longitude }
              : null,
        };
      });

      const stopCoords =
        STOP_COORDINATES[stopId] ||
        arrivals.find((a) => a.location)?.location || { lat: 40.73, lon: -73.89 };

      stops[stopId] = {
        name: stopName,
        lat: stopCoords.lat,
        lon: stopCoords.lon,
        arrivals: arrivals.sort((a, b) => {
          const aTime = a.expectedArrival ? new Date(a.expectedArrival).getTime() : Infinity;
          const bTime = b.expectedArrival ? new Date(b.expectedArrival).getTime() : Infinity;
          return aTime - bTime;
        }),
      };
    }

    res.status(200).json({ stops });
  } catch (err) {
    console.error("Bus API error:", err);
    res.status(500).json({
      error: "Failed to fetch bus data",
      details: err.message,
    });
  }
}
