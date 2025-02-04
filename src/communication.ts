// encapsulation

import { ipcRenderer } from 'electron';
import * as interfaces from './library/interfaces';

export const showMessage = (obj: interfaces.ShowMessage) => {
    ipcRenderer.send('showMessage', obj);
}

export const showError = (message: string) => {
    ipcRenderer.send('showError', message);
}
