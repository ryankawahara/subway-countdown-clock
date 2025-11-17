const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;

module.exports = async function handler(req, res) {
  const url = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).json({ error: `Failed to fetch: ${response.status}` });
      return;
    }
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      res.status(502).json({ error: 'Empty response from MTA API' });
      return;
    }
    const buffer = Buffer.from(arrayBuffer);
    const feed = FeedMessage.decode(buffer);
    const feedObj = FeedMessage.toObject(feed, {
      longs: String,
      enums: String,
      bytes: String,
      defaults: true,
      arrays: true,
      objects: true,
    });
    res.status(200).json(feedObj);
  } catch (err) {
    res.status(500).json({ error: 'Failed to decode GTFS feed', details: err.message });
  }
};