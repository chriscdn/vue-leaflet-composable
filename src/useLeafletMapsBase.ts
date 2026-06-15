/**
 * useLeafletMapsBase
 */

import "leaflet/dist/leaflet.css";

import { onBeforeUnmount, onMounted, type Ref } from "vue";
import { isNumber } from "@chriscdn/to-number";
import { Semaphore } from "@chriscdn/promise-semaphore";
import { withResolvers } from "./withResolvers";

type Leaflet = typeof import("leaflet");
export type Marker = L.Marker | L.CircleMarker;

export type LeafletMapsBaseOptions = {
  el: Ref<HTMLDivElement | null>;
  center?: L.LatLngExpression;
  zoom?: number;
  leafletOptions?: L.MapOptions;
  duration?: number;
  disabled?: boolean;
};

// const isLMarker = (item: unknown): item is L.Marker =>
//   Boolean((item as L.Marker)?.setIcon);

/**
 * This composable is a leaflet wrapper that works with Nuxt SSR.
 *
 * @returns
 */
const createLeafletLoadManager = (isEnabled: boolean) => {
  const isBrowser = typeof window !== "undefined";

  if (isBrowser && isEnabled) {
    //
    // This block only runs on the browser. These three promises are resolved in
    // the onMounted/onBeforeUnmount browser lifecycle hooks. The promises are
    // never rejected since we want to fail silently if an error occurs during
    // mount.
    //
    const leafletReady = withResolvers<Leaflet | null>();
    const mapReady = withResolvers<L.Map | null>();
    const mapTilesReady = withResolvers<L.TileLayer | null>();

    const withLeaflet = <T>(fn: (L: Leaflet) => T | Promise<T>) =>
      leafletReady.promise.then((L) => L && fn(L));

    const withMap = <T>(fn: (map: L.Map) => T | Promise<T>) =>
      mapReady.promise.then((map) => map && fn(map));

    const withMapTilesLoaded = <T>(
      fn: (tileLayer: L.TileLayer) => T | Promise<T>,
    ) => mapTilesReady.promise.then((tileLayer) => tileLayer && fn(tileLayer));

    const withLeafletAndMap = <T>(
      fn: (L: Leaflet, map: L.Map) => T | Promise<T>,
    ) => withLeaflet((L) => withMap((map) => L && map && fn(L, map)));

    return {
      leafletReady,
      mapReady,
      mapTilesReady,
      withLeaflet,
      withMap,
      withMapTilesLoaded,
      withLeafletAndMap,
    };
  } else {
    const noopAsync = <T>(_fn: unknown): Promise<T | null> =>
      Promise.resolve(null);

    const noopDeferred = {
      promise: Promise.resolve(null),
      resolve: () => {},
      reject: () => {},
    };

    return {
      mapReady: noopDeferred,
      mapTilesReady: noopDeferred,
      leafletReady: noopDeferred,
      withLeaflet: noopAsync,
      withMap: noopAsync,
      withMapTilesLoaded: noopAsync,
      withLeafletAndMap: noopAsync,
    };
  }
};

/**
 *
 * @param options
 * @param options.el {Ref<HTMLDivElement>}
 * @param options.theme {"light"|"white"}
 * @param options.polylineOptions {L.PolylineOptions}
 * @param options.leafletOptions {L.MapOptions}
 * @param options.print {boolean}
 * @param options.devicePixelRatio {number}
 * @param options.duration {number} - The default duration for animations, in milliseconds.
 * @returns
 */
export const useLeafletMapsBase = ({
  el,
  center = [45.7, -82.298],
  zoom = 1,
  leafletOptions = {},
  duration = 1000,
  disabled = false,
}: LeafletMapsBaseOptions) => {
  const semaphore = new Semaphore();

  const isEnabled = !disabled;

  let markers: Marker[] = [];
  const markerMap = new Map<string, Marker>();

  let polylineLayers: L.Polyline[] = [];
  let polygonLayers: L.Polygon[] = [];
  let tileLayers: L.TileLayer[] = [];
  let geoJSONLayers: L.GeoJSON[] = [];

  const defaultDurationInMS = duration;

  const {
    mapReady,
    mapTilesReady,
    leafletReady,
    withLeaflet,
    withMap,
    withMapTilesLoaded,
    withLeafletAndMap,
  } = createLeafletLoadManager(isEnabled);

  const addTileLayer = (layer: L.TileLayer) => {
    withMap((map) => {
      layer.on("load", () => {
        mapTilesReady.resolve(layer);
      });
      tileLayers.push(layer.addTo(map));
    });
  };

  const removeTileLayers = () => {
    tileLayers.forEach((tileLayer) => tileLayer.off().remove());
    tileLayers = [];
  };

  const _splitOverInternationalDateLine = (
    polyline: L.LatLngTuple[],
  ): L.LatLngTuple[][] => {
    const latlngArray: L.LatLngTuple[][] = [[]];

    polyline.forEach((value, index, array) => {
      const subArray = latlngArray[latlngArray.length - 1]!;
      subArray.push(value);

      const nextValue = array[index + 1];

      if (
        nextValue &&
        Math.abs(nextValue[1]) + Math.abs(value[1]) >= 180 &&
        nextValue[1] * value[1] < 0
      ) {
        latlngArray.push([]);
      }
    });

    return latlngArray;
  };

  /** --- Marker functions --- */
  const addMarker = (
    marker: Marker,
    id?: string,
    callback?: L.LeafletEventHandlerFn,
  ) => {
    withMap((map) => {
      if (callback) {
        marker.on("click", callback);
      }

      if (id) {
        markerMap.set(id, marker);
      }

      markers.push(marker);

      marker.addTo(map);
    });
  };

  const getMarkerById = (id: string) => markerMap.get(id);

  const removeMarkers = () => {
    markers.forEach((marker) => marker.off().remove());
    markers = [];
    markerMap.clear();
  };

  /** --- Popup functions --- */

  const showPopup = (id: string, el: HTMLElement) => {
    withLeafletAndMap((L, _map) => {
      // https://leafletjs.com/reference.html#popup

      const marker = getMarkerById(id);

      // paging and race conditions could make this null
      if (marker) {
        if (!marker.getPopup()) {
          // https://leafletjs.com/reference.html#popup
          marker.bindPopup(el, {
            keepInView: true, // buggy if true; see https://github.com/Leaflet/Leaflet/issues/5035
            minWidth: 360,
            autoPanPadding: L.point(100, 100),
            autoPan: false, // we do it manually
          });
        }

        marker.openPopup();
      }
    });
  };

  const closePopups = () => withMap((map) => map.closePopup());

  /** --- Polyline functions --- */

  const addPolyline = (
    polyline: L.LatLngTuple[],
    options: L.PolylineOptions = {},
  ) => {
    withLeafletAndMap((L, map) => {
      const splitPolyline = _splitOverInternationalDateLine(polyline);

      polylineLayers.push(
        L.polyline(splitPolyline, {
          ...options,
        }).addTo(map),
      );
    });
  };

  // const testAddPolylineDateline = () => {
  //   const sydney: L.LatLngTuple = [-33.8688, 151.2093];
  //   const wellingtonNZ: L.LatLngTuple = [-41.2865, 174.7762];
  //   const honolulu: L.LatLngTuple = [21.3069, -157.8583];
  //   const sd: L.LatLngTuple = [32.7308, -117.1426];

  //   return addPolyline([sydney, wellingtonNZ, honolulu, sd]);
  // };

  const showPolylines = () =>
    withMap((map) => {
      polylineLayers.forEach((pl) => pl.addTo(map));
    });

  const hidePolylines = () => polylineLayers.forEach((pl) => pl.remove());

  const removePolylines = () => {
    polylineLayers.forEach((polyline) => polyline.off().remove());
    polylineLayers = [];
  };

  /** --- Polygons --- */

  const addPolygon = (
    polyline: L.LatLngTuple[],
    options?: L.PolylineOptions,
  ) => {
    withLeafletAndMap((L, map) => {
      polygonLayers.push(
        L.polygon(polyline, {
          ...options,
        }).addTo(map),
      );
    });
  };

  const removePolygons = () => {
    polygonLayers.forEach((polygon) => polygon.off().remove());
    polygonLayers = [];
  };

  /**
   * Fetch the bounds defined by the polylineLayers and polygonLayers.
   */
  const getBoundsForAllLayers = () =>
    withLeaflet((L) =>
      L.featureGroup([
        ...markers,
        ...polylineLayers,
        ...polygonLayers,
        ...geoJSONLayers,
      ]).getBounds(),
    );

  /** --- geoJSON --- */

  const addGeoJSONLayer = (geoJSON: any, options: L.GeoJSONOptions = {}) => {
    withLeafletAndMap((L, map) => {
      geoJSONLayers.push(L.geoJSON(geoJSON, options).addTo(map));
    });
  };

  const removeGeoJSONLayers = () => {
    geoJSONLayers.forEach((geoJSON) => geoJSON.off().remove());
    geoJSONLayers = [];
  };

  /** --- Zoom & Position --- */

  const getZoom = () => withMap((map) => map.getZoom());

  const getZoomForBounds = async (bounds: L.LatLngBounds) =>
    (await withMap((map) => map.getBoundsZoom(bounds))) ?? 5;

  const zoomToBounds = async ({
    bounds,
    duration = defaultDurationInMS, // milliseconds
    padding = 0,
  }: {
    bounds?: L.LatLngBounds;
    duration?: number;
    padding?: number;
  } = {}) => {
    withLeafletAndMap(async (L, map) => {
      const zoom = await getZoom();
      const zoomTo = bounds || (await getBoundsForAllLayers());

      if (zoomTo && zoomTo.isValid()) {
        const newZoom = map.getBoundsZoom(zoomTo);

        if (!bounds || newZoom !== zoom) {
          if (duration === 0) {
            map.fitBounds(zoomTo, {
              animate: false,
              padding: L.point(padding, padding),
            });
          } else {
            // duration in seconds
            map.flyToBounds(zoomTo, {
              animate: true,
              duration: duration / 1000,
            });
          }
        }
      }
    });
  };

  const zoomToID = ({
    id,
    before = 1,
    after = 2,
    yoffset = 0,
    duration = defaultDurationInMS,
  }: {
    id: string;
    before?: number;
    after?: number;
    yoffset?: number;
    duration?: number;
  }) => {
    return withLeafletAndMap(async (L, map) => {
      const marker = getMarkerById(id);

      if (marker) {
        const index = markers.indexOf(marker);
        const minIndex = Math.max(0, index - before);
        const maxIndex = Math.min(index + after + 1, markers.length);
        const latlngs = markers
          .slice(minIndex, maxIndex)
          .map((marker) => marker.getLatLng());

        const smallbounds = L.polyline(latlngs).getBounds();

        const zoom = await getZoomForBounds(smallbounds);

        let latlng = marker.getLatLng();

        try {
          if (yoffset) {
            const targetPoint = map
              .project(latlng, zoom)
              .subtract([0, yoffset]);

            latlng = map.unproject(targetPoint, zoom);
          }

          setCenter({
            lat: latlng.lat,
            lng: latlng.lng,
            zoom,
            duration,
          });
        } catch (_) {
          // fail quietly
        }
      }
    });
  };

  const setCenter = ({
    lat,
    lng,
    zoom,
    duration = defaultDurationInMS,
  }: {
    lat: number;
    lng: number;
    zoom?: number;
    duration?: number;
  }) => {
    withLeafletAndMap(async (L, map) => {
      const _theZoom = zoom ?? (await getZoom());

      const [minZoom, maxZoom] = [map.getMinZoom(), map.getMaxZoom()];

      const theZoom = isNumber(_theZoom)
        ? Math.min(maxZoom, Math.max(minZoom, _theZoom))
        : undefined;

      if (duration === 0) {
        map.setView(new L.LatLng(lat, lng), theZoom, {
          animate: false,
        });
      } else {
        map.flyTo(new L.LatLng(lat, lng), theZoom, {
          animate: true,
          duration: duration / 1_000,
        });
      }
    });
  };

  const setZoomControl = (enabled: boolean) => {
    withMap((map) => {
      if (enabled) {
        map.addControl(map.zoomControl);
      } else {
        map.removeControl(map.zoomControl);
      }
    });
  };

  const setEnableInteraction = (enabled: boolean) => {
    withMap((map) => {
      if (enabled) {
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        // map.addControl(map.zoomControl);
      } else {
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
        // map.removeControl(map.zoomControl);
      }

      setZoomControl(enabled);
    });
  };

  const invalidateSize = () => {
    // when flipping between pages quickly there might be instances where
    // invalidSize() gets called before _mapPane is ready or after it's
    // destroyed

    withMap((map) => {
      // if ("_mapPane" in map && map._mapPane) {
      // if (map.getContainer()) {
      map.invalidateSize();
      // }
    });
  };

  const resize = () => invalidateSize();

  // const pause = (ms: number) =>
  //   new Promise((resolve) => setTimeout(resolve, ms));

  onMounted(async () => {
    try {
      await semaphore.acquire();

      if (el.value && el.value.isConnected && isEnabled) {
        const _L = await import("leaflet");

        // test what happens if unmount happens before this all finishes
        // would a semaphore help here? tbc
        // await pause(5000);

        const _map = _L.map(el.value, {
          center,
          zoom,
          worldCopyJump: true,
          ...leafletOptions,
        });

        // If we make it here, that means with have a Leaflet and map instance
        // and can resolve our promises.
        leafletReady.resolve(_L);
        mapReady.resolve(_map);

        _map.attributionControl.setPrefix(false);
      } else if (isEnabled) {
        throw new Error("Could not mount Leaflet maps to element.");
      }
    } catch (e) {
      // If anything goes wrong, we resolve with null, which prevents the
      // callbacks from being executed.
      mapReady.resolve(null);
      leafletReady.resolve(null);
      mapTilesReady.resolve(null);
    } finally {
      semaphore.release();
    }
  });

  onBeforeUnmount(async () => {
    try {
      await semaphore.acquire();

      withMap((map) => {
        removeMarkers();
        removePolylines();
        removeTileLayers();
        removeGeoJSONLayers();
        removePolygons();

        map.off();
        map.remove();
      });
    } finally {
      // Final cleanup if for any reason these promises were not resolved
      // (especially mapTilesReady, which only runs if the client adds a tile
      // layer)
      mapReady.resolve(null);
      leafletReady.resolve(null);
      mapTilesReady.resolve(null);

      semaphore.release();
    }
  });

  return {
    addGeoJSONLayer,
    addMarker,
    addPolygon,
    addPolyline,
    addTileLayer,
    closePopups,
    getMarkerById,
    getZoom,
    hidePolylines,
    invalidateSize,
    getBoundsForAllLayers,
    removeGeoJSONLayers,
    removeMarkers,
    removePolygons,
    removePolylines,
    resize,
    setCenter,
    setEnableInteraction,
    setZoomControl,
    showPolylines,
    showPopup,
    // testAddPolylineDateline,
    withLeaflet,
    withLeafletAndMap,
    withMap,
    withMapTilesLoaded,
    zoomToBounds,
    zoomToID,
  };
};
