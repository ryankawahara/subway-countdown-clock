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

type ServiceAlert = {
  id: string;
  headerText: string;
  descriptionText: string;
  affectedLines: string[];
  activePeriod: { start: number | null; end: number | null } | null;
  isPlanned?: boolean;
  cause: number;
  effect: number;
};

export default function Home() {
  const [mtaData, setMtaData] = useState<{
    stations: Record<string, { name: string; direction: string; trains: { trainId: string; rawEta: number; destination: string }[] }>;
  } | null>(null);
  const [serviceAlerts, setServiceAlerts] = useState<ServiceAlert[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stations, setStations] = useState("A40N,A40S,231N,231S");
  const [showSettings, setShowSettings] = useState(true);
  const [displayMode, setDisplayMode] = useState<"normal" | "compact" | "portrait">("normal");
  const [showTimeFormat, setShowTimeFormat] = useState<Set<string>>(new Set());

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

  // Fetch service alerts
  useEffect(() => {
    async function fetchAlerts() {
      try {
        // Extract unique lines from stations
        // A40N -> A, 231N -> 2,3 (numbers are individual lines)
        const lines = [...new Set(
          stations.split(',').flatMap(s => {
            const match = s.match(/^([A-Z]+)|(\d+)/g);
            if (!match) return [];
            return match.map(m => m.match(/[A-Z]/) ? m : m.split('').filter(c => /\d/.test(c))).flat();
          }).filter(Boolean)
        )];

        if (lines.length > 0) {
          const response = await fetch(`/api/service-alerts?lines=${lines.join(',')}`);
          const data = await response.json();
          setServiceAlerts(data.alerts || []);
        }
      } catch (error) {
        console.error("Failed to fetch service alerts:", error);
      }
    }

    fetchAlerts();
    // Refresh alerts every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [stations]);

  // Update clock every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // Prevent screen from sleeping
  useEffect(() => {
    let wakeLock: any = null;

    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Wake Lock acquired');
        }
      } catch (err) {
        console.error('Wake Lock error:', err);
      }
    }

    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock !== null) {
        wakeLock.release().then(() => {
          console.log('Wake Lock released');
        });
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const timeString = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Toggle time format for a specific station
  const toggleTimeFormat = (stationId: string) => {
    setShowTimeFormat(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stationId)) {
        newSet.delete(stationId);
      } else {
        newSet.add(stationId);
      }
      return newSet;
    });
  };

  // Format arrival time from rawEta (seconds)
  const formatArrivalTime = (rawEta: number) => {
    const arrivalDate = new Date(Date.now() + rawEta * 1000);
    return arrivalDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

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
        <div className="px-2 pt-1">
          {/* Time and Service Alerts Header */}
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-sm font-bold">{timeString}</h1>
          </div>

          {/* Service Alerts Ticker */}
          {(() => {
            const now = Math.floor(Date.now() / 1000); // Current time in Unix timestamp

            // Filter alerts that are currently active (within their time range)
            const currentAlerts = serviceAlerts.filter(alert => {
              if (!alert.activePeriod) return true; // Show if no time range specified
              const { start, end } = alert.activePeriod;

              // Alert is active if:
              // - No end time and start time has passed, OR
              // - Current time is between start and end
              if (end === null) {
                return !start || now >= start;
              }
              return (!start || now >= start) && now <= end;
            });

            const activeAlerts = currentAlerts.filter(a => !a.isPlanned);
            const plannedAlerts = currentAlerts.filter(a => a.isPlanned);

            return (
              <div className="space-y-1">
                {/* Active Alerts - Red/Orange */}
                {activeAlerts.length > 0 && (
                  <div className="bg-red-600 text-white px-2 py-1 rounded text-xs overflow-hidden relative">
                    <div className="flex items-center gap-2">
                      <span className="font-bold flex-shrink-0">⚠</span>
                      <div className="flex-1 overflow-hidden relative">
                        {activeAlerts.length === 1 ? (
                          <div className="whitespace-nowrap overflow-hidden text-ellipsis">
                            <span className="font-semibold">
                              {activeAlerts[0].affectedLines.length > 0 && `[${activeAlerts[0].affectedLines.join(',')}] `}
                            </span>
                            <span>{activeAlerts[0].headerText}</span>
                            {activeAlerts[0].activePeriod?.start && (
                              <span className="ml-2 opacity-80">
                                {new Date(activeAlerts[0].activePeriod.start * 1000).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="animate-scroll whitespace-nowrap">
                            {activeAlerts.map((alert) => (
                              <span key={alert.id} className="inline-block mr-8">
                                <span className="font-semibold">
                                  {alert.affectedLines.length > 0 && `[${alert.affectedLines.join(',')}] `}
                                </span>
                                <span>{alert.headerText}</span>
                                {alert.activePeriod?.start && (
                                  <span className="ml-2 opacity-80">
                                    {new Date(alert.activePeriod.start * 1000).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Planned Work - Blue */}
                {plannedAlerts.length > 0 && (
                  <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs overflow-hidden relative">
                    <div className="flex items-center gap-2">
                      <span className="font-bold flex-shrink-0">🔧</span>
                      <div className="flex-1 overflow-hidden relative">
                        {plannedAlerts.length === 1 ? (
                          <div className="whitespace-nowrap overflow-hidden text-ellipsis">
                            <span className="font-semibold">
                              {plannedAlerts[0].affectedLines.length > 0 && `[${plannedAlerts[0].affectedLines.join(',')}] `}
                            </span>
                            <span>{plannedAlerts[0].headerText}</span>
                            {plannedAlerts[0].activePeriod?.start && (
                              <span className="ml-2 opacity-80">
                                {new Date(plannedAlerts[0].activePeriod.start * 1000).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="animate-scroll whitespace-nowrap">
                            {plannedAlerts.map((alert) => (
                              <span key={alert.id} className="inline-block mr-8">
                                <span className="font-semibold">
                                  {alert.affectedLines.length > 0 && `[${alert.affectedLines.join(',')}] `}
                                </span>
                                <span>{alert.headerText}</span>
                                {alert.activePeriod?.start && (
                                  <span className="ml-2 opacity-80">
                                    {new Date(alert.activePeriod.start * 1000).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <style jsx>{`
            @keyframes scroll {
              0% {
                transform: translateX(0);
              }
              100% {
                transform: translateX(-50%);
              }
            }
            .animate-scroll {
              display: inline-block;
              animation: scroll 40s linear infinite;
            }
          `}</style>
        </div>
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
              // Portrait mode - N/S side by side, optimized for 480x800
              <div className="space-y-3">
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

                        {/* N/S side by side with scrollable overflow */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Northbound direction */}
                          {northStation ? (
                            <div>
                              <h3 className="text-xs font-medium mb-1">{northStation.direction}</h3>
                              <div
                                className="max-h-32 overflow-y-auto space-y-1 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTimeFormat(`${baseId}N`);
                                }}
                              >
                                {northStation.trains.map((train, index) => (
                                  <div
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
                                        {showTimeFormat.has(`${baseId}N`)
                                          ? formatArrivalTime(train.rawEta)
                                          : `${train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}m`
                                        }
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-xs">No northbound trains</div>
                          )}

                          {/* Southbound direction */}
                          {southStation ? (
                            <div>
                              <h3 className="text-xs font-medium mb-1">{southStation.direction}</h3>
                              <div
                                className="max-h-32 overflow-y-auto space-y-1 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTimeFormat(`${baseId}S`);
                                }}
                              >
                                {southStation.trains.map((train, index) => (
                                  <div
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
                                        {showTimeFormat.has(`${baseId}S`)
                                          ? formatArrivalTime(train.rawEta)
                                          : `${train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}m`
                                        }
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-xs">No southbound trains</div>
                          )}
                        </div>
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
                            <ul
                              className="space-y-1 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTimeFormat(`${baseId}N`);
                              }}
                            >
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
                                      {showTimeFormat.has(`${baseId}N`)
                                        ? formatArrivalTime(train.rawEta)
                                        : `${train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}m`
                                      }
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
                            <ul
                              className="space-y-1 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTimeFormat(`${baseId}S`);
                              }}
                            >
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
                                      {showTimeFormat.has(`${baseId}S`)
                                        ? formatArrivalTime(train.rawEta)
                                        : `${train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}m`
                                      }
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
                    <ul
                      className="space-y-2 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTimeFormat(stationId);
                      }}
                    >
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
                            {showTimeFormat.has(stationId) ? (
                              <p className="text-2xl font-bold">
                                {formatArrivalTime(train.rawEta)}
                              </p>
                            ) : (
                              <>
                                <p className="text-2xl font-bold">
                                  {train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}
                                </p>
                                <p className="text-xs">
                                  min
                                </p>
                              </>
                            )}
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