import './style.css';
import { setupCanvas } from './sketch';
import Settings from './Settings';
import addControls from './controls';

Settings.init();
addControls();

document.querySelector('#app').innerHTML = `
  <div id="canvas-container"></div>
`;

setupCanvas();
