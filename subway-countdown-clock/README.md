# NYC Subway Countdown Clock

A real-time subway arrival display for Raspberry Pi, optimized for touchscreen displays. Shows live train arrival times and service alerts from the MTA.

## Features

- **Real-time train arrivals** - Live data from MTA GTFS feeds
- **Service alerts** - Color-coded alerts (red for delays, blue for planned work)
- **Multiple display modes** - Normal, Compact (800x480), Portrait (480x800)
- **Touchscreen optimized** - Easy station selection and configuration
- **Always-on display** - Screen wake lock prevents sleep
- **Kiosk mode ready** - Perfect for dedicated displays

## Raspberry Pi Setup

**Running on a Raspberry Pi with touchscreen? See [PI-SETUP.md](PI-SETUP.md) for complete setup instructions!**

The setup script will configure:
- Fullscreen kiosk mode
- Always-on display (no screen blanking)
- Auto-start on boot
- Hide mouse cursor

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Add your MTA API key

Create a `.env.local` file (the app works without this, but rate limits are higher with an API key):

```
MTA_API_KEY=your_key_here
```

Get a free API key at: https://api.mta.info/

### 3. Run the development server

```bash
npm run dev
```

### 4. Configure your display

1. Open [http://localhost:3000/setup](http://localhost:3000/setup)
2. Select your subway line
3. Select your stations (Northbound/Southbound)
4. Choose display mode:
   - **Normal**: Large text, desktop/tablet
   - **Compact**: 800x480 horizontal displays
   - **Portrait**: 480x800 vertical displays
5. Click "Save & Go"

## Display Modes

| Mode | Resolution | Orientation | Best For |
|------|------------|-------------|----------|
| Normal | Any | Any | Desktop, tablet, development |
| Compact | 800x480 | Landscape | 7" landscape touchscreens |
| Portrait | 480x800 | Portrait | 5" Elecrow, portrait displays |

## Service Alerts

The app shows real-time service alerts from the MTA:

- **Red banner (⚠)**: Active alerts (delays, disruptions)
- **Blue banner (🔧)**: Planned work (scheduled maintenance)
- Automatically filtered by selected subway lines
- Only shows alerts during their active time period
- Scrolling ticker for multiple alerts

## Production Deployment

### Build and run

```bash
npm run build
npm start
```

### Run with PM2 (recommended)

```bash
npm install -g pm2
npm run build
pm2 start npm --name "subway-clock" -- start
pm2 save
pm2 startup
```

## Development

Built with:
- [Next.js 16](https://nextjs.org/) with Turbopack
- [Tailwind CSS](https://tailwindcss.com/)
- MTA GTFS Realtime API
- Protocol Buffers for binary MTA data

## Project Structure

```
app/
  page.tsx          # Main countdown display
  setup/page.tsx    # Station selection interface
pages/api/
  mta.js           # Train arrival data endpoint
  service-alerts.js # Service alerts endpoint
  proto/           # GTFS protobuf definitions
```

## License

MIT
