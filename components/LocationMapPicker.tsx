"use client";

import { useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import statesTopology from "us-atlas/states-10m.json";
import {
  getStatewidePreference,
  statewidePreferenceLabel,
  US_STATE_ABBREVIATIONS,
  US_STATES,
} from "@/lib/usStates";

type CompactPlace = {
  n: string;
  s: string;
  a: number;
  o: number;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type LocationMapPickerProps = {
  value: string[];
  onChange: (locations: string[]) => void;
};

const MAP_WIDTH = 960;
const MAP_HEIGHT = 600;

const typedTopology = statesTopology as unknown as Topology<{
  states: GeometryCollection<{ name: string }>;
}>;

const stateCollection = feature(
  typedTopology,
  typedTopology.objects.states
) as unknown as FeatureCollection<Geometry, { name: string }>;

const stateFeatures = stateCollection.features.filter(
  (state) => US_STATE_ABBREVIATIONS[state.properties.name]
);

const projection = geoAlbersUsa()
  .scale(1240)
  .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);

const pathGenerator = geoPath(projection);

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function placeLabel(place: CompactPlace) {
  return `${place.n}, ${place.s}`;
}

function distanceMiles(first: Coordinates, second: Coordinates) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export default function LocationMapPicker({
  value,
  onChange,
}: LocationMapPickerProps) {
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<CompactPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [mapMessage, setMapMessage] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [candidate, setCandidate] = useState<CompactPlace | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);

  const selectedFeature = useMemo(
    () =>
      stateFeatures.find(
        (state) =>
          US_STATE_ABBREVIATIONS[state.properties.name] === selectedState
      ) ?? null,
    [selectedState]
  );

  const mapTransform = useMemo(() => {
    if (!selectedFeature) return { scale: 1, x: 0, y: 0 };

    const [[left, top], [right, bottom]] = pathGenerator.bounds(selectedFeature);
    const width = Math.max(right - left, 1);
    const height = Math.max(bottom - top, 1);
    const scale = Math.min(18, 0.76 / Math.max(width / MAP_WIDTH, height / MAP_HEIGHT));
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;

    return {
      scale,
      x: MAP_WIDTH / 2 - centerX * scale,
      y: MAP_HEIGHT / 2 - centerY * scale,
    };
  }, [selectedFeature]);

  const placeLookup = useMemo(() => {
    const lookup = new Map<string, CompactPlace>();
    for (const place of places) {
      const label = normalize(placeLabel(place));
      if (!lookup.has(label)) lookup.set(label, place);
    }
    return lookup;
  }, [places]);

  const selectedPlaces = useMemo(
    () =>
      value
        .map((location) => placeLookup.get(normalize(location)))
        .filter((place): place is CompactPlace => Boolean(place)),
    [placeLookup, value]
  );

  const statePlaces = useMemo(
    () =>
      places
        .filter((place) => place.s === selectedState)
        .sort((first, second) => first.n.localeCompare(second.n)),
    [places, selectedState]
  );

  const citySuggestions = useMemo(() => {
    const query = normalize(cityQuery);
    if (!query || candidate?.n === cityQuery) return [];

    const matches = statePlaces.filter((place) =>
      normalize(place.n).includes(query)
    );

    return matches
      .sort((first, second) => {
        const firstStarts = normalize(first.n).startsWith(query) ? 0 : 1;
        const secondStarts = normalize(second.n).startsWith(query) ? 0 : 1;
        return firstStarts - secondStarts || first.n.localeCompare(second.n);
      })
      .slice(0, 8);
  }, [candidate, cityQuery, statePlaces]);

  const candidateLabel = candidate ? placeLabel(candidate) : "";
  const candidateAdded = candidate
    ? value.some((location) => normalize(location) === normalize(candidateLabel))
    : false;
  const selectedStateName =
    US_STATES.find((state) => state.abbreviation === selectedState)?.name ?? "";
  const statewideLabel = selectedStateName
    ? statewidePreferenceLabel(selectedStateName)
    : "";
  const statewideAdded = value.some(
    (location) => normalize(location) === normalize(statewideLabel)
  );
  const preferredStateAbbreviations = useMemo(
    () =>
      new Set(
        value
          .map((location) => getStatewidePreference(location)?.abbreviation)
          .filter((abbreviation): abbreviation is string => Boolean(abbreviation))
      ),
    [value]
  );

  async function openMap() {
    setOpen(true);
    if (places.length || loadingPlaces) return;

    setLoadingPlaces(true);
    try {
      const response = await fetch("/data/us-places-2025.json");
      if (!response.ok) throw new Error("Unable to load the city map data.");
      setPlaces((await response.json()) as CompactPlace[]);
    } catch (error: unknown) {
      setMapMessage(error instanceof Error ? error.message : "Unable to load city map data.");
    } finally {
      setLoadingPlaces(false);
    }
  }

  function chooseState(abbreviation: string) {
    setSelectedState(abbreviation);
    setCityQuery("");
    setCandidate(null);
    setMapMessage(
      abbreviation
        ? "Choose a city below, or add the entire state as your preference."
        : "Choose a state to add a city or a statewide preference."
    );
  }

  function handleStateClick(state: Feature<Geometry, { name: string }>) {
    const abbreviation = US_STATE_ABBREVIATIONS[state.properties.name];
    if (!abbreviation) return;
    chooseState(abbreviation);
  }

  function addCandidate() {
    if (!candidate || candidateAdded) return;
    onChange([...value, candidateLabel]);
    setMapMessage(`${candidateLabel} added to your preferred locations.`);
    setCityQuery("");
    setCandidate(null);
  }

  function addStatewidePreference() {
    if (!statewideLabel || statewideAdded) return;
    onChange([...value, statewideLabel]);
    setMapMessage(`${statewideLabel} added to your preferred locations.`);
  }

  function chooseCity(place: CompactPlace) {
    setCandidate(place);
    setCityQuery(place.n);
    setMapMessage(null);
  }

  function showCurrentLocation() {
    if (!navigator.geolocation) {
      setMapMessage("Location services are not available in this browser.");
      return;
    }

    setLocating(true);
    setMapMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setMapMessage("Your location was not shared. You can still choose cities manually.");
        setLocating(false);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 }
    );
  }

  const markerRadius = 6 / mapTransform.scale;
  const markerStroke = 2 / mapTransform.scale;
  return (
    <>
      <button
        type="button"
        className="locationMapOpenButton"
        onClick={() => void openMap()}
      >
        <span aria-hidden="true">⌖</span>
        Explore locations on a map
      </button>

      {open && (
        <div
          className="locationMapBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="locationMapDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-map-title"
          >
            <header className="locationMapHeader">
              <div>
                <span className="profileStep">LOCATION EXPLORER</span>
                <h2 id="location-map-title">Choose your preferred areas</h2>
                <p>
                  Select a state, then add the whole state or search for a city
                  within it.
                </p>
              </div>
              <button
                type="button"
                className="locationMapClose"
                aria-label="Close location map"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="locationMapToolbar">
              <label>
                <span>Choose a state</span>
                <select
                  value={selectedState}
                  onChange={(event) => chooseState(event.target.value)}
                >
                  <option value="">View the entire U.S.</option>
                  {US_STATES.map((state) => (
                    <option value={state.abbreviation} key={state.abbreviation}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="btn"
                onClick={showCurrentLocation}
                disabled={locating}
              >
                <span aria-hidden="true">◎</span>
                {locating ? "Finding you..." : "Show my location"}
              </button>

              {selectedState && (
                <button type="button" className="btn" onClick={() => chooseState("")}>
                  Reset map
                </button>
              )}
            </div>

            {selectedState && (
              <div className="locationSelectionPanel">
                <div className="locationStatewideChoice">
                  <div>
                    <span className="locationChoiceEyebrow">STATEWIDE</span>
                    <strong>Open to any city in {selectedStateName}?</strong>
                    <p>
                      This preference will match positions anywhere in the state.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btnPrimary"
                    onClick={addStatewidePreference}
                    disabled={statewideAdded}
                  >
                    {statewideAdded
                      ? "State added"
                      : `Add all of ${selectedStateName}`}
                  </button>
                </div>

                <div className="locationCityChoice">
                  <label htmlFor="location-city-search">
                    Or search cities in {selectedStateName}
                  </label>
                  <div className="locationCitySearchRow">
                    <div className="locationCityCombobox">
                      <input
                        id="location-city-search"
                        type="text"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={citySuggestions.length > 0}
                        aria-controls="location-city-suggestions"
                        autoComplete="off"
                        placeholder={`Start typing a ${selectedStateName} city`}
                        value={cityQuery}
                        onChange={(event) => {
                          setCityQuery(event.target.value);
                          setCandidate(null);
                          setMapMessage(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && citySuggestions[0]) {
                            event.preventDefault();
                            chooseCity(citySuggestions[0]);
                          }
                        }}
                      />
                      {citySuggestions.length > 0 && (
                        <div
                          className="locationCitySuggestions"
                          id="location-city-suggestions"
                          role="listbox"
                        >
                          {citySuggestions.map((place) => (
                            <button
                              type="button"
                              role="option"
                              aria-selected={candidateLabel === placeLabel(place)}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => chooseCity(place)}
                              key={`${place.s}-${place.n}-${place.a}-${place.o}`}
                            >
                              <strong>{place.n}</strong>
                              <span>{place.s}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btnPrimary"
                      onClick={addCandidate}
                      disabled={!candidate || candidateAdded}
                    >
                      {candidateAdded ? "City added" : "Add city"}
                    </button>
                  </div>
                  <p className="locationCityHint">
                    Choose a city from the verified list before adding it.
                  </p>
                </div>
              </div>
            )}

            <div className="locationMapCanvas">
              {loadingPlaces && (
                <div className="locationMapLoading">Loading U.S. cities...</div>
              )}

              <svg
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                role="img"
                aria-label={
                  selectedStateName
                    ? `${selectedStateName} city selection map`
                    : "United States city selection map"
                }
              >
                <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="locationMapOcean" />
                <g
                  transform={`translate(${mapTransform.x} ${mapTransform.y}) scale(${mapTransform.scale})`}
                  className="locationMapLayer"
                >
                  {stateFeatures.map((state) => {
                    const abbreviation =
                      US_STATE_ABBREVIATIONS[state.properties.name];
                    const active = abbreviation === selectedState;
                    const preferred =
                      preferredStateAbbreviations.has(abbreviation);
                    const stateClassName = [
                      "locationState",
                      active ? "active" : "",
                      preferred ? "preferred" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <path
                        d={pathGenerator(state) ?? undefined}
                        className={stateClassName}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStateClick(state);
                        }}
                        key={abbreviation}
                      >
                        <title>{state.properties.name}</title>
                      </path>
                    );
                  })}

                  {selectedPlaces.map((place) => {
                    const point = projection([place.o, place.a]);
                    if (!point) return null;
                    const distance = currentLocation
                      ? Math.round(
                          distanceMiles(currentLocation, {
                            latitude: place.a,
                            longitude: place.o,
                          })
                        )
                      : null;

                    return (
                      <circle
                        cx={point[0]}
                        cy={point[1]}
                        r={markerRadius}
                        className="locationMarker locationMarkerSaved"
                        strokeWidth={markerStroke}
                        onClick={(event) => event.stopPropagation()}
                        key={`${place.s}-${place.n}`}
                      >
                        <title>
                          {placeLabel(place)}
                          {distance != null ? ` · about ${distance} miles away` : ""}
                        </title>
                      </circle>
                    );
                  })}

                  {candidate && (() => {
                    const point = projection([candidate.o, candidate.a]);
                    if (!point) return null;
                    return (
                      <circle
                        cx={point[0]}
                        cy={point[1]}
                        r={markerRadius * 1.15}
                        className="locationMarker locationMarkerCandidate"
                        strokeWidth={markerStroke}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <title>{candidateLabel}</title>
                      </circle>
                    );
                  })()}

                  {currentLocation && (() => {
                    const point = projection([
                      currentLocation.longitude,
                      currentLocation.latitude,
                    ]);
                    if (!point) return null;
                    return (
                      <circle
                        cx={point[0]}
                        cy={point[1]}
                        r={markerRadius}
                        className="locationMarker locationMarkerCurrent"
                        strokeWidth={markerStroke}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <title>Your approximate current location</title>
                      </circle>
                    );
                  })()}
                </g>
              </svg>

              <div className="locationMapLegend">
                <span><i className="saved" /> Preferred city</span>
                <span><i className="statewide" /> Preferred state</span>
                <span><i className="candidate" /> City to add</span>
                <span><i className="current" /> Current location</span>
              </div>
              <span className="locationMapSource">
                City data: U.S. Census Bureau, 2025 Gazetteer
              </span>
            </div>

            <footer className="locationMapFooter">
              <div className="locationMapFeedback" aria-live="polite">
                {candidate ? (
                  <>
                    <span className="locationCandidatePin" aria-hidden="true">●</span>
                    <div>
                      <strong>{candidateLabel}</strong>
                      <p>
                        Selected from the verified city list
                        {currentLocation
                          ? ` · about ${Math.round(
                              distanceMiles(currentLocation, {
                                latitude: candidate.a,
                                longitude: candidate.o,
                              })
                            )} miles from you`
                          : ""}
                      </p>
                    </div>
                  </>
                ) : (
                  <p>
                    {mapMessage ??
                      (selectedState
                        ? "Search for a city or add the entire state."
                        : "Choose a state from the menu or select one on the map.")}
                  </p>
                )}
              </div>

              <div className="locationMapFooterActions">
                <button type="button" className="btn" onClick={() => setOpen(false)}>
                  Done
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
