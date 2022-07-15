import {terser} from 'rollup-plugin-terser'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

const output = (input, file, format, plugins) => ({
  input,
  output: {
    name: file,
    file,
    format
  },
  plugins
})

export default [
  output('./src/main.js', './dist/mapbox-gl-arcgis-featureserver.js', 'umd', [
    commonjs()
  ]),
  output('./src/main.js', './dist/mapbox-gl-arcgis-featureserver.min.js', 'umd', [
    resolve(),
    commonjs(),
    terser()
  ]),
  output('./src/main.js', './dist/mapbox-gl-arcgis-featureserver.esm.js', 'esm', [
    commonjs()
  ])
]
