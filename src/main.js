import './style.css';
import { setupCanvas } from './sketch';
import Settings from './config/Settings';
import addControls from './config/controls';

Settings.init();
addControls();

document.querySelector('#app').innerHTML = `
  <div id="canvas-container"></div>
`;

setupCanvas();
