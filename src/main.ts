process.env.NODE_ENV = 'development';
// process.env.NODE_ENV = 'production';

import {
    app,
    BrowserWindow,
    ipcMain,
    dialog
} from 'electron';
import * as path from "path";
import * as commandExec from 'child_process';

let mainWindow: BrowserWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        backgroundColor: '#fff',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    mainWindow.loadFile(path.join(__dirname, "../index.html"))

    if (process.env.NODE_ENV !== 'development') {
        mainWindow.removeMenu();
    }

    if (process.env.NODE_ENV === 'development') {
        // Open the DevTools.
        mainWindow.webContents.openDevTools();
    }
}
app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })

    // check if R is installed
    let shell = '';
    let findR;

    try {
        if (process.platform === 'win32') {
            findR = commandExec.execSync('where.exe RScript.exe', {
                shell: 'cmd.exe',
                cwd: process.cwd(),
                env: process.env,
                encoding: 'utf-8' as BufferEncoding
            });
        } else {
            findR = commandExec.execSync('which Rscript', {
                shell: '/bin/bash',
                cwd: process.cwd(),
                env: process.env,
                encoding: 'utf-8' as BufferEncoding
            });
        }

        // The R Shell
        shell = findR.replace(/(\r\n|\n|\r)/gm, "");

    } catch (error) {

        dialog.showMessageBox(mainWindow, {
            type: 'question',
            title: 'Select r path',
            message: 'Could not find R. Would you like to select the path?'

        }).then((response) => {

          if(response){
              dialog.showOpenDialog(mainWindow, {
                  title: 'R path',
                  properties:[ 'openFile'],
              }).then((result) => {

                  console.log(result.filePaths);
                  shell = result.filePaths[0];

                  if(shell != ''){
                    startRServer(shell);
                  }
              
              });
            }
        });

    }

    console.log(shell);

    if(shell != ''){
      startRServer(shell);
    } 


    let fileToConvert: string;
    let convertedFile: string;

    ipcMain.on('selectFile', (event, args) => {

        dialog.showOpenDialog(mainWindow, {

            title: 'Alege fisier',
            filters: [{
                name: 'SPSS files',
                extensions: ['sav', 'por']
            }],
            properties: ['openFile'],

        }).then(result => {


            if (!result.canceled) {

                fileToConvert = result.filePaths[0];

                const file = path.basename(fileToConvert, 'sav');
                const dir = path.dirname(fileToConvert);
                convertedFile = dir + '/' + file + 'dta';

                event.reply('selectFile-reply', {
                    file1: fileToConvert,
                    file2: convertedFile
                });
            }

        }).catch(err => {
            console.log(err)
        })
    });
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})


function startRServer(path: string): void{


  commandExec.exec(path + ' -e "2+2"', (error, stdout, stderr) => {


    console.log(error);
    console.log(stdout);
    console.log(stderr);

  })

}