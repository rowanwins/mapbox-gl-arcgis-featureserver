import tilebelt from '@mapbox/tilebelt'
import tileDecode from 'arcgis-pbf-parser'

export default class FeatureService {

  constructor (sourceId, map, arcgisOptions, geojsonSourceOptions) {
    if (!sourceId || !map || !arcgisOptions) throw new Error('Source id, map and arcgisOptions must be supplied as the first three arguments.')
    if (!arcgisOptions.url) throw new Error('A url must be supplied as part of the esriServiceOptions object.')


    this.sourceId = sourceId
    this._map = map

    this._tileIndices = new Map()
    this._featureIndices = new Map()
    this._featureCollections = new Map()

    this._esriServiceOptions = Object.assign({
      useStaticZoomLevel: false,
      minZoom: arcgisOptions.useStaticZoomLevel ? 7 : 2,
      simplifyFactor: 0.3,
      precision: 8,
      where: '1=1',
      to: null,
      from: null,
      outFields: '*',
      setAttributionFromService: true,
      f: 'pbf',
      useSeviceBounds: true,
      projectionEndpoint: `${arcgisOptions.url.split('rest/services')[0]}rest/services/Geometry/GeometryServer/project`
    }, arcgisOptions)

    this._fallbackProjectionEndpoint = 'https://tasks.arcgisonline.com/arcgis/rest/services/Geometry/GeometryServer/project'
    this.serviceMetadata = null
    this._maxExtent = [-Infinity, Infinity, -Infinity, Infinity]

    const gjOptions = !geojsonSourceOptions ? {} : geojsonSourceOptions
    this._map.addSource(sourceId, Object.assign(gjOptions, {
      type: 'geojson',
      data: this._getBlankFc()
    }))

    this._getServiceMetadata()
      .then(() => {
        if (!this.supportsPbf) {
          if (!this.supportsGeojson) {
            this._map.removeSource(sourceId)
            throw new Error('Server does not support PBF or GeoJSON query formats.')
          }
          this._esriServiceOptions.f = 'geojson'
        }

        if (this._esriServiceOptions.useSeviceBounds) {
          const serviceExtent = this.serviceMetadata.extent
          if (serviceExtent.spatialReference.wkid === 4326) {
            this._setBounds([serviceExtent.xmin, serviceExtent.ymin, serviceExtent.xmax, serviceExtent.ymax])
            this._clearAndRefreshTiles()
          } else {
            this._projectBounds()
          }

        }

        if (this._esriServiceOptions.outFields !== '*') {
          this._esriServiceOptions.outFields = `${this._esriServiceOptions.outFields},${this.serviceMetadata.uniqueIdField.name}`
        }

        this._setAttribution()

        this.enableRequests()

      })
  }

  destroySource () {
    this.disableRequests()
    this._map.removeSource(this.sourceId)
  }

  _getBlankFc () {
    return {
      type: 'FeatureCollection',
      features: []
    }
  }

  _setBounds (bounds) {
    this._maxExtent = bounds
  }

  get supportsGeojson () {
    return this.serviceMetadata.supportedQueryFormats.indexOf('geoJSON') > -1
  }

  get supportsPbf () {
    return this.serviceMetadata.supportedQueryFormats.indexOf('PBF') > -1
  }

  disableRequests () {
    this._map.off('moveend', this._boundEvent)
  }

  enableRequests () {
    this._boundEvent = this._findAndMapData.bind(this)
    this._map.on('moveend', this._boundEvent)
  }

  _clearAndRefreshTiles () {
    this._tileIndices = new Map()
    this._featureIndices = new Map()
    this._featureCollections = new Map()
    this._findAndMapData()
  }

  setWhere (newWhere) {
    this._esriServiceOptions.where = newWhere
    this._clearAndRefreshTiles()
  }

  clearWhere () {
    this._esriServiceOptions.where = '1=1'
    this._clearAndRefreshTiles()
  }

  setDate (to, from) {
    this._esriServiceOptions.to = to
    this._esriServiceOptions.from = from
    this._clearAndRefreshTiles()
  }

  _createOrGetTileIndex (zoomLevel) {
    const existingZoomIndex = this._tileIndices.get(zoomLevel)
    if (existingZoomIndex) return existingZoomIndex
    const newIndex = new Map()
    this._tileIndices.set(zoomLevel, newIndex)
    return newIndex
  }

  _createOrGetFeatureCollection (zoomLevel) {
    const existingZoomIndex = this._featureCollections.get(zoomLevel)
    if (existingZoomIndex) return existingZoomIndex
    const fc = this._getBlankFc()
    this._featureCollections.set(zoomLevel, fc)
    return fc
  }

  _createOrGetFeatureIdIndex (zoomLevel) {
    const existingFeatureIdIndex = this._featureIndices.get(zoomLevel)
    if (existingFeatureIdIndex) return existingFeatureIdIndex
    const newFeatureIdIndex = new Map()
    this._featureIndices.set(zoomLevel, newFeatureIdIndex)
    return newFeatureIdIndex
  }

  async _findAndMapData () {
    const z = this._map.getZoom()

    if (z < this._esriServiceOptions.minZoom) {
      return
    }
    const bounds = this._map.getBounds().toArray()
    const primaryTile = tilebelt.bboxToTile([bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]])

    if (this._esriServiceOptions.useSeviceBounds && !this._doesTileOverlapBbox(this._maxExtent, bounds)) {
      return
    }

    // If we're not using a static zoom level we'll round to the nearest even zoom level
    // This means we don't need to request new data for every zoom level allowing us to reuse the previous levels data
    const zoomLevel = this._esriServiceOptions.useStaticZoomLevel ? this._esriServiceOptions.minZoom : 2 * Math.floor(z / 2)
    const zoomLevelIndex = this._createOrGetTileIndex(zoomLevel)
    const featureIdIndex = this._createOrGetFeatureIdIndex(zoomLevel)
    const fc = this._createOrGetFeatureCollection(zoomLevel)

    const tilesToRequest = []

    if (primaryTile[2] < zoomLevel) {
      let candidateTiles = tilebelt.getChildren(primaryTile)
      let minZoomOfCandidates = candidateTiles[0][2]
      while (minZoomOfCandidates < zoomLevel) {
        const newCandidateTiles = []
        candidateTiles.forEach(t => newCandidateTiles.push(...tilebelt.getChildren(t)))
        candidateTiles = newCandidateTiles
        minZoomOfCandidates = candidateTiles[0][2]
      }

      for (let index = 0; index < candidateTiles.length; index++) {
        if (this._doesTileOverlapBbox(candidateTiles[index], bounds)) {
          tilesToRequest.push(candidateTiles[index])
        }
      }
    } else {
      tilesToRequest.push(primaryTile)
    }

    for (let index = 0; index < tilesToRequest.length; index++) {
      const quadKey = tilebelt.tileToQuadkey(tilesToRequest[index])
      if (zoomLevelIndex.has(quadKey)) {
        tilesToRequest.splice(index, 1)
        index--
      } else zoomLevelIndex.set(quadKey, true)
    }

    if (tilesToRequest.length === 0) {
      this._updateFcOnMap(fc)
      return
    }

    // This tolerance will be used to inform the quantization/simplification of features
    const mapWidth = Math.abs(bounds[1][0] - bounds[0][0])
    const tolerance = (mapWidth / this._map.getCanvas().width) * this._esriServiceOptions.simplifyFactor
    await this._loadTiles(tilesToRequest, tolerance, featureIdIndex, fc)
    this._updateFcOnMap(fc)
  }

  async _loadTiles (tilesToRequest, tolerance, featureIdIndex, fc) {
    return new Promise((resolve) => {
      const promises = tilesToRequest.map(t => this._getTile(t, tolerance))
      Promise.all(promises).then((featureCollections) => {
        featureCollections.forEach((tileFc) => {
          if (tileFc) this._iterateItems(tileFc, featureIdIndex, fc)
        })
        resolve()
      })
    })
  }

  _iterateItems (tileFc, featureIdIndex, fc) {
    tileFc.features.forEach((feature) => {
      if (!featureIdIndex.has(feature.id)) {
        fc.features.push(feature)
        featureIdIndex.set(feature.id)
      }
    })
  }

  get _time () {
    if (!this._esriServiceOptions.to) return false
    let from = this._esriServiceOptions.from
    let to = this._esriServiceOptions.to
    if (from instanceof Date) from = from.valueOf()
    if (to instanceof Date) to = to.valueOf()

    return `${from},${to}`
  }

  _getTile (tile, tolerance) {
    const tileBounds = tilebelt.tileToBBOX(tile)

    const extent = {
      spatialReference: {
        latestWkid: 4326,
        wkid: 4326
      },
      xmin: tileBounds[0],
      ymin: tileBounds[1],
      xmax: tileBounds[2],
      ymax: tileBounds[3]
    }

    const params = new URLSearchParams({
      f: this._esriServiceOptions.f,
      geometry: JSON.stringify(extent),
      where: this._esriServiceOptions.where,
      outFields: this._esriServiceOptions.outFields,
      outSR: 4326,
      returnZ: false,
      returnM: false,
      precision: this._esriServiceOptions.precision,
      quantizationParameters: JSON.stringify({
        extent,
        tolerance,
        mode: 'view'
      }),
      resultType: 'tile',
      spatialRel: 'esriSpatialRelIntersects',
      geometryType: 'esriGeometryEnvelope',
      inSR: 4326
    })

    if (this._time) params.append('time', this._time)

    return new Promise((resolve) => {
      fetch(`${`${this._esriServiceOptions.url}/query?${params.toString()}`}`)
        .then((response) => { //eslint-disable-line
          return this._esriServiceOptions.f === 'pbf' ? response.arrayBuffer() : response.json()
        })
        .then((data) => {
          let out
          try {
            out = this._esriServiceOptions.f === 'pbf' ? tileDecode(new Uint8Array(data)).featureCollection : data
          } catch (err) {
            console.error('Could not parse arcgis buffer. Please check the url you requested.')
          }
          resolve(out)
        })
    })
  }

  _updateFcOnMap (fc) {
    this._map.getSource(this.sourceId).setData(fc)
  }

  _doesTileOverlapBbox(tile, bbox) {
    const tileBounds = tile.length === 4 ? tile : tilebelt.tileToBBOX(tile)
    if (tileBounds[2] < bbox[0][0]) return false
    if (tileBounds[0] > bbox[1][0]) return false
    if (tileBounds[3] < bbox[0][1]) return false
    if (tileBounds[1] > bbox[1][1]) return false
    return true
  }

  _getServiceMetadata () {
    if (this.serviceMetadata !== null) return Promise.resolve(this.serviceMetadata)
    return new Promise((resolve, reject) => {
      fetch(`${this._esriServiceOptions.url}?f=json`)
        .then(response => response.json())
        .then((data) => {
          this.serviceMetadata = data
          resolve(this.serviceMetadata)
        })
        .catch(err => reject(err))
    })
  }

  getFeaturesByLonLat (lnglat, radius, returnGeometry) {
    returnGeometry = returnGeometry ? returnGeometry : false
    radius = radius ? radius : 20

    const params = new URLSearchParams({
      sr: 4326,
      geometryType: 'esriGeometryPoint',
      geometry: JSON.stringify({
        x: lnglat.lng,
        y: lnglat.lat,
        spatialReference: {
          wkid: 4326
        }
      }),
      returnGeometry,
      time: this._time,
      outFields: '*',
      spatialRel: 'esriSpatialRelIntersects',
      units: 'esriSRUnit_Meter',
      distance: radius,
      f: 'geojson'
    })

    return new Promise((resolve) => {
      this._requestJson(`${this._esriServiceOptions.url}/query?${params.toString()}`)
        .then(data => resolve(data))
    })
  }

  getFeaturesByObjectIds (objectIds, returnGeometry) {
    if (Array.isArray(objectIds)) objectIds = objectIds.join(',')
    returnGeometry = returnGeometry ? returnGeometry : false
    const params = new URLSearchParams({
      sr: 4326,
      objectIds,
      returnGeometry,
      outFields: '*',
      f: 'geojson'
    })

    return new Promise((resolve) => {
      this._requestJson(`${this._esriServiceOptions.url}/query?${params.toString()}`)
        .then(data => resolve(data))
    })
  }

  _projectBounds () {
    const params = new URLSearchParams({
      geometries: JSON.stringify({
        geometryType: 'esriGeometryEnvelope',
        geometries: [this.serviceMetadata.extent]
      }),
      inSR: this.serviceMetadata.extent.spatialReference.wkid,
      outSR: 4326,
      f: 'json'
    })

    this._requestJson(`${this._esriServiceOptions.projectionEndpoint}?${params.toString()}`)
      .then((data) => {
        const extent = data.geometries[0]
        this._maxExtent = [extent.xmin, extent.ymin, extent.xmax, extent.ymax]
        this._clearAndRefreshTiles()
      })
      .catch(() => {
        this._esriServiceOptions.projectionEndpoint = this._fallbackProjectionEndpoint
        this._projectBounds()
      })
  }

  _requestJson (url) {
    return new Promise((resolve, reject) => {
      fetch(url)
        .then(response => response.json())
        .then((data) => {
          if ('error' in data) reject(new Error('Endpoint doesnt exist'))
          resolve(data)
        })
        .catch(error => reject(error))
    })
  }

  _setAttribution () {
    const POWERED_BY_ESRI_ATTRIBUTION_STRING = 'Powered by <a href="https://www.esri.com">Esri</a>'

    const attributionController = this._map._controls.find(c => '_attribHTML' in c)

    if (!attributionController) return;

    const customAttribution = attributionController.options.customAttribution

    if (typeof customAttribution === 'string') {
      attributionController.options.customAttribution = `${customAttribution} | ${POWERED_BY_ESRI_ATTRIBUTION_STRING}`
    } else if (customAttribution === undefined) {
      attributionController.options.customAttribution = POWERED_BY_ESRI_ATTRIBUTION_STRING
    } else if (Array.isArray(customAttribution)) {
      if (customAttribution.indexOf(POWERED_BY_ESRI_ATTRIBUTION_STRING) === -1) {
        customAttribution.push(POWERED_BY_ESRI_ATTRIBUTION_STRING)
      }
    }

    if (this._esriServiceOptions.setAttributionFromService && this.serviceMetadata.copyrightText.length > 0) {
      this._map.style.sourceCaches[this.sourceId]._source.attribution = this.serviceMetadata.copyrightText
    }

    attributionController._updateAttributions()
  }

}


