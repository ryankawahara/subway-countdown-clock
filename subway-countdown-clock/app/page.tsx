"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function Home() {
  const [mtaData, setMtaData] = useState(null);

  useEffect(() => {
    async function fetchMTA() {
      try {
        const response = await fetch("/api/mta?stations=A40N");
        const data = await response.json();
        console.log("MTA Feed JSON:", data); // Log the new data
        setMtaData(data); // Update state with the fetched data
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
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-2xl font-bold">Subway Countdown Clock</h1>
        <div className="mt-4">
          {mtaData ? (
            <pre>{JSON.stringify(mtaData, null, 2)}</pre> // Display the fetched data
          ) : (
            <p>Loading data...</p>
          )}
        </div>
      </main>
    </div>
  );
}
