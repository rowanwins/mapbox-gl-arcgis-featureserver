# mapbox-gl-arcgis-featureserver
A library for retrieving features from an ArcGIS FeatureServer or MapServer. This library makes tiled requests rather than simply requesting every feature. 

By default it requests data using the arcgis `pbf` format to minimise payload size, however if that is not available it attempts to use the `geojson` format.

**[Check out the demo](https://rowanwins.github.io/mapbox-gl-arcgis-featureserver/)**

**Note** This library is compatible with both mapbox-gl and maplibre-gl.

**ArcGIS Compatibility** This library relies on ArcGIS Enterprise/Server v10.4+. In v10.4 (Feb 2016) the `geojson` format was added as a supported format. In v10.7 (Mar 2019) the `pbf` format was added. ArcGIS Online meets these requirements. 


### Basic Usage
````
  import FeatureService from 'mapbox-gl-arcgis-featureserver'

  map.on('load', () => {
    
    const fsSourceId = 'featureserver-src'

    const service = new FeatureService(fsSourceId, map, {
      url: 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Administrative_Boundaries_Theme/FeatureServer/6'
    })
    
    map.addLayer({
      'id': 'fill-lyr',
      'source': fsSourceId,
      'type': 'fill',
      'paint': {
        'fill-opacity': 0.5,
        'fill-color': '#B42222'
      }
    })

  })
````

## API
This library exposes a single `FeatureService` class 

### Constructor Options
| Option | Type | Description |
--- | --- | ---
| `sourceId` | `String` **required** | A string  |
| `map` | `Object` **required** | A `mapbox-gl` or `maplibre-gl` `map` instance. |
| `arcgisOptions` | `Object` **required** | A range of options which will be used to manage the arcgis service. See below. |
| `geojsonSourceOptions` | `Object` | A object which will be passed to the creation of the mapbox-gl [geojson source](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson) |


#### ArcGIS Options
| Option | Type | Default | Description |
--- | --- | --- | ---
| `url` | `String` **required** | | The url of the feature service ending in a number eg `https://services2.arcgis.com/CcI36Pduqd0OR4W9/ArcGIS/rest/services/County_Polygon/FeatureServer/0`. Can also be a MapServer endpoint ending in a number. |
| `useStaticZoomLevel` | `Boolean` | `false` | Whether to only get tiles at a single zoom level. If true then set `minZoom` to the desired level. |
| `minZoom` | `Number` | if `useStaticZoom` is `true` then `7`, otherwise `2` | The zoom level to start requesting tiles. |
| `simplifyFactor` | `Number` | `0.3` | An number between 0 & 1 indicating how much to simplify geometries by. 0 to doesn't simplify, 1 for maximum simplification. |
| `precision` | `Number` | `6` | How many digits of precision to request from the server. [Wikipedia](https://en.wikipedia.org/wiki/Decimal_degrees#Precision) has a helpfu; reference of digit precision. |
| `setAttributionFromService` | `Boolean` | `true` | Retrieves the copyrightText field from the esri service and adds it as an attribution to the map if something is available. |
| `where` | `String` | `1=1` | A where clause for restricting which features are returned. By default everything is returned. |
| `outFields` | `String` | `*` | Which fields/attributes to return for each feature. By default everything is returned. If you have many attributes you may want to retrieve only a subset and then retrieve the rest for an individual feature using an on click event with the `getFeatureByObjectIds()` method. |
| `from` | `Date` | | A start date for a time-enabled layer. |
| `to` | `Date` | | An end date for a time-enabled layer. |
| `useSeviceBounds` | `Boolean` | `true` | Only retrieve data for those areas within the extent advertised by the service metadata. |
| `projectionEndpoint` | `String` | * See note below | A url of an ArcGIS Server Geometry Server which is called if the extent of the services isn't in EPSG4326. The fallback uses the ArcGIS Online instance, however please ensure that you are using the service within the [Esri licensing arrangements](https://developers.arcgis.com/faq/#licensing).|
| `token` | `String | null` | null | The token to use when making requests to Esri. `null`, the default, will not append any token paramter to the requests. | 

*Note* First tries to find a project endpoint on the Server instance based on the service URL, but falls back to using `https://tasks.arcgisonline.com/arcgis/rest/services/Geometry/GeometryServer/project` if it can't find one. 

### Properties
| Method  | Description |
------- | -----------
| serviceMetadata | Returns the service endpoint metadata as JSON. |

### Methods
| Method  | Description |
------- | -----------
| destroySource() | **Important** The `destroySource()` method removes the source from the map and associated event listeners for retrieving data which request data as the map is panned, so it's important to call this method if removing the layer from the map completely. |
| disableRequests() | **Important**  The `disableRequests()` method temporarily disables the associated event listeners for retrieving data which request data as the map is panned, you may want to call this if you toggle your layer off. |
| enableRequests() | **Important**  The `enableRequests()` method enables the associated event listeners for retrieving data which request data as the map is panned. By default this is called by the constructor. |
| getFeaturesByLonLat(<MapboxLatLonObject> latLon, <Number=20> searchRadiusInMeters, <Boolean=False>returnGeometry) | Returns a promise which when resolved returns the features as an geojson object. By default the search radius is 20 metres, and the geometry is not returned. |
| getFeaturesByObjectIds(<string>objectIds, <Boolean=False>returnGeometry) | Takes a comma seperated list of strings, or an array of objectIds. Returns a promise which when resolved returns the features as an geojson object. By default the geometry is not returned. |
| setWhere(<String>query) | Redraws the layer with a new where query applied. Corresponds to the option above on the Esri Service Options. |
| clearWhere() | Clears the where clause and redraws the layer with all features. |
| setDate(<Date> from, <Date> to) | Redraws the layer with he passed time range. |
| setToken(<string>token) | Updates the token associated with requests to Esri. Note that if the service requires a token, the initial value should be passed as a parameter in ArcGIS options. |


#### Example of disabling and enabling requests
It would be nice if disabling/enabling of requests happened automatically but unfortunantly I haven't found a way to make that happen because of how `sources` and `layers` are managed in mapbox-gl.
````
    const srcId = 'fs-src'
    const service = new FeatureService(srcId, map, {
      url: 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Administrative_Boundaries_Theme/FeatureServer/6'
    })
    
    const fsLyrId = 'fs-fill-lyr'
    map.addLayer({
      'id': fsLyrId,
      'source': srcId,
      'type': 'fill',
      'paint': {
        'fill-opacity': 0.5,
        'fill-color': '#B42222'
      }
    })

    function hideFsLayer () {
       map.setLayoutProperty(fsLyrId, 'visibility', 'none')
       service.disableRequests()
    }

    function showFsLayer () {
       map.setLayoutProperty(fsLyrId, 'visibility', 'visible')
       service.enableRequests()
    }

    function removeFsCompletelyFromMap () {
      map.removeLayer(fsLyrId)
      service.destroySource()
    }
````
