"use client";
import { useEffect, useState } from "react";
import subwayColors from "../pages/api/subway-colors.json";

const MAX_NUM = 3;

// Train bullet component
function TrainBullet({ line }: { line: string }) {
  const lineData = subwayColors.lines[line as keyof typeof subwayColors.lines];
  const color = lineData?.hex_color || "#808183";
  // Yellow lines need dark text for contrast
  const textColor = ["N", "Q", "R", "W"].includes(line) ? "#000000" : "#FFFFFF";

  return (
    <div
      className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm"
      style={{ backgroundColor: color, color: textColor }}
    >
      {line}
    </div>
  );
}

export default function Home() {
  const [mtaData, setMtaData] = useState<{
    stations: Record<string, { name: string; direction: string; trains: { trainId: string; rawEta: number; destination: string }[] }>;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stations, setStations] = useState("A40N,A40S,231N,231S");
  const [showSettings, setShowSettings] = useState(true);
  const [displayMode, setDisplayMode] = useState<"normal" | "compact" | "portrait">("normal");

  // Load stations and display mode from localStorage
  useEffect(() => {
    const savedStations = localStorage.getItem("selectedStations");
    if (savedStations) {
      setStations(savedStations);
    }
    const savedDisplayMode = localStorage.getItem("displayMode");
    if (savedDisplayMode === "compact" || savedDisplayMode === "portrait") {
      setDisplayMode(savedDisplayMode);
    } else {
      // Legacy support for old compactMode setting
      const savedCompactMode = localStorage.getItem("compactMode");
      if (savedCompactMode === "true") {
        setDisplayMode("compact");
      }
    }
  }, []);

  useEffect(() => {
    async function fetchMTA() {
      try {
        const response = await fetch(`/api/mta?stations=${stations}`);
        const data = await response.json();
        setMtaData(data);
      } catch (error) {
        console.error("Failed to fetch MTA data:", error);
      }
    }

    // Fetch data immediately on component mount
    fetchMTA();

    // Set up an interval to fetch data every 30 seconds
    const interval = setInterval(fetchMTA, 30 * 1000);

    // Clean up the interval when the component unmounts
    return () => clearInterval(interval);
  }, [stations]);

  // Update clock every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  const timeString = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div
      className="min-h-screen font-sans relative"
      onClick={(e) => {
        // Toggle settings visibility when clicking the display area (not the button itself)
        if ((e.target as HTMLElement).closest('a, button')) return;
        setShowSettings(!showSettings);
      }}
    >
      {/* Settings button - large touch target, toggleable */}
      {showSettings && (
        <a
          href="/setup"
          className="fixed top-4 right-4 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white p-4 rounded-lg text-xl font-bold z-10 min-w-[80px] min-h-[80px] flex items-center justify-center"
        >
          ⚙️
        </a>
      )}

      {(displayMode === "compact" || displayMode === "portrait") && (
        <h1 className="text-xl font-bold px-4 pt-2 text-center">{timeString}</h1>
      )}
      <div className={
        displayMode === "normal"
          ? "flex min-h-screen items-center justify-center"
          : "flex flex-1 items-start justify-center pt-2"
      }>
        <main className={`flex w-full flex-col ${
          displayMode === "normal" ? "px-16 max-w-3xl" : "px-4 max-w-full"
        }`}>
          {displayMode === "normal" && <h1 className="text-2xl font-bold">{timeString}</h1>}
          <div className={displayMode === "normal" ? "mt-4" : ""}>
          {mtaData ? (
            displayMode === "portrait" ? (
              // Portrait mode - single column, optimized for 480x800
              <div className="space-y-1">
                {/* Group stations by base ID (without N/S suffix) */}
                {(() => {
                  // Get unique base station IDs
                  const baseStationIds = [...new Set(
                    Object.keys(mtaData.stations).map(id => id.slice(0, -1))
                  )];

                  return baseStationIds.map(baseId => {
                    const northStation = mtaData.stations[`${baseId}N`];
                    const southStation = mtaData.stations[`${baseId}S`];
                    const stationName = northStation?.name || southStation?.name || baseId;

                    return (
                      <div key={baseId} className="text-xs">
                        <h2 className="text-sm font-semibold mb-1">{stationName}</h2>

                        {/* Northbound direction */}
                        {northStation && (
                          <div className="mb-2">
                            <h3 className="text-xs font-medium mb-1">{northStation.direction}</h3>
                            <ul className="space-y-1">
                              {northStation.trains.slice(0, 2).map((train, index) => (
                                <li
                                  key={index}
                                  className="p-1 rounded bg-gray-600 flex items-center gap-1"
                                >
                                  <div className="inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-xs"
                                       style={{
                                         backgroundColor: subwayColors.lines[train.trainId as keyof typeof subwayColors.lines]?.hex_color || "#808183",
                                         color: ["N", "Q", "R", "W"].includes(train.trainId) ? "#000000" : "#FFFFFF"
                                       }}>
                                    {train.trainId}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs truncate">
                                      {train.destination}
                                    </p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm font-bold">
                                      {train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}m
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Southbound direction */}
                        {southStation && (
                          <div>
                            <h3 className="text-xs font-medium mb-1">{southStation.direction}</h3>
                            <ul className="space-y-1">
                              {southStation.trains.slice(0, 2).map((train, index) => (
                                <li
                                  key={index}
                                  className="p-1 rounded bg-gray-600 flex items-center gap-1"
                                >
                                  <div className="inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-xs"
                                       style={{
                                         backgroundColor: subwayColors.lines[train.trainId as keyof typeof subwayColors.lines]?.hex_color || "#808183",
                                         color: ["N", "Q", "R", "W"].includes(train.trainId) ? "#000000" : "#FFFFFF"
                                       }}>
                                    {train.trainId}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs truncate">
                                      {train.destination}
                                    </p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm font-bold">
                                      {train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}m
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            ) : displayMode === "compact" ? (
              // Compact mode - 2 columns, optimized for 800x480
              <div className="grid grid-cols-2 gap-3">
                {/* Same content as portrait but in 2 columns */}
                {(() => {
                  const baseStationIds = [...new Set(
                    Object.keys(mtaData.stations).map(id => id.slice(0, -1))
                  )];

                  return baseStationIds.map(baseId => {
                    const northStation = mtaData.stations[`${baseId}N`];
                    const southStation = mtaData.stations[`${baseId}S`];
                    const stationName = northStation?.name || southStation?.name || baseId;

                    return (
                      <div key={baseId} className="text-xs">
                        <h2 className="text-sm font-semibold mb-1">{stationName}</h2>

                        {/* Northbound direction */}
                        {northStation && (
                          <div className="mb-2">
                            <h3 className="text-xs font-medium mb-1">{northStation.direction}</h3>
                            <ul className="space-y-1">
                              {northStation.trains.slice(0, 2).map((train, index) => (
                                <li
                                  key={index}
                                  className="p-1 rounded bg-gray-600 flex items-center gap-1"
                                >
                                  <div className="inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-xs"
                                       style={{
                                         backgroundColor: subwayColors.lines[train.trainId as keyof typeof subwayColors.lines]?.hex_color || "#808183",
                                         color: ["N", "Q", "R", "W"].includes(train.trainId) ? "#000000" : "#FFFFFF"
                                       }}>
                                    {train.trainId}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs truncate">
                                      {train.destination}
                                    </p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm font-bold">
                                      {train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}m
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Southbound direction */}
                        {southStation && (
                          <div>
                            <h3 className="text-xs font-medium mb-1">{southStation.direction}</h3>
                            <ul className="space-y-1">
                              {southStation.trains.slice(0, 2).map((train, index) => (
                                <li
                                  key={index}
                                  className="p-1 rounded bg-gray-600 flex items-center gap-1"
                                >
                                  <div className="inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-xs"
                                       style={{
                                         backgroundColor: subwayColors.lines[train.trainId as keyof typeof subwayColors.lines]?.hex_color || "#808183",
                                         color: ["N", "Q", "R", "W"].includes(train.trainId) ? "#000000" : "#FFFFFF"
                                       }}>
                                    {train.trainId}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs truncate">
                                      {train.destination}
                                    </p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm font-bold">
                                      {train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}m
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              // Normal mode - single column, large text
              <div>
                {Object.entries(mtaData.stations)
                  .sort(([a], [b]) => {
                    // Sort so northbound (N) appears before southbound (S)
                    const aDir = a.slice(-1);
                    const bDir = b.slice(-1);
                    if (aDir === 'N' && bDir === 'S') return -1;
                    if (aDir === 'S' && bDir === 'N') return 1;
                    return 0;
                  })
                  .map(([stationId, stationData]) => (
                  <div key={stationId} className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">{stationData.name} ({stationData.direction})</h2>
                    <ul className="space-y-2">
                      {stationData.trains.slice(0, MAX_NUM).map((train, index) => (
                        <li
                          key={index}
                          className="p-2 rounded bg-gray-600 flex items-center gap-3"
                        >
                          <TrainBullet line={train.trainId} />
                          <div className="flex-1">
                            <p className="text-lg">
                              {train.destination}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">
                              {train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}
                            </p>
                            <p className="text-xs">
                              min
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p>Loading data...</p>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}