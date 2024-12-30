import './style.css';
import { setupCanvas } from './sketch';

document.querySelector('#app').innerHTML = `
  <div id="canvas-container"></div>
`;

setupCanvas();
