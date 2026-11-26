const protobuf = require('protobufjs');
const path = require('path');

let root = null;
let FeedMessage = null;

async function loadProtobuf() {
  if (root) return;
  try {
    const protoDir = path.join(process.cwd(), 'pages', 'api', 'proto');
    root = await protobuf.load([
      path.join(protoDir, 'gtfs-realtime.proto'),
      path.join(protoDir, 'nyct-subway.proto')
    ]);
    FeedMessage = root.lookupType('transit_realtime.FeedMessage');
  } catch (error) {
    console.error('Error loading protobuf:', error);
    throw error;
  }
}

// Feed URLs for different line groups
const FEED_URLS = {
  'ACE': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
  'BDFM': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
  'G': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
  'JZ': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
  'NQRW': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
  'L': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
  '1234567': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
};

function getFeedForLine(line) {
  if (['A', 'C', 'E'].includes(line)) return 'ACE';
  if (['B', 'D', 'F', 'M'].includes(line)) return 'BDFM';
  if (line === 'G') return 'G';
  if (['J', 'Z'].includes(line)) return 'JZ';
  if (['N', 'Q', 'R', 'W'].includes(line)) return 'NQRW';
  if (line === 'L') return 'L';
  if (['1', '2', '3', '4', '5', '6', '7'].includes(line)) return '1234567';
  return null;
}

export default async function handler(req, res) {
  const { lines: linesParam } = req.query;

  if (!linesParam) {
    return res.status(200).json({ alerts: [] });
  }

  await loadProtobuf();

  try {
    const requestedLines = linesParam.split(',');
    const feeds = new Set();

    // Get relevant feeds
    requestedLines.forEach(line => {
      const feed = getFeedForLine(line);
      if (feed) feeds.add(feed);
    });

    const allAlerts = [];

    // Fetch alerts from each feed
    for (const feedKey of feeds) {
      try {
        const response = await fetch(FEED_URLS[feedKey]);
        const buffer = await response.arrayBuffer();
        const message = FeedMessage.decode(new Uint8Array(buffer));

        message.entity.forEach(entity => {
          if (entity.alert) {
            const alert = entity.alert;

            // Extract affected lines
            const affectedLines = new Set();
            if (alert.informedEntity) {
              alert.informedEntity.forEach(ie => {
                if (ie.routeId) {
                  affectedLines.add(ie.routeId);
                }
              });
            }

            // Check if any requested lines are affected
            const relevantLines = [...affectedLines].filter(l => requestedLines.includes(l));
            if (relevantLines.length > 0 || affectedLines.size === 0) {
              const headerText = alert.headerText?.translation?.[0]?.text || 'Service Alert';
              const descText = alert.descriptionText?.translation?.[0]?.text || '';

              allAlerts.push({
                id: entity.id,
                headerText: headerText,
                descriptionText: descText,
                affectedLines: [...affectedLines],
                activePeriod: alert.activePeriod?.[0] ? {
                  start: alert.activePeriod[0].start ? Number(alert.activePeriod[0].start) : null,
                  end: alert.activePeriod[0].end ? Number(alert.activePeriod[0].end) : null,
                } : null,
              });
            }
          }
        });
      } catch (error) {
        console.error(`Error fetching alerts for ${feedKey}:`, error.message);
      }
    }

    // Sort by start time (most recent first)
    allAlerts.sort((a, b) => {
      const aTime = a.activePeriod?.start || 0;
      const bTime = b.activePeriod?.start || 0;
      return bTime - aTime;
    });

    res.status(200).json({ alerts: allAlerts.slice(0, 10) });
  } catch (error) {
    console.error('Error processing service alerts:', error);
    res.status(200).json({ alerts: [] });
  }
}
