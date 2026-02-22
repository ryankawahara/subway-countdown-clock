"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const BusMap = dynamic(() => import("./BusMap"), { ssr: false });

// Grand Av/74 St (both directions) + Calamus Av/74 St (both directions) - Q47, Q58, Q59, Q98
const DEFAULT_STOPS = "MTA_503472,MTA_503528,MTA_551557,MTA_551558";
const MAX_ARRIVALS = 5;

interface BusArrival {
  route: string;
  destination: string;
  expectedArrival: string | null;
  presentableDistance: string | null;
  location: { lat: number; lon: number } | null;
}

interface BusStopData {
  name: string;
  lat: number;
  lon: number;
  arrivals: BusArrival[];
}

// Bus route badge component
function BusRouteBadge({ route }: { route: string }) {
  return (
    <div
      className="inline-flex items-center justify-center min-w-[2.5rem] h-8 px-2 rounded font-bold text-sm bg-amber-500 text-black"
    >
      {route}
    </div>
  );
}

// Live countdown - recalculates from expectedArrival using current time (updates every second)
function MinutesUntilArrival({
  expectedArrival,
  currentTime,
}: {
  expectedArrival: string;
  currentTime: Date;
}) {
  const expectedMs = new Date(expectedArrival).getTime();
  const minutesAway = Math.max(
    0,
    Math.round((expectedMs - currentTime.getTime()) / 60000)
  );
  return (
    <>
      <p className="text-xl font-bold">{minutesAway}</p>
      <p className="text-xs">min</p>
    </>
  );
}

export default function BusTimesPage() {
  const [busData, setBusData] = useState<{ stops: Record<string, BusStopData> } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBusData() {
      try {
        setError(null);
        const response = await fetch(`/api/bus?stops=${DEFAULT_STOPS}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch bus data");
        }

        setBusData(data);
      } catch (err) {
        console.error("Failed to fetch bus data:", err);
        setError(err instanceof Error ? err.message : "Failed to load bus times");
      }
    }

    fetchBusData();
    const interval = setInterval(fetchBusData, 15 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const timeString = currentTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="min-h-screen font-sans">
      <div className="flex items-center justify-between px-4 pt-4">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-foreground transition-colors"
        >
          ← Subway
        </Link>
        <h1 className="text-2xl font-bold text-center flex-1">{timeString}</h1>
        <div className="w-14" /> {/* Spacer for centering */}
      </div>

      <div className="flex flex-1 items-center justify-center">
        <main className="flex w-full max-w-3xl flex-col px-4 sm:px-16 py-8">
          {error ? (
            <div className="rounded-lg bg-red-900/50 border border-red-700 p-4 text-center">
              <p className="text-red-200">{error}</p>
              <p className="text-sm text-red-300 mt-2">
                Make sure MTA_BUS_API_KEY is set in .env.local
              </p>
            </div>
          ) : busData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {Object.entries(busData.stops).map(([stopId, stop]) => (
                <div key={stopId}>
                  <h2 className="text-lg font-semibold mb-3">{stop.name}</h2>
                  {stop.arrivals.length > 0 ? (
                    <ul className="space-y-2">
                      {stop.arrivals.slice(0, MAX_ARRIVALS).map((arrival, index) => (
                        <li
                          key={`${arrival.route}-${arrival.destination}-${index}`}
                          className="p-2 rounded bg-gray-600 flex items-center gap-2"
                        >
                          <BusRouteBadge route={arrival.route} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{arrival.destination}</p>
                            {arrival.presentableDistance && (
                              <p className="text-xs text-gray-400">
                                {arrival.presentableDistance}
                              </p>
                            )}
                          </div>
                          <div className="text-center">
                            {arrival.expectedArrival ? (
                              <MinutesUntilArrival
                                expectedArrival={arrival.expectedArrival}
                                currentTime={currentTime}
                              />
                            ) : (
                              <p className="text-sm text-gray-400">—</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      No buses currently expected
                    </p>
                  )}
                  {stop.lat != null && stop.lon != null && (
                    <BusMap
                      stopName={stop.name}
                      stopLat={stop.lat}
                      stopLon={stop.lon}
                      buses={stop.arrivals
                        .filter((a) => a.location)
                        .map((a) => ({
                          lat: a.location!.lat,
                          lon: a.location!.lon,
                          route: a.route,
                        }))}
                      className="mt-3"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">Loading bus times...</p>
          )}
        </main>
      </div>
    </div>
  );
}
