import * as dat from 'dat.gui';
import Config from '.';
import Settings from './Settings';
import { saveJson } from './saveJson';
import { socketManager } from '../WebSocketManager';

export default () => {
  const { refresh, reload } = Settings;
  const oControl = {
    save: () => {
      saveJson(Config, 'Settings');
    },
  };

  const gui = new dat.GUI({ width: 300 });

  const ballFolder = gui.addFolder('球體設定');

  const afterUpdate = (value, needReload = false) => {
    socketManager.updateConfig(Config);
    needReload ? reload() : refresh();
  };

  gui.add(Config, 'DEBUG').onChange(() => {
    afterUpdate(null, true);
  });

  ballFolder.add(Config, 'CIRCLE_RADIUS', 5, 30, 1).onFinishChange(afterUpdate);
  ballFolder.add(Config, 'SATURATION', 0, 100, 1).onFinishChange(afterUpdate);
  ballFolder.add(Config, 'LIGHTNESS', 0, 100, 1).onFinishChange(afterUpdate);
  ballFolder.add(Config, 'CIRCLE_MIN_DIST', 10, 100, 1).onFinishChange(afterUpdate);

  gui.add(oControl, 'save').name('Save Settings');
  gui.add(Settings, 'reset').name('Reset Default');
  ballFolder.open();
};
