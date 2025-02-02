// encapsulation

import { ipcRenderer } from 'electron';

interface ShowMessageBoxInterface {
    type: 'info' | 'error' | 'question' | 'warning';
    title: string;
    message: string;
}

export const showMessageBox = (obj: ShowMessageBoxInterface) => {
    ipcRenderer.send('showDialogMessage', obj);
}
