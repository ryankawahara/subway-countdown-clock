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
    stations: Record<string, { name: string; direction: string; trains: { trainId: string; rawEta: number; destination: string; delay?: number }[] }>;
  } | null>(null);
  const [serviceAlerts, setServiceAlerts] = useState<ServiceAlert[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stations, setStations] = useState<string | null>(null); // null until loaded from localStorage
  const [showSettings, setShowSettings] = useState(true);
  const [displayMode, setDisplayMode] = useState<"normal" | "compact" | "portrait">("portrait");
  const [showTimeFormat, setShowTimeFormat] = useState<Set<string>>(new Set());
  const [expandedAlert, setExpandedAlert] = useState<ServiceAlert | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  // Track viewport size for debug
  useEffect(() => {
    const updateSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Load stations and display mode from localStorage or URL params
  useEffect(() => {
    // Check URL params first (allows setting via URL)
    const urlParams = new URLSearchParams(window.location.search);

    // Check for debug mode
    if (urlParams.get("debug") === "true") {
      setShowDebug(true);
    }
    const urlMode = urlParams.get("mode");
    const urlStations = urlParams.get("stations");

    if (urlStations) {
      setStations(urlStations);
      localStorage.setItem("selectedStations", urlStations);
    } else {
      const savedStations = localStorage.getItem("selectedStations");
      // Use saved stations or default (High St A/C, Clark St 2/3, York St F)
      setStations(savedStations || "A40N,A40S,231N,231S,F18N,F18S");
    }

    if (urlMode === "portrait" || urlMode === "compact" || urlMode === "normal") {
      setDisplayMode(urlMode);
      localStorage.setItem("displayMode", urlMode);
    } else {
      const savedDisplayMode = localStorage.getItem("displayMode");
      if (savedDisplayMode === "compact" || savedDisplayMode === "portrait" || savedDisplayMode === "normal") {
        setDisplayMode(savedDisplayMode);
      } else {
        // Default to portrait mode
        setDisplayMode("portrait");
      }
    }
  }, []);

  useEffect(() => {
    // Don't fetch until stations are loaded from localStorage
    if (stations === null) return;

    async function fetchMTA() {
      try {
        const response = await fetch(`/api/mta?stations=${stations}`);
        const data = await response.json();
        setMtaData(data);
      } catch (error) {
        console.error("Failed to fetch MTA data:", error);
      }
    }

    // Fetch data immediately
    fetchMTA();

    // Set up an interval to fetch data every 30 seconds
    const interval = setInterval(fetchMTA, 30 * 1000);

    // Clean up the interval when the component unmounts
    return () => clearInterval(interval);
  }, [stations]);

  // Fetch service alerts
  useEffect(() => {
    // Don't fetch until stations are loaded from localStorage
    if (!stations) return;

    // Capture stations value for use in async function
    const stationList = stations;

    async function fetchAlerts() {
      try {
        // Extract unique lines from stations
        // A40N -> A, 231N -> 2,3 (numbers are individual lines)
        const lines = [...new Set(
          stationList.split(',').flatMap(s => {
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
      className="h-screen font-sans relative overflow-hidden flex flex-col"
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

      {/* Expanded Alert Modal */}
      {expandedAlert && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedAlert(null)}
        >
          <div
            className={`${expandedAlert.isPlanned ? 'bg-blue-600' : 'bg-red-600'} text-white p-6 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">{expandedAlert.isPlanned ? '🔧' : '⚠'}</span>
              <div>
                {expandedAlert.affectedLines.length > 0 && (
                  <div className="flex gap-1 mb-2">
                    {expandedAlert.affectedLines.map(line => (
                      <span
                        key={line}
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs"
                        style={{
                          backgroundColor: subwayColors.lines[line as keyof typeof subwayColors.lines]?.hex_color || "#808183",
                          color: ["N", "Q", "R", "W"].includes(line) ? "#000000" : "#FFFFFF"
                        }}
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                )}
                <h3 className="text-lg font-bold">{expandedAlert.headerText}</h3>
              </div>
            </div>
            <p className="text-base leading-relaxed whitespace-pre-wrap">{expandedAlert.descriptionText}</p>
            {expandedAlert.activePeriod?.start && (
              <p className="mt-4 text-sm opacity-80">
                {new Date(expandedAlert.activePeriod.start * 1000).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
                {expandedAlert.activePeriod.end && (
                  <> - {new Date(expandedAlert.activePeriod.end * 1000).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}</>
                )}
              </p>
            )}
            <p className="mt-4 text-center text-sm opacity-60">Tap anywhere to close</p>
          </div>
        </div>
      )}

      {(displayMode === "compact" || displayMode === "portrait") && (
        <div className="px-3 pt-2 flex-shrink-0">
          {/* Time and Service Alerts Header */}
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-bold">{timeString}</h1>
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
                  <div
                    className="bg-red-600 text-white px-3 py-2 rounded text-base overflow-hidden relative cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedAlert(activeAlerts[0]);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold flex-shrink-0">⚠</span>
                      <div className="flex-1 overflow-hidden relative">
                        <div className="animate-scroll whitespace-nowrap">
                          {activeAlerts.map((alert) => (
                            <span
                              key={alert.id}
                              className="inline-block mr-16"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedAlert(alert);
                              }}
                            >
                              <span className="font-semibold">
                                {alert.affectedLines.length > 0 && `[${alert.affectedLines.join(',')}] `}
                              </span>
                              <span>{alert.headerText}</span>
                            </span>
                          ))}
                          {/* Duplicate for seamless loop */}
                          {activeAlerts.map((alert) => (
                            <span
                              key={`${alert.id}-dup`}
                              className="inline-block mr-16"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedAlert(alert);
                              }}
                            >
                              <span className="font-semibold">
                                {alert.affectedLines.length > 0 && `[${alert.affectedLines.join(',')}] `}
                              </span>
                              <span>{alert.headerText}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Planned Work - Blue */}
                {plannedAlerts.length > 0 && (
                  <div
                    className="bg-blue-600 text-white px-3 py-2 rounded text-base overflow-hidden relative cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedAlert(plannedAlerts[0]);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold flex-shrink-0">🔧</span>
                      <div className="flex-1 overflow-hidden relative">
                        <div className="animate-scroll whitespace-nowrap">
                          {plannedAlerts.map((alert) => (
                            <span
                              key={alert.id}
                              className="inline-block mr-16"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedAlert(alert);
                              }}
                            >
                              <span className="font-semibold">
                                {alert.affectedLines.length > 0 && `[${alert.affectedLines.join(',')}] `}
                              </span>
                              <span>{alert.headerText}</span>
                            </span>
                          ))}
                          {/* Duplicate for seamless loop */}
                          {plannedAlerts.map((alert) => (
                            <span
                              key={`${alert.id}-dup`}
                              className="inline-block mr-16"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedAlert(alert);
                              }}
                            >
                              <span className="font-semibold">
                                {alert.affectedLines.length > 0 && `[${alert.affectedLines.join(',')}] `}
                              </span>
                              <span>{alert.headerText}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      <div className={
        displayMode === "normal"
          ? "flex min-h-screen items-center justify-center"
          : "flex-1 flex flex-col min-h-0"
      }>
        <main className={`flex flex-col flex-1 min-h-0 ${
          displayMode === "normal" ? "px-16 max-w-3xl w-full justify-center" : "px-3 w-full"
        }`}>
          {displayMode === "normal" && <h1 className="text-2xl font-bold">{timeString}</h1>}
          <div className={displayMode === "normal" ? "mt-4" : "flex-1 flex flex-col min-h-0"}>
          {mtaData ? (
            displayMode === "portrait" ? (
              // Portrait mode - optimized for 480x800, fills screen
              <div className="flex flex-col flex-1 justify-between gap-1">
                {/* Group stations by base ID (without N/S suffix) */}
                {(() => {
                  // Get unique base station IDs
                  const baseStationIds = [...new Set(
                    Object.keys(mtaData.stations).map(id => id.slice(0, -1))
                  )];
                  // Limit trains based on number of stations
                  const maxTrains = baseStationIds.length <= 1 ? 4 : baseStationIds.length <= 2 ? 4 : 3;

                  return baseStationIds.map(baseId => {
                    const northStation = mtaData.stations[`${baseId}N`];
                    const southStation = mtaData.stations[`${baseId}S`];
                    const stationName = northStation?.name || southStation?.name || baseId;

                    return (
                      <div key={baseId} className="flex-1 flex flex-col">
                        <h2 className="font-bold" style={{ fontSize: 'clamp(1rem, 2.5vh, 1.5rem)' }}>{stationName}</h2>

                        {/* N/S side by side */}
                        <div className="grid grid-cols-2 gap-2 flex-1">
                          {/* Northbound direction */}
                          <div className="flex flex-col">
                            <h3 className="text-gray-400" style={{ fontSize: 'clamp(0.75rem, 2vh, 1rem)' }}>{northStation?.direction || "Uptown"}</h3>
                            <div className="flex flex-col flex-1 gap-1">
                              {northStation?.trains.slice(0, maxTrains).map((train, index) => (
                                <div
                                  key={index}
                                  className="px-1 rounded bg-gray-700 flex items-center gap-1"
                                >
                                  <div className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
                                       style={{
                                         width: '5vh',
                                         height: '5vh',
                                         fontSize: '3vh',
                                         backgroundColor: subwayColors.lines[train.trainId as keyof typeof subwayColors.lines]?.hex_color || "#808183",
                                         color: ["N", "Q", "R", "W"].includes(train.trainId) ? "#000000" : "#FFFFFF"
                                       }}>
                                    {train.trainId}
                                  </div>
                                  <div className="flex-1 min-w-0 overflow-hidden flex items-center">
                                    <span className="leading-tight line-clamp-2" style={{ fontSize: 'clamp(0.7rem, 1.8vh, 0.9rem)' }}>
                                      {train.destination}
                                    </span>
                                  </div>
                                  <div className="flex items-center flex-shrink-0">
                                    <span className="font-bold" style={{ fontSize: 'clamp(1.5rem, 8vh, 4rem)' }}>
                                      {train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}m
                                    </span>
                                  </div>
                                </div>
                              ))}
                              {(!northStation || northStation.trains.length === 0) && (
                                <div className="text-gray-500 py-2 flex-1 flex items-center" style={{ fontSize: 'clamp(0.75rem, 2vh, 1rem)' }}>No trains</div>
                              )}
                            </div>
                          </div>

                          {/* Southbound direction */}
                          <div className="flex flex-col">
                            <h3 className="text-gray-400" style={{ fontSize: 'clamp(0.75rem, 2vh, 1rem)' }}>{southStation?.direction || "Downtown"}</h3>
                            <div className="flex flex-col flex-1 gap-1">
                              {southStation?.trains.slice(0, maxTrains).map((train, index) => (
                                <div
                                  key={index}
                                  className="px-1 rounded bg-gray-700 flex items-center gap-1"
                                >
                                  <div className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
                                       style={{
                                         width: '5vh',
                                         height: '5vh',
                                         fontSize: '3vh',
                                         backgroundColor: subwayColors.lines[train.trainId as keyof typeof subwayColors.lines]?.hex_color || "#808183",
                                         color: ["N", "Q", "R", "W"].includes(train.trainId) ? "#000000" : "#FFFFFF"
                                       }}>
                                    {train.trainId}
                                  </div>
                                  <div className="flex-1 min-w-0 overflow-hidden flex items-center">
                                    <span className="leading-tight line-clamp-2" style={{ fontSize: 'clamp(0.7rem, 1.8vh, 0.9rem)' }}>
                                      {train.destination}
                                    </span>
                                  </div>
                                  <div className="flex items-center flex-shrink-0">
                                    <span className="font-bold" style={{ fontSize: 'clamp(1.5rem, 8vh, 4rem)' }}>
                                      {train.rawEta < 60 ? "0" : Math.floor(train.rawEta / 60)}m
                                    </span>
                                  </div>
                                </div>
                              ))}
                              {(!southStation || southStation.trains.length === 0) && (
                                <div className="text-gray-500 py-2 flex-1 flex items-center" style={{ fontSize: 'clamp(0.75rem, 2vh, 1rem)' }}>No trains</div>
                              )}
                            </div>
                          </div>
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

      {/* Debug overlay - always visible for now */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 text-green-400 p-2 text-xs font-mono z-50">
        <div>BUILD: 2024-v1 | Viewport: {viewportSize.width}x{viewportSize.height}</div>
        <div>Mode: {displayMode}</div>
        <div>5vh = {Math.round(viewportSize.height * 0.05)}px | 8vh = {Math.round(viewportSize.height * 0.08)}px</div>
      </div>
    </div>
  );
}