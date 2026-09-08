import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ElLoading } from 'element-plus'
import './styles/element-plus'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import { router } from './app/router'
import { useThemeStore } from './app/stores/theme'
import './styles/tokens.css'
import './styles/global.css'

const app = createApp(App)
app.use(createPinia())
useThemeStore().init()
app.use(router)
app.use(ElLoading)
app.mount('#app')
