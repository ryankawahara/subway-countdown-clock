const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;

module.exports = async function handler(req, res) {
  const url = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace';

  try {
    // Fetch data from the MTA API
    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).json({ error: `Failed to fetch: ${response.status}` });
      return;
    }

    // Convert response to ArrayBuffer and decode GTFS feed
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      res.status(502).json({ error: 'Empty response from MTA API' });
      return;
    }

    const buffer = Buffer.from(arrayBuffer);
    const feed = FeedMessage.decode(buffer);

    // Parse feed data
    const currentTime = Math.round(Date.now() / 1000);
    const stations = {};
    const tripIds = new Set();

    feed.entity.forEach((entity) => {
      if (entity.tripUpdate && entity.tripUpdate.stopTimeUpdate) {
        const tripId = entity.tripUpdate.trip?.tripId;
        if (tripId && !tripIds.has(tripId)) {
          tripIds.add(tripId);

          entity.tripUpdate.stopTimeUpdate.forEach((stopTimeUpdate) => {
            const stopId = stopTimeUpdate.stopId;
            const departureTime = stopTimeUpdate.departure?.time;

            if (stopId && departureTime) {
              const timeDiff = departureTime - currentTime;

              if (timeDiff > 0) {
                const stationName = stopId; // Replace with actual station name mapping if available
                const trainId = entity.tripUpdate.trip.routeId;

                if (!stations[stationName]) {
                  stations[stationName] = { name: stationName, trains: [] };
                }

                stations[stationName].trains.push({
                  trainId,
                  eta: convertEpoch(departureTime),
                  minAway: secsToMins(timeDiff),
                  rawEta: timeDiff,
                });
              }
            }
          });
        }
      }
    });

    // Sort trains by arrival time
    Object.values(stations).forEach((station) => {
      station.trains.sort((a, b) => a.rawEta - b.rawEta);
    });

    res.status(200).json({ stations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decode GTFS feed', details: err.message });
  }
};

// Helper functions
function secsToMins(time) {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return `${minutes}m, ${seconds}s`;
}

function convertEpoch(time) {
  const date = new Date(time * 1000);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}