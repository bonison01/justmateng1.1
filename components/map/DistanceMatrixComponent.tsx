"use client";

import React, { useEffect, useState, useContext, useRef } from "react";
import { MapContext } from "../context/MapContext";
import SearchInput from "./SearchInput";
import { calculatePrice } from "@/lib/calculatePrice";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "../ui/card";
import { Button } from "../ui/button";

interface Location {
  coords: [number, number];
  name: string;
}

interface DistanceMatrixComponentProps {
  onDataUpdate?: (data: {
    pickup: Location | null;
    dropoff: Location | null;
    distance: number | null;
    time: string | null;
    price: string | null;
  }) => void;
}

const decodePolyline = (encoded: string) => {
  let points: number[][] = [];
  let index = 0,
    len = encoded.length;
  let lat = 0,
    lng = 0;

  while (index < len) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
};

const DistanceMatrixComponent: React.FC<DistanceMatrixComponentProps> = ({ onDataUpdate }) => {
  const { pickup, dropoff, updatePickup, updateDropoff } = useContext(MapContext);
  const [map, setMap] = useState<any>(null);
  const [olaMapsInstance, setOlaMapsInstance] = useState<any>(null);
  const [pickupMarker, setPickupMarker] = useState<any>(null);
  const [dropoffMarker, setDropoffMarker] = useState<any>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [geolocate, setGeolocate] = useState<any>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);

  // Store previous data to compare and avoid unnecessary updates
  const prevDataRef = useRef<{
    pickup: Location | null;
    dropoff: Location | null;
    distance: number | null;
    time: string | null;
    price: string | null;
  }>({
    pickup: null,
    dropoff: null,
    distance: null,
    time: null,
    price: null,
  });

  const manipurLocation = { lat: 24.817, lng: 93.936 };

  // Reverse geocode function
  const reverseGeocode = async (lng: number, lat: number) => {
    const url = `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${process.env.NEXT_PUBLIC_OLA_API_KEY}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === "ok" && data.results?.length > 0) {
        return data.results[0].formatted_address;
      }
      return "Unknown Location";
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
      return "Unknown Location";
    }
  };

  // Ask for location permission upfront
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setLocationPermission(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLocation: [number, number] = [position.coords.longitude, position.coords.latitude];
        if (!pickup) {
          const name = await reverseGeocode(position.coords.longitude, position.coords.latitude);
          updatePickup(userLocation, name);
        }
        setLocationPermission(true);
        setLocationError(null);
      },
      (error) => {
        setLocationPermission(false);
        setLocationError("Location access denied. Please allow location access or set pickup manually.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [pickup, updatePickup]);

  // Load the map SDK and initialize
  useEffect(() => {
    const loadSDK = async () => {
      try {
        const { OlaMaps } = await import("olamaps-web-sdk");
        const olaMaps = new OlaMaps({ apiKey: process.env.NEXT_PUBLIC_OLA_API_KEY! });
        setOlaMapsInstance(olaMaps);

        const myMap = olaMaps.init({
          style: "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json",
          container: "map",
          center: [manipurLocation.lng, manipurLocation.lat],
          zoom: 15,
        });

        myMap.on("load", () => {
          const geolocateControl = olaMaps.addGeolocateControls({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
          });
          myMap.addControl(geolocateControl);
          setGeolocate(geolocateControl);
          if (locationPermission) geolocateControl.trigger();
        });

        myMap.on("error", (e: any) => {
          console.error("Map error:", e);
        });

        setMap(myMap);
      } catch (error) {
        console.error("Failed to initialize map:", error);
      }
    };

    if (locationPermission !== null) loadSDK();
  }, [locationPermission]);

  // Handle geolocation events
  useEffect(() => {
    if (!geolocate) return;

    geolocate.on("geolocate", async (event: GeolocationPosition) => {
      const userLocation: [number, number] = [event.coords.longitude, event.coords.latitude];
      if (!pickup) {
        const name = await reverseGeocode(event.coords.longitude, event.coords.latitude);
        updatePickup(userLocation, name);
      }
    });

    geolocate.on("error", () => {
      setLocationError("Unable to retrieve your location.");
    });

    return () => {
      geolocate.off("geolocate");
      geolocate.off("error");
    };
  }, [geolocate, pickup, updatePickup]);

  // Handle map click events
  useEffect(() => {
    if (!map) return;

    const handleClick = async (e: any) => {
      const { lng, lat } = e.lngLat;
      const location: [number, number] = [lng, lat];
      const name = await reverseGeocode(lng, lat);
      if (!pickup) {
        updatePickup(location, name);
      } else if (!dropoff) {
        updateDropoff(location, name);
      }
    };

    map.on("click", handleClick);
    return () => map.off("click", handleClick);
  }, [map, pickup, dropoff, updatePickup, updateDropoff]);

  // Add or update pickup marker and focus map
  useEffect(() => {
    if (map && olaMapsInstance && pickup && !pickupMarker) {
      const marker = olaMapsInstance
        .addMarker({ offset: [0, 0], anchor: "center", color: "red", draggable: true })
        .setLngLat(pickup.coords)
        .addTo(map);
      setPickupMarker(marker);

      marker.on("dragend", async (e: any) => {
        const { lng, lat } = marker.getLngLat();
        const name = await reverseGeocode(lng, lat);
        updatePickup([lng, lat], name);
      });

      map.setCenter(pickup.coords);
      map.setZoom(15);
    } else if (pickupMarker && pickup) {
      pickupMarker.setLngLat(pickup.coords);

      if (!dropoff) {
        map.setCenter(pickup.coords);
        map.setZoom(15);
      }
    }
  }, [map, olaMapsInstance, pickup, pickupMarker, updatePickup, dropoff]);

  // Add or update dropoff marker and focus map
  useEffect(() => {
    if (map && olaMapsInstance && pickup && dropoff && !dropoffMarker) {
      const marker = olaMapsInstance
        .addMarker({ offset: [0, 0], anchor: "center", color: "green", draggable: true })
        .setLngLat(dropoff.coords)
        .addTo(map);
      setDropoffMarker(marker);

      marker.on("dragend", async (e: any) => {
        const { lng, lat } = marker.getLngLat();
        const name = await reverseGeocode(lng, lat);
        updateDropoff([lng, lat], name);
      });

      // Focus map on dropoff location initially
      map.setCenter(dropoff.coords);
      map.setZoom(15);
    } else if (dropoffMarker && dropoff) {
      dropoffMarker.setLngLat(dropoff.coords);
    }
  }, [map, olaMapsInstance, pickup, dropoff, dropoffMarker, updateDropoff]);

  // Fetch distance, time, draw route, and fit route in view
  useEffect(() => {
    if (map && pickup && dropoff) {
      const fetchDistanceMatrix = async () => {
        if (map.getLayer("route")) map.removeLayer("route");
        if (map.getSource("route")) map.removeSource("route");

        const origins = `${pickup.coords[1]},${pickup.coords[0]}`;
        const destinations = `${dropoff.coords[1]},${dropoff.coords[0]}`;
        const url = `https://api.olamaps.io/routing/v1/distanceMatrix/basic?origins=${encodeURIComponent(
          origins
        )}&destinations=${encodeURIComponent(destinations)}&api_key=${process.env.NEXT_PUBLIC_OLA_API_KEY}`;

        try {
          const response = await fetch(url, {
            method: "GET",
            headers: { "X-Request-Id": "distance-matrix-" + Date.now() },
          });
          const data = await response.json();

          if (data.status === "SUCCESS" && data.rows?.[0]?.elements?.[0]?.status === "OK") {
            const element = data.rows[0].elements[0];
            const distanceInKm = element.distance / 1000; 
            const timeValue = `${Math.round(element.duration / 60)} mins`;
            const priceValue = `${calculatePrice(distanceInKm).toFixed(2)}`;

            setDistance(distanceInKm);
            setTime(timeValue);
            setPrice(priceValue);

            // Only call onDataUpdate if data has changed
            const newData = { pickup, dropoff, distance: distanceInKm, time: timeValue, price: priceValue };
            const prevData = prevDataRef.current;
            if (
              onDataUpdate &&
              (prevData.pickup !== pickup ||
                prevData.dropoff !== dropoff ||
                prevData.distance !== distanceInKm ||
                prevData.time !== timeValue ||
                prevData.price !== priceValue)
            ) {
              onDataUpdate(newData);
              prevDataRef.current = newData;
            }

            if (element.polyline) {
              const coordinates = decodePolyline(element.polyline);
              map.addSource("route", {
                type: "geojson",
                data: { type: "Feature", geometry: { type: "LineString", coordinates } },
              });
              map.addLayer({
                id: "route",
                type: "line",
                source: "route",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#3887be", "line-width": 5 },
              });

              // Calculate bounds manually
              let minLng = pickup.coords[0];
              let maxLng = pickup.coords[0];
              let minLat = pickup.coords[1];
              let maxLat = pickup.coords[1];

              minLng = Math.min(minLng, dropoff.coords[0]);
              maxLng = Math.max(maxLng, dropoff.coords[0]);
              minLat = Math.min(minLat, dropoff.coords[1]);
              maxLat = Math.max(maxLat, dropoff.coords[1]);

              coordinates.forEach(([lng, lat]) => {
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
              });

              const bounds: [[number, number], [number, number]] = [
                [minLng, minLat],
                [maxLng, maxLat],
              ];

              map.fitBounds(bounds, {
                padding: 50,
                maxZoom: 15,
                duration: 1000,
              });
            }
          } else {
            setDistance(null);
            setTime("N/A");
            setPrice("N/A");
            if (onDataUpdate) {
              const newData = { pickup, dropoff, distance: null, time: "N/A", price: "N/A" };
              const prevData = prevDataRef.current;
              if (
                prevData.pickup !== pickup ||
                prevData.dropoff !== dropoff ||
                prevData.distance !== null ||
                prevData.time !== "N/A" ||
                prevData.price !== "N/A"
              ) {
                onDataUpdate(newData);
                prevDataRef.current = newData;
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch distance matrix:", error);
          setDistance(null);
          setTime("Error");
          setPrice("Error");
          if (onDataUpdate) {
            const newData = { pickup, dropoff, distance: null, time: "Error", price: "Error" };
            const prevData = prevDataRef.current;
            if (
              prevData.pickup !== pickup ||
              prevData.dropoff !== dropoff ||
              prevData.distance !== null ||
              prevData.time !== "Error" ||
              prevData.price !== "Error"
            ) {
              onDataUpdate(newData);
              prevDataRef.current = newData;
            }
          }
        }
      };

      fetchDistanceMatrix();
    } else {
      setDistance(null);
      setTime(null);
      setPrice(null);
      if (onDataUpdate) {
        const newData = { pickup, dropoff, distance: null, time: null, price: null };
        const prevData = prevDataRef.current;
        if (
          prevData.pickup !== pickup ||
          prevData.dropoff !== dropoff ||
          prevData.distance !== null ||
          prevData.time !== null ||
          prevData.price !== null
        ) {
          onDataUpdate(newData);
          prevDataRef.current = newData;
        }
      }
      if (map && map.getLayer("route")) map.removeLayer("route");
      if (map && map.getSource("route")) map.removeSource("route");
    }
  }, [map, pickup, dropoff, onDataUpdate]);

  // const resetMap = () => {
  //   // Remove markers
  //   if (pickupMarker) {
  //     pickupMarker.remove();
  //     setPickupMarker(null);
  //   }
  //   if (dropoffMarker) {
  //     dropoffMarker.remove();
  //     setDropoffMarker(null);
  //   }

  //   if (map && map.getLayer("route")) map.removeLayer("route");
  //   if (map && map.getSource("route")) map.removeSource("route");

  //   // Reset context locations
  //   if (pickup) {
  //     updatePickup([manipurLocation.lng, manipurLocation.lat], ''); 
  //   }
  //   if (dropoff) {
  //     updateDropoff([manipurLocation.lng, manipurLocation.lat], ''); 
  //   }

  //   // Clear input fields
  //   if (pickupInputRef.current) pickupInputRef.current.value = '';
  //   if (dropoffInputRef.current) dropoffInputRef.current.value = '';

  //   // Reset state values
  //   setDistance(null);
  //   setTime(null);
  //   setPrice(null);
    

  //   // Reset map view to default location
  //   if (map) {
  //     map.setCenter([manipurLocation.lng, manipurLocation.lat]);
  //     map.setZoom(15);
  //     map.marker.remove();
  //   }

  //   // Update parent component
  //   if (onDataUpdate) {
  //     const resetData = {
  //       pickup: null,
  //       dropoff: null,
  //       distance: null,
  //       time: null,
  //       price: null
  //     };
  //     onDataUpdate(resetData);
  //     prevDataRef.current = resetData;
  //   }
  // };

  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 h-full">
        <div className="flex flex-col sm:flex-row md:flex-col gap-2 sm:gap-4 md:w-84">
          <div className="flex flex-col gap-6">
            <SearchInput type="pickup" ref={pickupInputRef} />
            <SearchInput type="drop" ref={dropoffInputRef} />
          </div>

          <div className="mt-4 flex justify-center">
            {pickup && dropoff ? (
              <Card className="w-full">
                <CardHeader>
                  <CardDescription>
                    <strong># Disclaimer:</strong> Distance and price are approximate estimates from map
                    calculations, and actual values may vary.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-row gap-2">
                    <Label className="text-base text-zinc-300 font-bold">Distance:</Label>
                    <span className="text-lg text-green-400 font-semibold">
                      {distance !== null ? `${distance.toFixed(1)} km` : "Calculating..."}
                    </span>
                  </div>
                  <div className="flex flex-row gap-2">
                    {/* <Label className="text-base text-zinc-300 font-bold">Time:</Label> */}
                    <span className="text-lg text-green-400 font-semibold">{time || "Calculating..."}</span>
                  </div>
                  <div className="flex flex-row gap-2">
                    <Label className="text-base text-zinc-300 font-bold">Cost:</Label>
                    <span className="text-lg text-green-400 font-semibold">{`₹ ${price}` || "Calculating..."}</span>
                  </div>
                </CardContent>
                {/* <CardFooter>
                <Button variant="destructive" onClick={resetMap}>Reset</Button>
                </CardFooter> */}
              </Card>
            ) : (
              <CardDescription className="px-2">
                Select pick-up and drop-off locations to see distance, and price.
              </CardDescription>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col px-2">
          {/* {locationError && <p className="text-red-500 mb-2">{locationError}</p>} */}
          <div id="map" style={{ width: "100%", height: "480px" }} />
        </div>
      </div>
    </>
  );
};

export default DistanceMatrixComponent;