import { registerRootComponent } from 'expo';

import App from '../../App';

export function boot() {
  registerRootComponent(App);
}
