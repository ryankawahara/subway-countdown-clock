"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [mtaData, setMtaData] = useState<{
    stations: Record<string, { trains: { trainId: string; rawEta: number; destination: string }[] }>;
  } | null>(null);

  useEffect(() => {
    async function fetchMTA() {
      try {
        const response = await fetch("/api/mta?stations=A40N,A40S");
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
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-2xl font-bold">Subway Countdown Clock</h1>
        <div className="mt-4">
          {mtaData ? (
            <div>
              {Object.entries(mtaData.stations).map(([stationId, stationData]) => (
                <div key={stationId} className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Station: {stationId}</h2>
                  <ul className="space-y-2">
                    {stationData.trains.slice(0, 5).map((train, index) => (
                      <li
                        key={index}
                        className="p-2 border rounded bg-gray-100 dark:bg-gray-800"
                      >
                        <p className="text-lg">
                          <span className="font-bold">Train:</span> {train.trainId}
                        </p>
                        <p className="text-lg">
                          <span className="font-bold">Destination:</span> {train.destination}
                        </p>
                        <p className="text-lg">
                          <span className="font-bold">ETA:</span>{" "}
                          {train.rawEta < 60 ? "NOW" : `${Math.floor(train.rawEta / 60)} minutes`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p>Loading data...</p>
          )}
        </div>
      </main>
    </div>
  );
}