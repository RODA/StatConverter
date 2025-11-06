// encapsulation

import { ipcRenderer } from 'electron';
import * as interfaces from './library/interfaces';

// Return a Promise so callers can optionally await the user's response
export const showMessage = (obj: interfaces.ShowMessage) => {
    return ipcRenderer.invoke('showMessage', obj);
}

export const showError = (message: string) => {
    ipcRenderer.send('showError', message);
}
