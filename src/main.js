import './style.css';
import { setupCanvas } from './sketch';
import addControls from './Controls';

addControls();

document.querySelector('#app').innerHTML = `
  <div id="canvas-container"></div>
`;

setupCanvas();
