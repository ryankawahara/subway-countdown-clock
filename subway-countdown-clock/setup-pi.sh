#!/bin/bash
# Setup script for Raspberry Pi subway countdown display

echo "Setting up Subway Countdown Clock for Raspberry Pi..."

# Install Chromium if not already installed
echo "Checking for Chromium..."
if ! command -v chromium-browser &> /dev/null; then
    echo "Installing Chromium..."
    sudo apt-get update
    sudo apt-get install -y chromium-browser unclutter xdotool
else
    echo "Chromium already installed"
fi

# Install unclutter to hide mouse cursor
if ! command -v unclutter &> /dev/null; then
    echo "Installing unclutter to hide mouse cursor..."
    sudo apt-get install -y unclutter
fi

# Create autostart directory if it doesn't exist
mkdir -p ~/.config/lxsession/LXDE-pi

# Create autostart file for kiosk mode
cat > ~/.config/lxsession/LXDE-pi/autostart << 'EOF'
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
EOF

echo "Autostart file created at ~/.config/lxsession/LXDE-pi/autostart"

# Disable screen blanking immediately
xset s off
xset -dpms
xset s noblank

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure the app is running: npm run dev or npm run build && npm start"
echo "2. Go to http://localhost:3000/setup and:"
echo "   - Select your subway line"
echo "   - Select your stations (Northbound/Southbound)"
echo "   - Set display mode to 'Portrait' (480x800)"
echo "   - Click 'Save & Go'"
echo "3. Reboot the Pi: sudo reboot"
echo ""
echo "After reboot, Chromium will automatically launch in fullscreen kiosk mode!"
