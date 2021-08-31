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

import {
    InputOutputType
} from './interfaces';

import {
    helpers
} from "./helpers";


let mainWindow: BrowserWindow;
let Rws: WebSocket;

const inputOutput: InputOutputType = {
    inputType: '',
    fileFrom: '',
    fileFromDir: '',
    fileFromName: '',

    outputType: '',
    fileTo: '',
    fileToDir: '',
    fileToName: '',
};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 700,
        maxWidth: 1024,
        maxHeight: 700,
        minWidth: 1024,
        minHeight: 700,
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
    createWindow();

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

            if (response) {
                dialog.showOpenDialog(mainWindow, {
                    title: 'R path',
                    properties: ['openFile'],
                }).then((result) => {

                    // console.log(result.filePaths);
                    R_path = result.filePaths[0];

                    if (R_path != '') {
                        start_R_server(R_path);
                    }

                });
            }
        });

    }

    // console.log(shell);
    
    if (R_path != '') {
        start_R_server(R_path);
    }


    ipcMain.on('selectFileFrom', (event, args) => {
        if (args.inputType === 'Select file type'){
            dialog.showErrorBox(
                'Error',
                'Select input type'
            )
        } else {
            const info = helpers.fileFromInfo(args.inputType);

            dialog.showOpenDialog(mainWindow, {

                title: 'Select source file',
                filters: [{
                    name: info.fileTypeName,
                    extensions: info.ext
                }],
                properties: ['openFile'],

            }).then(result => {
                
                if (!result.canceled) {
                    
                    inputOutput.fileFrom = result.filePaths[0];

                    const file = path.basename(inputOutput.fileFrom);
                    const ext = path.extname(file);

                    inputOutput.inputType = helpers.getTypeFromExtension(ext);
                    inputOutput.fileFromName = path.basename(inputOutput.fileFrom, ext);
                    inputOutput.fileFromDir = path.dirname(inputOutput.fileFrom);
                    
                    event.reply('selectFileFrom-reply', inputOutput);
                }

            }).catch(err => {
                console.log(err)
            })
        }
    });

    ipcMain.on('selectFileTo', (event, args) => {

        if (args.outputType === 'Select file type'){
            dialog.showErrorBox(
                'Error',
                'Select output type'
            )
        } else {

            const ext = helpers.getExtensionFromType(args.outputType);

            dialog.showSaveDialog(mainWindow, {
                title: 'Select destination file',
                // TODO:
                // if this button is clicked before the input one,
                // fileFromDir is empty
                defaultPath: path.join(inputOutput.fileFromDir, inputOutput.fileFromName + ext)
            }).then( result => {

                if (!result.canceled) {
                    
                    inputOutput.fileTo = "" + result.filePath;

                    const file = path.basename(inputOutput.fileTo);
                    const ext = path.extname(file);

                    inputOutput.outputType = helpers.getTypeFromExtension(ext);
                    inputOutput.fileToName = path.basename(inputOutput.fileTo, ext);
                    inputOutput.fileToDir = path.dirname(inputOutput.fileTo);
                    event.reply('selectFileTo-reply', inputOutput);
                }
                
            }).catch(err => {
                console.log(err)
            })
        }
    });
    

    ipcMain.on('startConvert', (event, args) => {
        
        console.log("-----")
        console.log(args.inputOutput);
        console.log("-----")
    })

    ipcMain.on('showError', (event, args) => {
        dialog.showMessageBox(mainWindow, {
            type: 'error',
            message: args.message

        })
    })

    ipcMain.on('sendCommand', (event, command) => {
        Rws.send(command);
    })





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
        'source("' + path.join(__dirname, "../src/") + 'startServer.R")\n'
    );

    RptyProcess.onData((data) => {
        // console.log(data);

        if (data.includes("_server_started_")) {
            // console.log("server started");
            Rws = new WebSocket('ws://127.0.0.1:12345');

            // Rws.on('open', function open() {
            //     Rws.send('(aa <- 2 + 2)');
            //     Rws.send('bb <- aa + 4');
            //     Rws.send('ls()');
            // });

            Rws.addEventListener('message', function(e) {
                mainWindow.webContents.send('sendCommand-reply', e.data);
                // event.reply('sendCommand-reply', e.data);
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




/* --- Direct pe proces, fara pty... dar nu merge

    const blah = commandExec.spawn(R_path, ['-q', '--no-save'], {});
    blah.stdin.write('source("' + path.join(__dirname, "../src/") + 'startServer.R")\n');

    blah.on('close', (code) => {
        if (code !== 0) {
          console.log(`grep process exited with code ${code}`);
        }
    });

    blah.stdout.on("data", (data) => {
        data = data.toString();
        console.log(data);

        if (data.includes("_server_started_")) {
            console.log("server started");
            Rws = new WebSocket('ws://127.0.0.1:12345');

            Rws.on('open', function open() {
                console.log("open!")
                Rws.send('(aa <- 2 + 2)');
                Rws.send('bb <- aa + 4');
                Rws.send('ls()');
            });

            Rws.addEventListener('message', function(e) {
                mainWindow.webContents.send('sendCommand-reply', e.data);
                // event.reply('sendCommand-reply', e.data);
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
*/
