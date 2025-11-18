const protobuf = require('protobufjs');
const path = require('path');
const tripsData = require('./trips-data.json');
const stationData = require('./station-data.json');
const directionsData = require('./directions-data.json');
const destinationCodes = require('./destination-codes.json');

// Helper function to parse destination from NYCT trainId (e.g., "1A 2154+ FAR/EUC" or "1A 0042 FAR/207")
// The format is typically ORIGIN/DESTINATION, so we want the second code
function getDestinationFromTrainId(trainId, direction) {
  if (!trainId) return null;

  // Extract the destination code(s) - handles various formats:
  // "1A 2154+ FAR/EUC", "02 2322  FLA/241", "=7 0428 G-C/MST", "0S 0030  GCS/TSS"
  // Look for 4 digits, optional +, then whitespace, then destination codes
  const match = trainId.match(/\d{4}\+?\s+([A-Z0-9\-\/]+)$/);
  if (match) {
    const codes = match[1].split('/');

    // The format is ORIGIN/DESTINATION, so the second code is the destination
    // If there's only one code, use it
    let destCode;
    if (codes.length >= 2) {
      destCode = codes[1]; // Second code is destination
    } else {
      destCode = codes[0];
    }

    if (destinationCodes[destCode]) {
      return destinationCodes[destCode];
    }
  }
  return null;
}

// Load the protobuf with NYCT extensions
let root = null;
let FeedMessage = null;

async function loadProtobuf() {
  if (root) return;
  try {
    // Use process.cwd() for Next.js compatibility
    const protoDir = path.join(process.cwd(), 'pages', 'api', 'proto');
    console.log('Loading protos from:', protoDir);
    root = await protobuf.load([
      path.join(protoDir, 'gtfs-realtime.proto'),
      path.join(protoDir, 'nyct-subway.proto')
    ]);
    FeedMessage = root.lookupType('transit_realtime.FeedMessage');
    console.log('Protobuf loaded successfully');
  } catch (err) {
    console.error('Failed to load protobuf:', err);
    throw err;
  }
}

// Helper function to determine day type (weekday, saturday, sunday)
function getDayType() {
  const now = new Date();
  const day = now.getDay();
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

module.exports = async function handler(req, res) {
  // MTA GTFS-realtime feed URLs
  const feeds = [
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace', // A, C, E
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',      // 1-7, S,
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw'
  ];

  // Get the list of station IDs from the query parameter
  const stationIds = req.query.stations ? req.query.stations.split(',') : null;

  if (!stationIds || stationIds.length === 0) {
    res.status(400).json({ error: 'Missing or invalid stations query parameter' });
    return;
  }

  try {
    // Load protobuf if not already loaded
    await loadProtobuf();

    // Fetch all feeds in parallel
    const responses = await Promise.all(feeds.map(url => fetch(url)));

    // Check for errors
    for (let i = 0; i < responses.length; i++) {
      if (!responses[i].ok) {
        console.warn(`Feed ${feeds[i]} failed with status ${responses[i].status}`);
      }
    }

    // Decode all feeds and combine entities
    const allEntities = [];
    for (const response of responses) {
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer && arrayBuffer.byteLength > 0) {
          const buffer = Buffer.from(arrayBuffer);
          const feed = FeedMessage.decode(new Uint8Array(buffer));
          allEntities.push(...feed.entity);
        }
      }
    }

    // Create a combined feed object
    const feed = { entity: allEntities };

    // Parse feed data
    const currentTime = Math.round(Date.now() / 1000);
    const dayType = getDayType();
    const stations = {};
    const tripIds = new Set();

    feed.entity.forEach((entity) => {
      if (entity.tripUpdate && entity.tripUpdate.stopTimeUpdate) {
        const tripId = entity.tripUpdate.trip?.tripId;
        if (tripId && !tripIds.has(tripId)) {
          tripIds.add(tripId);
          const tripKey = tripId.split('_').pop();
          const trip = entity.tripUpdate.trip;

          // Get NYCT extension data (contains train_id with destination info)
          const nyctExtension = trip['.transit_realtime.nyctTripDescriptor'];

          // Priority order for destination lookup:
          // 1. NYCT trainId (most accurate for abbreviated trip IDs)
          // 2. Primary trips data lookup
          // 3. Fragment lookup as fallback
          let destination = null;

          // First try NYCT trainId - this is the most reliable for abbreviated IDs
          if (nyctExtension?.trainId) {
            destination = getDestinationFromTrainId(nyctExtension.trainId);
            if (destination) {
            } else {
              console.log(`NYCT trainId not parsed: ${nyctExtension.trainId}`);
            }
          } else {
            console.log(`No NYCT extension for tripId: ${tripId}`);
          }

          // If not found, try primary lookup
          if (!destination) {
            destination = tripsData[tripKey];
          }

          entity.tripUpdate.stopTimeUpdate.forEach((stopTimeUpdate) => {
            const stopId = stopTimeUpdate.stopId;
            const departureTime = stopTimeUpdate.departure?.time;

            // Filter by the provided station IDs
            if (stationIds.includes(stopId) && departureTime) {
              const timeDiff = departureTime - currentTime;

              if (timeDiff > 0) {
                const trainId = entity.tripUpdate.trip.routeId;

                // Look up the station name in station-data.json
                const stationName = stationData[stopId]?.stop_name || stopId;

                // Determine direction based on last character of stopId
                let direction = "Unknown";
                const lastChar = stopId.slice(-1);
                // Remove the direction suffix (N or S) to get the base station ID
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
                  stations[stopId] = { 
                    name: stationName, 
                    direction: direction,
                    trains: [] 
                  };
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
    console.error('Error:', err);
    res.status(500).json({ error: 'Failed to decode GTFS feed', details: err.message, stack: err.stack });
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