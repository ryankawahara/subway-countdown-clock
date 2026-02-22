"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

interface BusLocation {
  lat: number;
  lon: number;
  route: string;
}

interface BusMapProps {
  stopName: string;
  stopLat: number;
  stopLon: number;
  buses: BusLocation[];
  className?: string;
}

export default function BusMap({
  stopName,
  stopLat,
  stopLon,
  buses,
  className = "",
}: BusMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const hasEnforcedView = useRef(false);

  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;

      if (leafletMapRef.current) return;

      // ~2 mile radius at NYC latitude: 2 mi ≈ 0.029° lat, 0.038° lon
      const MILES_TO_DEG = { lat: 0.029, lon: 0.038 };
      const twoMileBounds = L.latLngBounds(
        [stopLat - MILES_TO_DEG.lat, stopLon - MILES_TO_DEG.lon],
        [stopLat + MILES_TO_DEG.lat, stopLon + MILES_TO_DEG.lon]
      );

      const map = L.map(container, {
        scrollWheelZoom: true,
        doubleClickZoom: true,
        zoomControl: true,
        maxBounds: twoMileBounds.pad(0.2),
        maxBoundsViscosity: 1.0,
      }).fitBounds(twoMileBounds);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const stopIcon = L.divIcon({
        className: "custom-marker",
        html: `<div class="bus-stop-marker" style="width:14px;height:14px;border-radius:50%;background:#60a5fa;border:2px solid #1e293b;box-shadow:0 0 8px rgba(96,165,250,0.6)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      map.addLayer(
        L.marker([stopLat, stopLon], { icon: stopIcon })
          .bindPopup(`<b>${stopName}</b><br>Bus stop`)
      );

      leafletMapRef.current = map;
      setMapReady(true);
    };

    initMap();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      setMapReady(false);
    };
  }, [stopLat, stopLon, stopName]);

  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;

    const updateMarkers = async () => {
      const L = (await import("leaflet")).default;
      const map = leafletMapRef.current!;

      const eps = 0.00001;
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          const pos = layer.getLatLng();
          const isStop =
            Math.abs(pos.lat - stopLat) < eps && Math.abs(pos.lng - stopLon) < eps;
          if (!isStop) map.removeLayer(layer);
        }
      });

      const busIcon = L.divIcon({
        className: "custom-marker",
        html: `<div class="bus-marker" style="width:24px;height:24px;border-radius:6px;background:#f59e0b;border:2px solid #1e293b;box-shadow:0 0 8px rgba(245,158,11,0.5);display:flex;align-items:center;justify-content:center;font-size:14px;color:#000">🚌</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      buses.forEach((bus) => {
        map.addLayer(
          L.marker([bus.lat, bus.lon], { icon: busIcon })
            .bindPopup(`<b>${bus.route}</b><br>Current location`)
        );
      });

      // Enforce 2-mile view once after first marker update — prevent any fit-to-buses behavior
      if (!hasEnforcedView.current) {
        const twoMileBounds = L.latLngBounds(
          [stopLat - 0.029, stopLon - 0.038],
          [stopLat + 0.029, stopLon + 0.038]
        );
        map.fitBounds(twoMileBounds);
        hasEnforcedView.current = true;
      }
    };

    updateMarkers();
  }, [mapReady, buses, stopLat, stopLon]);

  return (
    <div
      ref={mapRef}
      className={`h-56 w-full rounded-lg overflow-hidden border border-gray-700/50 shadow-lg ${className}`}
    />
  );
}
