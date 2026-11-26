# Raspberry Pi Setup Guide

This guide will help you set up the Subway Countdown Clock on your Raspberry Pi Zero 2 W with Elecrow touchscreen in fullscreen, portrait mode, and always-on.

## Prerequisites

- Raspberry Pi Zero 2 W with Raspberry Pi OS installed
- Elecrow 480x800 touchscreen connected
- Node.js installed (v18 or later)
- Project cloned and dependencies installed (`npm install`)

## Quick Setup

### 1. Run the setup script

```bash
chmod +x setup-pi.sh
./setup-pi.sh
```

This script will:
- Install Chromium browser
- Install `unclutter` to hide the mouse cursor
- Configure autostart to launch in kiosk mode
- Disable screen blanking

### 2. Build and start the app

For production (recommended):
```bash
npm run build
npm start
```

Or for development:
```bash
npm run dev
```

### 3. Configure your display

1. Open a browser and go to `http://localhost:3000/setup`
2. Select your subway line (e.g., "A/C/E" or "1/2/3")
3. Select your stations by tapping Northbound or Southbound
4. Set display mode to **"Portrait"** (480x800)
5. Click "Save & Go"

### 4. Reboot

```bash
sudo reboot
```

After reboot, the display will automatically launch in fullscreen!

## What Gets Configured

### Kiosk Mode
- Chromium launches automatically in fullscreen kiosk mode
- No browser UI elements visible
- Points to `http://localhost:3000`

### Always-On Display
- Screen blanking disabled via `xset s off`
- DPMS (Display Power Management) disabled
- Wake Lock API in the app keeps screen active

### Auto-Hide Cursor
- `unclutter` hides the mouse cursor after 0.5 seconds of inactivity

## Manual Configuration (Advanced)

If you need to manually configure, here's what the script does:

### 1. Create autostart file

Edit `~/.config/lxsession/LXDE-pi/autostart`:

```bash
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
@xscreensaver -no-splash

# Disable screen blanking
@xset s off
@xset -dpms
@xset s noblank

# Hide mouse cursor
@unclutter -idle 0.5 -root

# Start Chromium in kiosk mode
@chromium-browser --noerrdialogs --disable-infobars --kiosk --disable-session-crashed-bubble --disable-restore-session-state http://localhost:3000
```

### 2. Install required packages

```bash
sudo apt-get update
sudo apt-get install -y chromium-browser unclutter
```

### 3. Disable screen blanking immediately

```bash
xset s off
xset -dpms
xset s noblank
```

## Running on Boot with PM2 (Recommended for Production)

To ensure the Node.js app starts automatically on boot:

### 1. Install PM2

```bash
sudo npm install -g pm2
```

### 2. Build the app

```bash
npm run build
```

### 3. Start with PM2

```bash
pm2 start npm --name "subway-clock" -- start
```

### 4. Save PM2 configuration

```bash
pm2 save
```

### 5. Setup PM2 to run on startup

```bash
pm2 startup
```

This will output a command - **run that command** (it will start with `sudo`).

### 6. Verify it's running

```bash
pm2 list
```

## Troubleshooting

### Display rotated incorrectly
If the screen is rotated 180 degrees, add to `/boot/config.txt`:
```
lcd_rotate=2
```

### Touch not working
Make sure the touchscreen drivers are installed. For Elecrow displays, you may need to run their setup script.

### App not starting on boot
Check PM2 status:
```bash
pm2 list
pm2 logs subway-clock
```

### Chromium not launching
Check the autostart file exists:
```bash
cat ~/.config/lxsession/LXDE-pi/autostart
```

### Screen still blanking
Run these commands again after reboot:
```bash
xset s off
xset -dpms
xset s noblank
```

## Accessing Settings After Setup

Since the app runs in kiosk mode, you have two options to change settings:

### Option 1: SSH into the Pi
1. SSH from another computer: `ssh pi@<pi-ip-address>`
2. Kill Chromium: `pkill chromium`
3. Open browser manually and go to `http://localhost:3000/setup`
4. Make changes
5. Reboot: `sudo reboot`

### Option 2: Use the gear icon
1. Tap anywhere on the display to show the gear icon
2. Tap the gear icon to go to `/setup`
3. Make your changes
4. Tap "Save & Go" to return to the display

## Display Modes

- **Normal**: Large text, best for desktop/tablet viewing
- **Compact** (800x480): Horizontal layout for 7" landscape displays
- **Portrait** (480x800): Vertical layout for 5" portrait displays like Elecrow

Choose **Portrait** mode for your Elecrow 480x800 touchscreen.
