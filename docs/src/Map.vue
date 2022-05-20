<template>
    <div id="map"></div>
</template>

<script>
import { Map, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import FeatureService from '../../src/main'

let layer = null
let map = null
const layerNameTypes = ['circle-lyr-', 'fill-lyr-', 'poly-line-lyr-', 'line-lyr-']
export default {
    name: 'Map',
    props: ['selectedOption', 'options'],
    watch: {
      selectedOption (newVal, oldVal) {
        this.removeLayers(oldVal)
        // this.hideLayer(oldVal)
        this.setUpLayer(newVal)
        this.showLayer(newVal)
      }
    },
    mounted () {
      const center = [-84, 39]
      const zoom = 5
      const basemapUrl = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'

      map = new Map({
        container: 'map',
        style: basemapUrl,
        center: center,
        zoom: zoom,
        clickTolerance: 6
      })


      map.on('load', () => {
        this.$emit('mapReady', map)
        this.setUpLayer(this.selectedOption)
        this.showLayer(this.selectedOption)
      })
    },
    methods: {
      setUpLayer (layerOption) {
          layer = new FeatureService(layerOption.srcName, map, {
            url: layerOption.url,
            token: layerOption.token || null
          })

          map.addLayer({
            'id': `circle-lyr-${layerOption.srcName}`,
            'type': 'circle',
            'source': layerOption.srcName,
            'filter': ['==', '$type', 'Point'],
            'layout': {
              'visibility': 'none'
            },
            'paint': {
              'circle-radius': 6,
              'circle-color': '#B42222'
            }
          })

          map.addLayer({
            'id': `fill-lyr-${layerOption.srcName}`,
            'type': 'fill',
            'source': layerOption.srcName,
            'filter': ['==', '$type', 'Polygon'],
            'layout': {
                'visibility': 'none'
            },
            'paint': {
              'fill-opacity': 0.5,
              'fill-color': '#B42222'
            }
          })

          map.addLayer({
            'id': `poly-line-lyr-${layerOption.srcName}`,
            'type': 'line',
            'source': layerOption.srcName,
            'filter': ['==', '$type', 'Polygon'],
            'layout': {
                'visibility': 'none'
            },
            'paint': {
              'line-color': '#B42222'
            }
          })

          map.addLayer({
            'id': `line-lyr-${layerOption.srcName}`,
            'type': 'line',
            'source': layerOption.srcName,
            'filter': ['==', '$type', 'LineString'],
            'layout': {
                'visibility': 'none'
            },
            'paint': {
              'line-color': '#B42222'
            }
          })

          layerNameTypes.forEach(t => {
            map.on('click', `${t}${layerOption.srcName}`, function (e) {
              if (e.features.length === 0) return
              const props = e.features[0].properties
              new Popup()
              .setLngLat(e.lngLat)
              .setHTML(`Name: ${props[layerOption.labelField]}`)
              .addTo(map)
            })
          })
      },
      removeLayers (layerOption) {
        layerNameTypes.forEach(t => map.removeLayer(`${t}${layerOption.srcName}`))
        layer.destroySource()
      },
      showLayer (layerOption) {
        layerNameTypes.forEach(t => map.setLayoutProperty(`${t}${layerOption.srcName}`, 'visibility', 'visible'))
      },
      hideLayer (layerOption) {
        layerNameTypes.forEach(t => map.setLayoutProperty(`${t}${layerOption.srcName}`, 'visibility', 'none'))
      }
    }
}

</script>

<style>
#map {
    height: 100vh;
}
</style>