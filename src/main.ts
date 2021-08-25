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
        maxWidth: 1024,
        maxHeight: 768,
        minWidth: 1024,
        minHeight: 768,
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


    const inputOutput: {
        inputType: string;
        fileFrom: string;
        fileFromName: string;
        fileFromDir: string;
        outputType: string;
        fileTo: string;
    } = {
        inputType: '',
        fileFrom: '',
        fileFromName: '',
        fileFromDir: '',
        outputType: '',
        fileTo: '',
    }

    ipcMain.on('selectFileFrom', (event, args) => {

        const ext: string[] = [];
        let fileTypeName = '';
        switch (args.inputType) {
            case 'ddi':
                ext.push('xml');
                fileTypeName = 'DDI Files (xml)';
                break
            case 'excel':
                ext.push('xlsx');
                fileTypeName = 'Excel Files (only xlsx)';
                break
            case 'sas':
                ext.push('sas7bdat');
                fileTypeName = 'SAS Files (sas7bdat)';
                break
            case 'spss':
                ext.push('sav');
                ext.push('por');
                fileTypeName = 'SPSS Files (sav, por)';
                break
            case 'stata':
                ext.push('dta');
                fileTypeName = 'Stata Files (dta)';
                break
            case 'r':
                ext.push('rds');
                fileTypeName = 'R Files (rds, rda)';
                break
            default:
                ext.push('*');
        }

        dialog.showOpenDialog(mainWindow, {

            title: 'Choose file',
            filters: [{
                name: fileTypeName,
                extensions: ext
            }],
            properties: ['openFile'],

        }).then(result => {

            if (!result.canceled) {

                inputOutput.fileFrom = result.filePaths[0];

                const file = path.basename(inputOutput.fileFrom);

                inputOutput.inputType = path.extname(file);
                inputOutput.fileFromName = path.basename(inputOutput.fileFrom, inputOutput.inputType);
                inputOutput.fileFromDir = path.dirname(inputOutput.fileFrom);

                event.reply('selectFileFrom-reply', {
                    file1: inputOutput.fileFrom,
                    file2: inputOutput.fileFromDir
                });
            }

        }).catch(err => {
            console.log(err)
        })
    });


    ipcMain.on('selectFileTo', (event, args) => {

        if(args.outputType === 'Select file type'){
            dialog.showErrorBox(
                'Error',
                'Please select the file output type'
            )
        } else {                   

            let ext = '';
            switch (args.outputType) {
                case 'ddi':
                    ext = 'xml';
                    break
                case 'excel':
                    ext = 'xlsx';
                    break
                case 'sas':
                    ext = 'sas7bdat';
                    break
                case 'spss':
                    ext = 'sav';
                    break
                case 'stata':
                    ext = 'dta';
                    break
                case 'r':
                    ext = 'rds';
                    break
            }

            dialog.showSaveDialog(mainWindow, {
                title: 'Select file to save',
                defaultPath: inputOutput.fileFromDir + '/' + inputOutput.fileFromName + '.' + ext
            }).then( result => {
        
                if(!result.canceled){
                    event.reply('selectFileTo-reply', {
                        file: result.filePath,
                    });
                }
                
            })
        }
    });
    

    ipcMain.on('startConvert', (event, args) => {
        
        console.log(inputOutput);
        
        console.log(args);
        
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
            const Rws = new WebSocket('ws://127.0.0.1:12345');

            Rws.on('open', function open() {
                Rws.send('aa <- 2 + 2');
                Rws.send('ls()');
            });

            Rws.addEventListener('message', function(event) {
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