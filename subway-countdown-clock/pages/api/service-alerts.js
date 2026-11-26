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

// Service alerts feed URL
const ALERTS_FEED_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts';

export default async function handler(req, res) {
  const { lines: linesParam } = req.query;

  if (!linesParam) {
    return res.status(200).json({ alerts: [] });
  }

  await loadProtobuf();

  try {
    const requestedLines = linesParam.split(',').filter(l => l && /^[A-Z0-9]+$/.test(l));
    if (requestedLines.length === 0) {
      return res.status(200).json({ alerts: [] });
    }

    const allAlerts = [];

    // Fetch from the unified service alerts feed
    try {
      const response = await fetch(ALERTS_FEED_URL);
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
          if (relevantLines.length > 0) {
            const headerText = alert.headerText?.translation?.[0]?.text || 'Service Alert';
            const descText = alert.descriptionText?.translation?.[0]?.text || '';

            // Determine if it's planned work
            // Check GTFS cause field: MAINTENANCE (9) or CONSTRUCTION (10)
            // Also check entity ID for "planned_work" as MTA doesn't always set cause correctly
            const isPlanned = alert.cause === 9 || alert.cause === 10 ||
                            (entity.id && entity.id.includes('planned_work'));

            allAlerts.push({
              id: entity.id,
              headerText: headerText,
              descriptionText: descText,
              affectedLines: [...affectedLines],
              activePeriod: alert.activePeriod?.[0] ? {
                start: alert.activePeriod[0].start ? Number(alert.activePeriod[0].start) : null,
                end: alert.activePeriod[0].end ? Number(alert.activePeriod[0].end) : null,
              } : null,
              isPlanned: isPlanned,
              cause: alert.cause || 1,
              effect: alert.effect || 8,
            });
          }
        }
      });
    } catch (error) {
      console.error('Error fetching service alerts:', error.message);
    }

    // Sort by planned status first (active alerts first), then by start time
    allAlerts.sort((a, b) => {
      // Active alerts before planned
      if (!a.isPlanned && b.isPlanned) return -1;
      if (a.isPlanned && !b.isPlanned) return 1;

      // Then sort by start time (most recent first)
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
