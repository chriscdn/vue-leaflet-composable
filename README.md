# @chriscdn/vue-leaflet-composable

A Vue and Nuxt composable for rendering [Leaflet maps](https://leafletjs.com/).

## Motivation

Importing [Leaflet maps](https://leafletjs.com/) into a Nuxt project is tricky. Leaflet attempts to access the `window` object on import, which will fail if the import occurs during server-side rendering.

This composable works by lazy loading Leaflet on the client, and exposes functions with callback parameters that are only executed if and when a map is successfully mounted. This prevents errors on the server since the callbacks are simply ignored.

The composable also exposes a few methods to help manage tiles, markers, polylines, and polygons.

## Example

Create a nuxt project:

```sh
pnpm create nuxt@latest vue-leaflet-composable-nuxt
```

Install leaflet and the package:

```sh
pnpm i @chriscdn/vue-leaflet-composable leaflet
```

Modify `app.vue`:

```vue
<template>
  <div>
    <div ref="map" class="map" />
    <button @click="flyToSydney">Fly to Sydney</button>
  </div>
</template>

<script lang="ts" setup>
import { useLeafletMapsBase } from "@chriscdn/vue-leaflet-composable";

const map = useTemplateRef("map");

const leafletMap = useLeafletMapsBase({
  el: map,
  center: [45.7, -82.298],
  zoom: 6,
});

leafletMap.withLeafletAndMap((L, map) => {
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
});

// a method, which you could bind to a button
const flyToSydney = () => {
  leafletMap.setCenter({
    lat: -33.8688,
    lng: 151.2093,
    zoom: 12,
    duration: 2000,
  });
};
</script>

<style>
.map {
  border: 1px black solid;
  width: 100%;
  height: 400px;
}
</style>
```

## API

Documentation pending.

## License

[MIT](LICENSE)
