"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import stationData from "../../pages/api/station-data.json";

// Subway lines grouped by service
const LINE_GROUPS = {
  "A/C/E": ["A", "C", "E"],
  "B/D/F/M": ["B", "D", "F", "M"],
  "N/Q/R/W": ["N", "Q", "R", "W"],
  "1/2/3": ["1", "2", "3"],
  "4/5/6": ["4", "5", "6"],
  "7": ["7"],
  "L": ["L"],
  "G": ["G"],
  "J/Z": ["J", "Z"],
  "S": ["S"],
};

type Station = {
  stop_id: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
};

export default function SetupPage() {
  const router = useRouter();
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [compactMode, setCompactMode] = useState(false);

  // Load saved stations and display mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("selectedStations");
    if (saved) {
      setSelectedStations(saved.split(","));
    }
    const savedCompactMode = localStorage.getItem("compactMode");
    if (savedCompactMode === "true") {
      setCompactMode(true);
    }
  }, []);

  // Get stations for selected line
  const getStationsForLine = (lines: string[]) => {
    // Get base stations (without N/S suffix) that serve these lines
    const stations: Record<string, Station> = {};

    Object.entries(stationData).forEach(([id, station]) => {
      // Skip entries with N/S suffix (platform-specific)
      if (id.endsWith("N") || id.endsWith("S")) return;

      stations[id] = station as Station;
    });

    return Object.values(stations).slice(0, 20); // Limit for performance
  };

  const toggleStation = (baseStationId: string, direction: "N" | "S") => {
    const stationId = baseStationId + direction;
    setSelectedStations(prev => {
      if (prev.includes(stationId)) {
        return prev.filter(id => id !== stationId);
      } else {
        return [...prev, stationId];
      }
    });
  };

  const isStationSelected = (baseStationId: string, direction: "N" | "S") => {
    return selectedStations.includes(baseStationId + direction);
  };

  const saveConfiguration = () => {
    // Allow saving even with no stations selected (just saving display mode)
    if (selectedStations.length > 0) {
      localStorage.setItem("selectedStations", selectedStations.join(","));
    }
    localStorage.setItem("compactMode", compactMode.toString());
    setShowSaved(true);
    setTimeout(() => {
      router.push("/");
    }, 1500);
  };

  const goBack = () => {
    if (selectedLine) {
      setSelectedLine(null);
    } else {
      router.push("/");
    }
  };

  if (showSaved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-600">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">✓ Saved!</h1>
          <p className="text-xl text-white">Returning to display...</p>
        </div>
      </div>
    );
  }

  if (!selectedLine) {
    // Line selection screen
    return (
      <div className="min-h-screen p-6 bg-gray-900 text-white">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Select Subway Line</h1>

          <div className="grid grid-cols-2 gap-4 mb-8">
            {Object.entries(LINE_GROUPS).map(([groupName, lines]) => (
              <button
                key={groupName}
                onClick={() => setSelectedLine(groupName)}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 p-8 rounded-lg text-2xl font-bold transition-colors"
              >
                {groupName}
              </button>
            ))}
          </div>

          <div className="mt-8 p-4 bg-gray-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Display Mode</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setCompactMode(false)}
                className={`p-6 rounded-lg text-lg font-semibold transition-colors ${
                  !compactMode
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {!compactMode ? "✓ " : ""}Normal
                <div className="text-xs font-normal mt-1">Larger text</div>
              </button>
              <button
                onClick={() => setCompactMode(true)}
                className={`p-6 rounded-lg text-lg font-semibold transition-colors ${
                  compactMode
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {compactMode ? "✓ " : ""}Compact
                <div className="text-xs font-normal mt-1">800x480</div>
              </button>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Selected Stations ({selectedStations.length})</h2>
            {selectedStations.length > 0 ? (
              <div className="text-sm space-y-1">
                {selectedStations.map(id => {
                  const baseId = id.slice(0, -1);
                  const direction = id.slice(-1);
                  const station = stationData[baseId as keyof typeof stationData] as Station | undefined;
                  const stationName = station?.stop_name || baseId;
                  const directionLabel = direction === 'N' ? 'Northbound' : 'Southbound';

                  return (
                    <div key={id} className="flex justify-between items-center">
                      <span>{stationName} - {directionLabel}</span>
                      <button
                        onClick={() => setSelectedStations(prev => prev.filter(s => s !== id))}
                        className="text-red-400 hover:text-red-300 px-3 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No stations selected yet</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <button
              onClick={goBack}
              className="bg-gray-700 hover:bg-gray-600 p-6 rounded-lg text-xl font-semibold"
            >
              ← Back
            </button>
            <button
              onClick={saveConfiguration}
              className="bg-green-600 hover:bg-green-700 p-6 rounded-lg text-xl font-semibold"
            >
              Save & Go
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Station selection screen
  const allStations = getStationsForLine(LINE_GROUPS[selectedLine as keyof typeof LINE_GROUPS]);

  // Filter stations based on search query
  const filteredStations = searchQuery.trim()
    ? allStations.filter(station =>
        station.stop_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allStations;

  return (
    <div className="min-h-screen p-6 bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-center">{selectedLine} Line Stations</h1>
        <p className="text-center text-gray-400 mb-4">Tap direction to add/remove</p>

        {/* Search input with virtual keyboard */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stations..."
            className="w-full p-4 text-xl bg-gray-800 border-2 border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="mt-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-lg"
            >
              Clear Search
            </button>
          )}
        </div>

        {filteredStations.length === 0 && (
          <p className="text-center text-gray-400 my-8">No stations found</p>
        )}

        <div className="space-y-4 mb-8">
          {filteredStations.map((station) => {
            const baseId = station.stop_id;
            const northSelected = isStationSelected(baseId, "N");
            const southSelected = isStationSelected(baseId, "S");

            return (
              <div key={baseId} className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-lg">{station.stop_name}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => toggleStation(baseId, "N")}
                    className={`p-6 rounded-lg text-lg font-semibold transition-colors ${
                      northSelected
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    {northSelected ? "✓ " : ""}Northbound
                  </button>
                  <button
                    onClick={() => toggleStation(baseId, "S")}
                    className={`p-6 rounded-lg text-lg font-semibold transition-colors ${
                      southSelected
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    {southSelected ? "✓ " : ""}Southbound
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={goBack}
          className="w-full bg-gray-700 hover:bg-gray-600 p-6 rounded-lg text-xl font-semibold"
        >
          ← Back to Lines
        </button>
      </div>
    </div>
  );
}
