const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;

let cachedData = null; // Cache to store the latest data
let lastUpdated = 0; // Timestamp of the last update

// Function to fetch and cache the latest data
const fetchLatestData = async () => {
  const url = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace';

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch: ${response.status}`);
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      console.error('Empty response from MTA API');
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

    // Update the cache
    cachedData = { stations };
    lastUpdated = Date.now();
    console.log('Data successfully updated at', new Date(lastUpdated).toLocaleTimeString());
  } catch (err) {
    console.error('Failed to fetch or parse MTA data:', err.message);
  }
};

// Automatically fetch data every 60 seconds
setInterval(fetchLatestData, 60 * 1000);
fetchLatestData(); // Initial fetch

// API handler to serve cached data
module.exports = async function handler(req, res) {
  if (!cachedData) {
    res.status(503).json({ error: 'Data is not yet available. Please try again later.' });
    return;
  }
  res.status(200).json(cachedData);
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