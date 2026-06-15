import * as leaflet from 'leaflet';
import { Ref } from 'vue';

type Leaflet = typeof leaflet;
type Marker = L.Marker | L.CircleMarker;
type LeafletMapsBaseOptions = {
    el: Ref<HTMLDivElement | null>;
    center?: L.LatLngExpression;
    zoom?: number;
    leafletOptions?: L.MapOptions;
    duration?: number;
    disabled?: boolean;
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
declare const useLeafletMapsBase: ({ el, center, zoom, leafletOptions, duration, disabled, }: LeafletMapsBaseOptions) => {
    addGeoJSONLayer: (geoJSON: any, options?: L.GeoJSONOptions) => void;
    addMarker: (marker: Marker, id?: string, callback?: L.LeafletEventHandlerFn) => void;
    addPolygon: (polyline: L.LatLngTuple[], options?: L.PolylineOptions) => void;
    addPolyline: (polyline: L.LatLngTuple[], options?: L.PolylineOptions) => void;
    addTileLayer: (layer: L.TileLayer) => void;
    closePopups: () => Promise<leaflet.Map | null>;
    getMarkerById: (id: string) => Marker | undefined;
    getZoom: () => Promise<number | null>;
    hidePolylines: () => void;
    invalidateSize: () => void;
    getBoundsForAllLayers: () => Promise<leaflet.LatLngBounds | null>;
    removeGeoJSONLayers: () => void;
    removeMarkers: () => void;
    removePolygons: () => void;
    removePolylines: () => void;
    resize: () => void;
    setCenter: ({ lat, lng, zoom, duration, }: {
        lat: number;
        lng: number;
        zoom?: number;
        duration?: number;
    }) => void;
    setEnableInteraction: (enabled: boolean) => void;
    setZoomControl: (enabled: boolean) => void;
    showPolylines: () => Promise<void | null>;
    showPopup: (id: string, el: HTMLElement) => void;
    withLeaflet: <T>(fn: (L: Leaflet) => T | Promise<T>) => Promise<T | null>;
    withLeafletAndMap: <T>(fn: (L: Leaflet, map: L.Map) => T | Promise<T>) => Promise<T | null>;
    withMap: <T>(fn: (map: L.Map) => T | Promise<T>) => Promise<T | null>;
    withMapTilesLoaded: <T>(fn: (tileLayer: L.TileLayer) => T | Promise<T>) => Promise<T | null>;
    zoomToBounds: ({ bounds, duration, padding, }?: {
        bounds?: L.LatLngBounds;
        duration?: number;
        padding?: number;
    }) => Promise<void>;
    zoomToID: ({ id, before, after, yoffset, duration, }: {
        id: string;
        before?: number;
        after?: number;
        yoffset?: number;
        duration?: number;
    }) => Promise<void | null>;
};

export { type LeafletMapsBaseOptions, type Marker, useLeafletMapsBase };
