import Vue from 'vue'
import App from './App.vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/antd.css'

Vue.use(Antd)

const app = new Vue({ //eslint-disable-line
    el: '#app',
    render: h => h(App)
})
