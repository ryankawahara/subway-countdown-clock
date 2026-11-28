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
  const [displayMode, setDisplayMode] = useState<"normal" | "compact" | "portrait">("portrait");
  const [zoom, setZoom] = useState(100);

  // Load saved stations, display mode, and zoom from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("selectedStations");
    if (saved) {
      setSelectedStations(saved.split(","));
    }
    const savedDisplayMode = localStorage.getItem("displayMode");
    if (savedDisplayMode === "compact" || savedDisplayMode === "portrait" || savedDisplayMode === "normal") {
      setDisplayMode(savedDisplayMode);
    }
    // Default is already "portrait" from useState
    const savedZoom = localStorage.getItem("zoom");
    if (savedZoom) {
      const zoomValue = parseInt(savedZoom, 10);
      if (zoomValue >= 50 && zoomValue <= 200) {
        setZoom(zoomValue);
      }
    }
  }, []);

  // Map line groups to station ID prefixes
  // MTA uses different prefixes for different subway divisions
  const LINE_PREFIX_MAP: Record<string, string[]> = {
    "1/2/3": ["1", "2", "3"],  // 1xx, 2xx, 3xx stations (1/2/3 lines share stations)
    "4/5/6": ["4", "5", "6"],  // 4xx, 5xx, 6xx stations
    "7": ["7"],                // 7xx stations
    "A/C/E": ["A"],            // Axx stations
    "B/D/F/M": ["B", "D", "F", "M"],  // B, D, F, M prefixed stations
    "N/Q/R/W": ["N", "Q", "R"],       // N, Q, R prefixed stations
    "G": ["G"],                // Gxx stations
    "J/Z": ["J", "M"],         // J/Z share stations with M line in some areas
    "L": ["L"],                // Lxx stations
    "S": ["S", "H"],           // Shuttle lines (S and H prefixes)
  };

  // Get stations for selected line
  const getStationsForLine = (lineGroup: string) => {
    // Get base stations (without N/S suffix) that serve these lines
    const stations: Station[] = [];
    const prefixes = LINE_PREFIX_MAP[lineGroup] || [];

    Object.entries(stationData).forEach(([id, station]) => {
      // Skip entries with N/S suffix (platform-specific)
      if (id.endsWith("N") || id.endsWith("S")) return;

      // Check if station ID starts with any of the valid prefixes for this line group
      const matchesLine = prefixes.some(prefix => {
        if (prefix.length === 1 && /[0-9]/.test(prefix)) {
          // Numeric prefix (e.g., "1" matches "101", "123", etc.)
          return id.startsWith(prefix);
        } else {
          // Letter prefix (e.g., "A" matches "A02", "A15", etc.)
          return id.startsWith(prefix);
        }
      });

      if (matchesLine) {
        stations.push(station as Station);
      }
    });

    // Sort stations by name for easier browsing
    return stations.sort((a, b) => a.stop_name.localeCompare(b.stop_name));
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

  const moveStation = (index: number, direction: "up" | "down") => {
    setSelectedStations(prev => {
      const newArr = [...prev];
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newArr.length) return prev;
      [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
      return newArr;
    });
  };

  const saveConfiguration = () => {
    // Allow saving even with no stations selected (just saving display mode)
    if (selectedStations.length > 0) {
      localStorage.setItem("selectedStations", selectedStations.join(","));
    }
    localStorage.setItem("displayMode", displayMode);
    localStorage.setItem("zoom", String(zoom));
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
      <div className="min-h-screen p-6 bg-gray-900 text-white relative">
        {/* Save & Close button at top */}
        <button
          onClick={saveConfiguration}
          className="fixed top-4 right-4 bg-green-600 hover:bg-green-700 active:bg-green-500 text-white p-3 rounded-full text-xl font-bold z-10 w-12 h-12 flex items-center justify-center"
        >
          ✕
        </button>
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
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                onClick={() => setDisplayMode("normal")}
                className={`p-5 rounded-lg text-base font-semibold transition-colors ${
                  displayMode === "normal"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {displayMode === "normal" ? "✓ " : ""}Normal
                <div className="text-xs font-normal mt-1">Larger</div>
              </button>
              <button
                onClick={() => setDisplayMode("compact")}
                className={`p-5 rounded-lg text-base font-semibold transition-colors ${
                  displayMode === "compact"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {displayMode === "compact" ? "✓ " : ""}Compact
                <div className="text-xs font-normal mt-1">800x480</div>
              </button>
              <button
                onClick={() => setDisplayMode("portrait")}
                className={`p-5 rounded-lg text-base font-semibold transition-colors ${
                  displayMode === "portrait"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {displayMode === "portrait" ? "✓ " : ""}Portrait
                <div className="text-xs font-normal mt-1">480x800</div>
              </button>
            </div>

            <h2 className="text-lg font-semibold mb-4">Zoom Level: {zoom}%</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="bg-gray-700 hover:bg-gray-600 p-4 rounded-lg text-xl font-bold min-w-[60px]"
              >
                -
              </button>
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={zoom}
                onChange={(e) => setZoom(parseInt(e.target.value, 10))}
                className="flex-1 h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="bg-gray-700 hover:bg-gray-600 p-4 rounded-lg text-xl font-bold min-w-[60px]"
              >
                +
              </button>
            </div>
            <div className="flex justify-between text-sm text-gray-400 mt-2">
              <span>50%</span>
              <button
                onClick={() => setZoom(100)}
                className="text-blue-400 hover:text-blue-300"
              >
                Reset to 100%
              </button>
              <span>200%</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Selected Stations ({selectedStations.length})</h2>
            {selectedStations.length > 0 ? (
              <div className="text-sm space-y-2">
                {selectedStations.map((id, index) => {
                  const baseId = id.slice(0, -1);
                  const direction = id.slice(-1);
                  const station = stationData[baseId as keyof typeof stationData] as Station | undefined;
                  const stationName = station?.stop_name || baseId;
                  const directionLabel = direction === 'N' ? 'Northbound' : 'Southbound';

                  return (
                    <div key={id} className="flex items-center gap-2 bg-gray-700 p-2 rounded">
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveStation(index, "up")}
                          disabled={index === 0}
                          className={`text-lg leading-none ${index === 0 ? 'text-gray-600' : 'text-gray-300 hover:text-white'}`}
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveStation(index, "down")}
                          disabled={index === selectedStations.length - 1}
                          className={`text-lg leading-none ${index === selectedStations.length - 1 ? 'text-gray-600' : 'text-gray-300 hover:text-white'}`}
                        >
                          ▼
                        </button>
                      </div>
                      <span className="flex-1">{stationName} - {directionLabel}</span>
                      <button
                        onClick={() => setSelectedStations(prev => prev.filter(s => s !== id))}
                        className="text-red-400 hover:text-red-300 px-2 py-1 text-lg"
                      >
                        ✕
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
  const allStations = getStationsForLine(selectedLine);

  // Filter stations based on search query
  const filteredStations = searchQuery.trim()
    ? allStations.filter(station =>
        station.stop_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allStations;

  return (
    <div className="min-h-screen p-6 bg-gray-900 text-white relative">
      {/* Save & Close button at top */}
      <button
        onClick={saveConfiguration}
        className="fixed top-4 right-4 bg-green-600 hover:bg-green-700 active:bg-green-500 text-white p-3 rounded-full text-xl font-bold z-10 w-12 h-12 flex items-center justify-center"
      >
        ✕
      </button>
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
