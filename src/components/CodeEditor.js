import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/javascript/javascript';
import CodeMirror from 'codemirror';

export class CodeEditor {
  constructor({ value, onChange, onApply }) {
    this.value = value;
    this.onChange = onChange;
    this.onApply = onApply;
    this.editor = null;
  }

  mount(container) {
    this.editor = CodeMirror(container, {
      value: this.value,
      mode: 'javascript',
      theme: 'material',
      lineNumbers: true,
      tabSize: 2,
      autofocus: true,
      lineWrapping: true,
      viewportMargin: Infinity,
      extraKeys: {
        'Tab': (cm) => {
          if (cm.somethingSelected()) {
            cm.indentSelection('add');
          } else {
            cm.replaceSelection('  ', 'end');
          }
        },
        'Ctrl-Enter': (cm) => {
          if (this.onApply) this.onApply();
        },
        'Cmd-Enter': (cm) => {
          if (this.onApply) this.onApply();
        }
      }
    });

    this.editor.on('change', () => {
      if (this.onChange) {
        this.onChange(this.editor.getValue());
      }
    });

    // 自動調整高度
    this.editor.setSize('100%', '800px');
  }

  getValue() {
    return this.editor ? this.editor.getValue() : this.value;
  }

  setValue(value) {
    if (this.editor && value !== this.getValue()) {
      this.editor.setValue(value);
    }
    this.value = value;
  }

  focus() {
    if (this.editor) {
      this.editor.focus();
    }
  }

  dispose() {
    if (this.editor) {
      this.editor.toTextArea();
    }
  }
}
