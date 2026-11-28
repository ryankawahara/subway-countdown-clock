const express = require('express');
const path = require('path');
const protobuf = require('protobufjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Load JSON data
const tripsData = require('./pages/api/trips-data.json');
const stationData = require('./pages/api/station-data.json');
const directionsData = require('./pages/api/directions-data.json');
const destinationCodes = require('./pages/api/destination-codes.json');

// Protobuf setup
let root = null;
let FeedMessage = null;

async function loadProtobuf() {
  if (root) return;
  const protoDir = path.join(__dirname, 'pages', 'api', 'proto');
  root = await protobuf.load([
    path.join(protoDir, 'gtfs-realtime.proto'),
    path.join(protoDir, 'nyct-subway.proto')
  ]);
  FeedMessage = root.lookupType('transit_realtime.FeedMessage');
  console.log('Protobuf loaded');
}

// Helper functions
function getDestinationFromTrainId(trainId) {
  if (!trainId) return null;
  const match = trainId.match(/\d{4}\+?\s+([A-Z0-9\-\/]+)$/);
  if (match) {
    const codes = match[1].split('/');
    const destCode = codes.length >= 2 ? codes[1] : codes[0];
    if (destinationCodes[destCode]) {
      return destinationCodes[destCode];
    }
  }
  return null;
}

function secsToMins(time) {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return `${minutes}m, ${seconds}s`;
}

function convertEpoch(time) {
  const date = new Date(time * 1000);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

// MTA API endpoint
app.get('/api/mta', async (req, res) => {
  const feeds = [
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw'
  ];

  const stationIds = req.query.stations ? req.query.stations.split(',') : null;

  if (!stationIds || stationIds.length === 0) {
    return res.status(400).json({ error: 'Missing stations parameter' });
  }

  try {
    await loadProtobuf();

    const responses = await Promise.all(feeds.map(url => fetch(url).catch(() => null)));

    const allEntities = [];
    for (const response of responses) {
      if (response && response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer && arrayBuffer.byteLength > 0) {
          const buffer = Buffer.from(arrayBuffer);
          const feed = FeedMessage.decode(new Uint8Array(buffer));
          allEntities.push(...feed.entity);
        }
      }
    }

    const currentTime = Math.round(Date.now() / 1000);
    const stations = {};
    const tripIds = new Set();

    allEntities.forEach((entity) => {
      if (entity.tripUpdate && entity.tripUpdate.stopTimeUpdate) {
        const tripId = entity.tripUpdate.trip?.tripId;
        if (tripId && !tripIds.has(tripId)) {
          tripIds.add(tripId);
          const tripKey = tripId.split('_').pop();
          const trip = entity.tripUpdate.trip;
          const nyctExtension = trip['.transit_realtime.nyctTripDescriptor'];

          let destination = null;
          if (nyctExtension?.trainId) {
            destination = getDestinationFromTrainId(nyctExtension.trainId);
          }
          if (!destination) {
            destination = tripsData[tripKey];
          }

          entity.tripUpdate.stopTimeUpdate.forEach((stopTimeUpdate) => {
            const stopId = stopTimeUpdate.stopId;
            const departureTime = stopTimeUpdate.departure?.time;
            // Check both departure and arrival delay, also check scheduleRelationship
            const departureDelay = stopTimeUpdate.departure?.delay || 0;
            const arrivalDelay = stopTimeUpdate.arrival?.delay || 0;
            const delay = Math.max(departureDelay, arrivalDelay); // Use the larger delay
            const scheduleRelationship = stopTimeUpdate.scheduleRelationship || 0;
            // scheduleRelationship: 0=SCHEDULED, 1=SKIPPED, 2=NO_DATA, 3=UNSCHEDULED

            if (stationIds.includes(stopId) && departureTime) {
              const timeDiff = departureTime - currentTime;

              if (timeDiff > 0) {
                const trainId = entity.tripUpdate.trip.routeId;
                const stationName = stationData[stopId]?.stop_name || stopId;

                let direction = "Unknown";
                const lastChar = stopId.slice(-1);
                const baseStationId = stopId.slice(0, -1);
                const stationDirectionData = directionsData[baseStationId];

                if (stationDirectionData) {
                  if (lastChar === 'S') {
                    direction = stationDirectionData.south_direction_label || "Unknown";
                  } else if (lastChar === 'N') {
                    direction = stationDirectionData.north_direction_label || "Unknown";
                  }
                }

                if (!stations[stopId]) {
                  stations[stopId] = { name: stationName, direction: direction, trains: [] };
                }

                stations[stopId].trains.push({
                  trainId,
                  destination: destination,
                  eta: convertEpoch(departureTime),
                  minAway: secsToMins(timeDiff),
                  rawEta: timeDiff,
                  delay: delay, // Delay in seconds (positive = late)
                });
              }
            }
          });
        }
      }
    });

    Object.values(stations).forEach((station) => {
      station.trains.sort((a, b) => a.rawEta - b.rawEta);
    });

    res.json({ stations });
  } catch (err) {
    console.error('MTA API Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch MTA data' });
  }
});

// Service Alerts endpoint
app.get('/api/service-alerts', async (req, res) => {
  const { lines: linesParam } = req.query;

  if (!linesParam) {
    return res.json({ alerts: [] });
  }

  try {
    await loadProtobuf();

    const requestedLines = linesParam.split(',').filter(l => l && /^[A-Z0-9]+$/.test(l));
    if (requestedLines.length === 0) {
      return res.json({ alerts: [] });
    }

    const response = await fetch('https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts');
    const buffer = await response.arrayBuffer();
    const message = FeedMessage.decode(new Uint8Array(buffer));

    const allAlerts = [];

    message.entity.forEach(entity => {
      if (entity.alert) {
        const alert = entity.alert;
        const affectedLines = new Set();

        if (alert.informedEntity) {
          alert.informedEntity.forEach(ie => {
            if (ie.routeId) affectedLines.add(ie.routeId);
          });
        }

        const relevantLines = [...affectedLines].filter(l => requestedLines.includes(l));
        if (relevantLines.length > 0) {
          const headerText = alert.headerText?.translation?.[0]?.text || 'Service Alert';
          const descText = alert.descriptionText?.translation?.[0]?.text || '';
          const isPlanned = alert.cause === 9 || alert.cause === 10 ||
                          (entity.id && entity.id.includes('planned_work'));

          allAlerts.push({
            id: entity.id,
            headerText,
            descriptionText: descText,
            affectedLines: [...affectedLines],
            activePeriod: alert.activePeriod?.[0] ? {
              start: alert.activePeriod[0].start ? Number(alert.activePeriod[0].start) : null,
              end: alert.activePeriod[0].end ? Number(alert.activePeriod[0].end) : null,
            } : null,
            isPlanned,
            cause: alert.cause || 1,
            effect: alert.effect || 8,
          });
        }
      }
    });

    allAlerts.sort((a, b) => {
      if (!a.isPlanned && b.isPlanned) return -1;
      if (a.isPlanned && !b.isPlanned) return 1;
      return (b.activePeriod?.start || 0) - (a.activePeriod?.start || 0);
    });

    res.json({ alerts: allAlerts.slice(0, 10) });
  } catch (error) {
    console.error('Service alerts error:', error.message);
    res.json({ alerts: [] });
  }
});

// Serve static files from 'out' directory (static export)
app.use(express.static(path.join(__dirname, 'out')));

// Fallback to index.html for SPA routing
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'out', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
