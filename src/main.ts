import { createApp } from 'vue';
import App from './app/App.vue';
import { APP_SERVICES_KEY, createAppServices } from './app/bootstrap';
import { auth, functions } from './infrastructure/firebase/client';

import './style.css';

const app = createApp(App);
app.provide(APP_SERVICES_KEY, createAppServices(auth, functions));

app.mount('#app');

