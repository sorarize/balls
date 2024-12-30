import * as dat from 'dat.gui';
import Config from './Config';
import Settings from './Settings';
import { saveJson } from './saveJson';

Settings.init();

export default () => {
  const { refresh, reload } = Settings;
  const oControl = {
    save: () => {
      saveJson(Config, 'Settings');
    },
  };

  const gui = new dat.GUI({ width: 300 });
  // gui.add(Config, 'value', 0, 1).onFinishChange(refresh);
  // gui.add(Config, 'autoSave').onFinishChange(reload);

  gui.add(Config, 'DEBUG').onChange(reload);

  gui.add(oControl, 'save').name('Save Settings');
  gui.add(Settings, 'reset').name('Reset Default');
};
