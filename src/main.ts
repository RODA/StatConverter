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
import * as pty from 'node-pty';

import WebSocket from 'ws';


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
    let R_path = '';
    let findR;

    try {
        if (process.platform === 'win32') {
            findR = commandExec.execSync('where.exe R.exe', {
                shell: 'cmd.exe',
                cwd: process.cwd(),
                env: process.env,
                encoding: 'utf-8' as BufferEncoding
            });
        } else {
            findR = commandExec.execSync('which R', {
                shell: '/bin/bash',
                cwd: process.cwd(),
                env: process.env,
                encoding: 'utf-8' as BufferEncoding
            });
        }

        R_path = findR.replace(/(\r\n|\n|\r)/gm, "");

    } catch (error) {

        dialog.showMessageBox(mainWindow, {
            type: 'question',
            title: 'Select R path',
            message: 'Could not find R. Select the path to the binary?'

        }).then((response) => {

          if(response){
              dialog.showOpenDialog(mainWindow, {
                  title: 'R path',
                  properties:[ 'openFile'],
              }).then((result) => {

                  // console.log(result.filePaths);
                  R_path = result.filePaths[0];

                  if (R_path != ''){
                    start_R_server(R_path);
                  }
              
              });
            }
        });

    }

    // console.log(shell);

    if (R_path != ''){
      start_R_server(R_path);
    } 


    let fileToConvert: string;
    let convertedFile: string;

    ipcMain.on('selectFile', (event) => {
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

// let Rprocess: commandExec.ChildProcessWithoutNullStreams;

// const pause = async function(x: number): Promise<boolean> {
//   const sleepNow = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
//   await sleepNow(x);
//   return(true)
// }

const start_R_server = function(R_path: string): void {
    
  const RptyProcess = pty.spawn(R_path, ['-q', '--no-save'], {});
  
  RptyProcess.write(
    'source("' +  path.join(__dirname, "../src/") + 'startServer.R")\n'
  );
  
  RptyProcess.onData((data) => {
    // console.log(data);

    if (data.includes("_server_started_")) {
      // console.log("server started");
      const Rws = new WebSocket('ws://127.0.0.1:12345');
      
      Rws.on('open', function open() {
        Rws.send('aa <- 2 + 2');
        Rws.send('ls()');
      });

      Rws.addEventListener('message', function (event) {
        console.log(event.data);
      });

    } else if (data.includes("Package(s) not installed")) {
      // server_started = false;
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Missing packages',
        message: data
      })
    }
  })
}
