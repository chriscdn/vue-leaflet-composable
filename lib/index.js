// src/useLeafletMapsBase.ts
import { onBeforeUnmount, onMounted } from "vue";
import { isNumber } from "@chriscdn/to-number";
import { Semaphore } from "@chriscdn/promise-semaphore";

// src/withResolvers.ts
var withResolvers = () => {
  if (typeof Promise.withResolvers === "function") {
    return Promise.withResolvers();
  } else {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
};

// src/useLeafletMapsBase.ts
var createLeafletLoadManager = (isEnabled) => {
  const isBrowser = typeof window !== "undefined";
  if (isBrowser && isEnabled) {
    const leafletReady = withResolvers();
    const mapReady = withResolvers();
    const mapTilesReady = withResolvers();
    const withLeaflet = (fn) => leafletReady.promise.then((L) => L && fn(L));
    const withMap = (fn) => mapReady.promise.then((map) => map && fn(map));
    const withMapTilesLoaded = (fn) => mapTilesReady.promise.then((tileLayer) => tileLayer && fn(tileLayer));
    const withLeafletAndMap = (fn) => withLeaflet((L) => withMap((map) => L && map && fn(L, map)));
    return {
      leafletReady,
      mapReady,
      mapTilesReady,
      withLeaflet,
      withMap,
      withMapTilesLoaded,
      withLeafletAndMap
    };
  } else {
    const noopAsync = (_fn) => Promise.resolve(null);
    const noopDeferred = {
      promise: Promise.resolve(null),
      resolve: () => {
      },
      reject: () => {
      }
    };
    return {
      mapReady: noopDeferred,
      mapTilesReady: noopDeferred,
      leafletReady: noopDeferred,
      withLeaflet: noopAsync,
      withMap: noopAsync,
      withMapTilesLoaded: noopAsync,
      withLeafletAndMap: noopAsync
    };
  }
};
var useLeafletMapsBase = ({
  el,
  center = [45.7, -82.298],
  zoom = 1,
  leafletOptions = {},
  duration = 1e3,
  disabled = false
}) => {
  const semaphore = new Semaphore();
  const isEnabled = !disabled;
  let markers = [];
  const markerMap = /* @__PURE__ */ new Map();
  let polylineLayers = [];
  let polygonLayers = [];
  let tileLayers = [];
  let geoJSONLayers = [];
  const defaultDurationInMS = duration;
  const {
    mapReady,
    mapTilesReady,
    leafletReady,
    withLeaflet,
    withMap,
    withMapTilesLoaded,
    withLeafletAndMap
  } = createLeafletLoadManager(isEnabled);
  const addTileLayer = (layer) => {
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
  const _splitOverInternationalDateLine = (polyline) => {
    const latlngArray = [[]];
    polyline.forEach((value, index, array) => {
      const subArray = latlngArray[latlngArray.length - 1];
      subArray.push(value);
      const nextValue = array[index + 1];
      if (nextValue && Math.abs(nextValue[1]) + Math.abs(value[1]) >= 180 && nextValue[1] * value[1] < 0) {
        latlngArray.push([]);
      }
    });
    return latlngArray;
  };
  const addMarker = (marker, id, callback) => {
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
  const getMarkerById = (id) => markerMap.get(id);
  const removeMarkers = () => {
    markers.forEach((marker) => marker.off().remove());
    markers = [];
    markerMap.clear();
  };
  const showPopup = (id, el2) => {
    withLeafletAndMap((L, _map) => {
      const marker = getMarkerById(id);
      if (marker) {
        if (!marker.getPopup()) {
          marker.bindPopup(el2, {
            keepInView: true,
            // buggy if true; see https://github.com/Leaflet/Leaflet/issues/5035
            minWidth: 360,
            autoPanPadding: L.point(100, 100),
            autoPan: false
            // we do it manually
          });
        }
        marker.openPopup();
      }
    });
  };
  const closePopups = () => withMap((map) => map.closePopup());
  const addPolyline = (polyline, options = {}) => {
    withLeafletAndMap((L, map) => {
      const splitPolyline = _splitOverInternationalDateLine(polyline);
      polylineLayers.push(
        L.polyline(splitPolyline, {
          ...options
        }).addTo(map)
      );
    });
  };
  const showPolylines = () => withMap((map) => {
    polylineLayers.forEach((pl) => pl.addTo(map));
  });
  const hidePolylines = () => polylineLayers.forEach((pl) => pl.remove());
  const removePolylines = () => {
    polylineLayers.forEach((polyline) => polyline.off().remove());
    polylineLayers = [];
  };
  const addPolygon = (polyline, options) => {
    withLeafletAndMap((L, map) => {
      polygonLayers.push(
        L.polygon(polyline, {
          ...options
        }).addTo(map)
      );
    });
  };
  const removePolygons = () => {
    polygonLayers.forEach((polygon) => polygon.off().remove());
    polygonLayers = [];
  };
  const getBoundsForAllLayers = () => withLeaflet(
    (L) => L.featureGroup([
      ...markers,
      ...polylineLayers,
      ...polygonLayers,
      ...geoJSONLayers
    ]).getBounds()
  );
  const addGeoJSONLayer = (geoJSON, options = {}) => {
    withLeafletAndMap((L, map) => {
      geoJSONLayers.push(L.geoJSON(geoJSON, options).addTo(map));
    });
  };
  const removeGeoJSONLayers = () => {
    geoJSONLayers.forEach((geoJSON) => geoJSON.off().remove());
    geoJSONLayers = [];
  };
  const getZoom = () => withMap((map) => map.getZoom());
  const getZoomForBounds = async (bounds) => await withMap((map) => map.getBoundsZoom(bounds)) ?? 5;
  const zoomToBounds = async ({
    bounds,
    duration: duration2 = defaultDurationInMS,
    // milliseconds
    padding = 0
  } = {}) => {
    withLeafletAndMap(async (L, map) => {
      const zoom2 = await getZoom();
      const zoomTo = bounds || await getBoundsForAllLayers();
      if (zoomTo && zoomTo.isValid()) {
        const newZoom = map.getBoundsZoom(zoomTo);
        if (!bounds || newZoom !== zoom2) {
          if (duration2 === 0) {
            map.fitBounds(zoomTo, {
              animate: false,
              padding: L.point(padding, padding)
            });
          } else {
            map.flyToBounds(zoomTo, {
              animate: true,
              duration: duration2 / 1e3
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
    duration: duration2 = defaultDurationInMS
  }) => {
    return withLeafletAndMap(async (L, map) => {
      const marker = getMarkerById(id);
      if (marker) {
        const index = markers.indexOf(marker);
        const minIndex = Math.max(0, index - before);
        const maxIndex = Math.min(index + after + 1, markers.length);
        const latlngs = markers.slice(minIndex, maxIndex).map((marker2) => marker2.getLatLng());
        const smallbounds = L.polyline(latlngs).getBounds();
        const zoom2 = await getZoomForBounds(smallbounds);
        let latlng = marker.getLatLng();
        try {
          if (yoffset) {
            const targetPoint = map.project(latlng, zoom2).subtract([0, yoffset]);
            latlng = map.unproject(targetPoint, zoom2);
          }
          setCenter({
            lat: latlng.lat,
            lng: latlng.lng,
            zoom: zoom2,
            duration: duration2
          });
        } catch (_) {
        }
      }
    });
  };
  const setCenter = ({
    lat,
    lng,
    zoom: zoom2,
    duration: duration2 = defaultDurationInMS
  }) => {
    withLeafletAndMap(async (L, map) => {
      const _theZoom = zoom2 ?? await getZoom();
      const [minZoom, maxZoom] = [map.getMinZoom(), map.getMaxZoom()];
      const theZoom = isNumber(_theZoom) ? Math.min(maxZoom, Math.max(minZoom, _theZoom)) : void 0;
      if (duration2 === 0) {
        map.setView(new L.LatLng(lat, lng), theZoom, {
          animate: false
        });
      } else {
        map.flyTo(new L.LatLng(lat, lng), theZoom, {
          animate: true,
          duration: duration2 / 1e3
        });
      }
    });
  };
  const setZoomControl = (enabled) => {
    withMap((map) => {
      if (enabled) {
        map.addControl(map.zoomControl);
      } else {
        map.removeControl(map.zoomControl);
      }
    });
  };
  const setEnableInteraction = (enabled) => {
    withMap((map) => {
      if (enabled) {
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
      } else {
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
      }
      setZoomControl(enabled);
    });
  };
  const invalidateSize = () => {
    withMap((map) => {
      map.invalidateSize();
    });
  };
  const resize = () => invalidateSize();
  onMounted(async () => {
    try {
      await semaphore.acquire();
      if (el.value && el.value.isConnected && isEnabled) {
        const [_L, _] = await Promise.all([
          import("leaflet"),
          import("leaflet/dist/leaflet.css")
        ]);
        console.log(_);
        const _map = _L.map(el.value, {
          center,
          zoom,
          worldCopyJump: true,
          ...leafletOptions
        });
        leafletReady.resolve(_L);
        mapReady.resolve(_map);
        _map.attributionControl.setPrefix(false);
      } else if (isEnabled) {
        throw new Error("Could not mount Leaflet maps to element.");
      }
    } catch (e) {
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
    zoomToID
  };
};
export {
  useLeafletMapsBase
};
//# sourceMappingURL=index.js.map