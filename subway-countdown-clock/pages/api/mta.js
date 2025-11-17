const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;
const tripsData = require('./trips-data.json');

module.exports = async function handler(req, res) {
  const url = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace';

  // Get the list of station IDs from the query parameter
  const stationIds = req.query.stations ? req.query.stations.split(',') : null;

  if (!stationIds || stationIds.length === 0) {
    res.status(400).json({ error: 'Missing or invalid stations query parameter' });
    return;
  }

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
          const tripKey = tripId.split('_').pop();
          const destination = tripsData[tripKey] || "Unknown";

          entity.tripUpdate.stopTimeUpdate.forEach((stopTimeUpdate) => {
            const stopId = stopTimeUpdate.stopId;
            const departureTime = stopTimeUpdate.departure?.time;

            // Filter by the provided station IDs
            if (stationIds.includes(stopId) && departureTime) {
              const timeDiff = departureTime - currentTime;

              if (timeDiff > 0) {
                const trainId = entity.tripUpdate.trip.routeId;

                if (!stations[stopId]) {
                  stations[stopId] = { name: stopId, trains: [] };
                }

                stations[stopId].trains.push({
                  trainId,
                  destination: destination,
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

    // Sort trains by arrival time for each station
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