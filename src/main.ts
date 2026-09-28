import { createApp } from 'vue';
import App from './app/App.vue';
import { APP_SERVICES_KEY, createAppServices } from './app/bootstrap';
import { db } from './infrastructure/firebase/client';

import './style.css';

const app = createApp(App);
app.provide(APP_SERVICES_KEY, createAppServices(db));

app.mount('#app');

