<template>
  <a-row id="app">
    <a-col :span="8" id="sidebar">
      <h2>mapbox-gl-arcgis-featureserver</h2>

      <h4>Sample services</h4>

      <a-radio-group @change="changeLayer" defaultValue="Kentucky Counties">
        <a-radio v-for="option in options" :key="option.name" :value="option.name">{{option.name}}</a-radio>
      </a-radio-group>

    </a-col>
    <a-col :span="16">
      <Map
      :options="options"
      :selectedOption="selectedOption"
      />
    </a-col>
  </a-row>
</template>

<script>

import Map from './Map.vue'

export default {
    name: 'App',
    components: {
      Map
    },
    data () {
      return {
        selected: 'Kentucky Counties',
        options: [
          {
            name: 'Kentucky Counties',
            url: 'https://services2.arcgis.com/CcI36Pduqd0OR4W9/ArcGIS/rest/services/County_Polygon/FeatureServer/0',
            srcName: 'counties-src',
            labelField: 'NAME'
          },
          {
            name: 'Kentucky Highways',
            url: 'https://services2.arcgis.com/CcI36Pduqd0OR4W9/ArcGIS/rest/services/KYTC_US_Highway/FeatureServer/0',
            srcName: 'roads-src',
            labelField: 'RD_NAME'
          },
          {
            name: 'Kentucky Traffic Cameras',
            url: 'https://services2.arcgis.com/CcI36Pduqd0OR4W9/ArcGIS/rest/services/trafficCamerasCur_Prd/FeatureServer/0',
            srcName: 'traffic-src',
            labelField: 'name'
          },
          // {
          //   name: 'Token layer ...',
          //   url: 'https://my-authenticated-layer.com/path/to/rest/services/HiddenBoatTreasures/FeatureServer/42',
          //   srcName: 'hidden-treasure',
          //   labelField: 'name',
          //   token: 'token.....'
          // }
        ]
      }
    },
    computed: {
      selectedOption () {
        return this.options.find(o => o.name === this.selected)
      }
    },
    methods: {
      changeLayer(e) {
        this.selected = e.target.value
      }
    }
}

</script>

<style>

  html, body, #app {
    height: 100%;
  }

  #sidebar {
    padding: 40px;
  }

  #sidebar .ant-radio-wrapper {
    display: block;
    line-height: 40px;
  }

</style>
