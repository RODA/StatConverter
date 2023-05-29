// ./node_modules/.bin/electron-builder install-app-deps --arch arm64
// ./node_modules/.bin/electron-builder install-app-deps --arch x64

process.env.NODE_ENV = "development";
// process.env.NODE_ENV = 'production';

const production = process.env.NODE_ENV === 'production';
const development = process.env.NODE_ENV === 'development';

// if true, move back the R_Portable directory to:
// StatConverter root
const embeddedR = true;

import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import * as path from "path";
import * as commandExec from "child_process";

import { InputOutputType } from "./interfaces";

import { helpers } from "./helpers";
// import {shellPathSync} from 'shell-path';

let mainWindow: BrowserWindow;
let Rprocess: commandExec.ChildProcessWithoutNullStreams;
let longresponse = "";
let response: {error: string[], variables: {
    [key: string]: {
        label: [string];
        values: {
            [key: string]: [string];
        };
        missing: [string];
        selected: [boolean];
    }
}};

// console.log(app.getVersion());

app.on("window-all-closed", () => {
    // if (RptyProcess) {
    //     RptyProcess.kill();
    // }
    
    app.quit();
});

const inputOutput: InputOutputType = {
    inputType: "",
    fileFrom: "",
    fileFromDir: "",
    fileFromName: "",

    outputType: "",
    fileTo: "",
    fileToDir: "",
    fileToName: "",
};

function createWindow() {
    mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        width: 800,
        height: 550 + (process.platform == "win32" ? 10 : 0),
        maxWidth: 800,
        maxHeight: 550,
        minWidth: 800,
        minHeight: 550,
        backgroundColor: "#fff",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
    });

    mainWindow.loadFile(path.join(__dirname, "../index.html"));
    // mainWindow.webContents.setZoomFactor(2);

    if (production) {
        // mainWindow.removeMenu();
    }

    if (development) {
        // Open the DevTools.
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    app.commandLine.appendSwitch('lang', 'en-US.UTF-8');

    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    let R_path = "";
    
    if (process.platform == 'win32') {
        
        if (production) {
            R_path = path.join(__dirname, '../../R_Portable/bin/R.exe');
        }
        else {
            R_path = path.join(__dirname, '../R_Portable/bin/R.exe');
        }
        
    }
    else { // macos
        
        if (production) {
            R_path = path.join(__dirname, '../../R_Portable/bin/R');
        }
        else {
            R_path = path.join(__dirname, '../R_Portable/bin/R');
        }
        
    }

    // console.log(R_path);
    if (R_path != "") {
        start_R(R_path);
    }

    ipcMain.on("selectFileFrom", (event, args) => {
        if (args.inputType === "Select file type") {
            dialog.showErrorBox("Error", "Select input type");
        } else {
            const info = helpers.fileFromInfo(args.inputType);

            dialog.showOpenDialog(mainWindow, {
                title: "Select source file",
                filters: [
                    {
                        name: info.fileTypeName,
                        extensions: info.ext,
                    },
                ],
                properties: ["openFile"],
            })
            .then((result) => {
                if (!result.canceled) {
                    inputOutput.fileFrom = result.filePaths[0];

                    const file = path.basename(inputOutput.fileFrom);
                    const ext = path.extname(file);

                    inputOutput.inputType = helpers.getTypeFromExtension(ext);
                    inputOutput.fileFromName = path.basename(inputOutput.fileFrom, ext);
                    inputOutput.fileFromDir = path.dirname(inputOutput.fileFrom);

                    if (process.platform == "win32") {
                        inputOutput.fileFrom = inputOutput.fileFrom.replace(/\\/g, '/');
                        inputOutput.fileFromDir = inputOutput.fileFromDir.replace(/\\/g, '/');
                    }

                    event.reply("selectFileFrom-reply", inputOutput);
                }
            })
            .catch((err) => {
                console.log(err);
            });
        }
    });

    ipcMain.on("selectFileTo", (event, args) => {
        if (args.outputType === "Select file type") {
            dialog.showErrorBox("Error", "Select output type");
        } else {
            const ext = helpers.getExtensionFromType(args.outputType);

            dialog
                .showSaveDialog(mainWindow, {
                    title: "Select destination file",
                    // TODO:
                    // if this button is clicked before the input one,
                    // fileFromDir is empty
                    defaultPath: path.join(inputOutput.fileFromDir, inputOutput.fileFromName + ext),
                })
                .then((result) => {
                    if (!result.canceled) {
                        inputOutput.fileTo = "" + result.filePath;

                        const file = path.basename(inputOutput.fileTo);
                        const ext = path.extname(file);

                        inputOutput.outputType = helpers.getTypeFromExtension(ext);
                        inputOutput.fileToName = path.basename(inputOutput.fileTo, ext);
                        inputOutput.fileToDir = path.dirname(inputOutput.fileTo);

                        if (process.platform == "win32") {
                            inputOutput.fileTo = inputOutput.fileTo.replace(/\\/g, '/');
                            inputOutput.fileToDir = inputOutput.fileToDir.replace(/\\/g, '/');
                        }

                        // console.log(inputOutput.fileTo);
                        event.reply("selectFileTo-reply", inputOutput);
                    }
                })
                .catch((err) => {
                    console.log(err);
                });
        }
    });

    ipcMain.on("startConvert", (event, args) => {
        console.log("-----");
        console.log(args.inputOutput);
        console.log("-----");
    });

    ipcMain.on("showError", (event, args) => {
        dialog.showMessageBox(mainWindow, {
            type: "error",
            message: args.message,
        });
    });

    ipcMain.on("sendCommand", (event, command) => {
        mainWindow.webContents.send("startLoader");
        // console.log(command);
        Rprocess.stdin.write(command);
    });

    ipcMain.on("gotoRODA", () => {
        shell.openExternal("http://www.roda.ro");
    });

    ipcMain.on("declared", () => {
        shell.openExternal("https://cran.r-project.org/web/packages/declared/index.html");
    });
});

// let dependencies_ok = false;
// let unmet_dependencies = "";

const start_R = function (R_path: string): void {
    
    const penv = process.env;

    if (process.platform === "win32") {
        if (penv.HOME && !(penv.HOME.includes("Documents"))) {
            penv.HOME = penv.HOME + '\\Documents';
        }
    }
    else {
        penv.test = "test";
    }

    mainWindow.webContents.send("consolog", "R path: " + R_path);
    
    Rprocess = commandExec.spawn(R_path, ["-q", "--no-save"], {
        // stdio: ["pipe", "pipe", "inherit"]
        // encoding: 'utf8'
    });

    Rprocess.stdout.setEncoding("utf-8");
    
    let command = "";

    
    
    // make sure we use the R package library from R_Portable, otherwise
    // a different version of the code depending on using a locally installed R
    if (production) {
        command = ".libPaths('" + path.join(__dirname, "../../R_Portable/library") + "')";
    }
    else {
        command = ".libPaths('" + path.join(__dirname, "../R_Portable/library") + "')";
    }
    
    command = command.replace(/\\/g, '/'); // replace backslash with forward slash
    mainWindow.webContents.send("consolog", command);
    Rprocess.stdin.write(command + '\n');
    

    // console.log(__dirname);
    if (production) {
        command = 'source("' + path.join(__dirname, "../../") + 'startServer.R")';
    }
    else {
        command = 'source("' + path.join(__dirname, "../src/") + 'startServer.R")';
    }
    
    if (process.platform === "win32") {
        command = command.replace(/\\/g, '/'); // replace backslash with forward slash
    }

    Rprocess.stdin.write(command + '\n');

    Rprocess.stdin.write('RGUI_dependencies()\n');

    let startJSON = false;

    Rprocess.stdout.on("data", (data: string) => {

        const datasplit = data.toString().split(/\r?\n/);
        // console.log(datasplit);

        if (datasplit.includes("_dependencies_ok_")) {
            mainWindow.webContents.send("consolog", "dependencies ok");
            console.log("dependencies ok");
            // dependencies_ok = true;
        }

        if (datasplit.includes("_server_started_")) {
            mainWindow.webContents.send("consolog", "server started");
        }

        
        // if (dependencies_ok) {
            for (let i = 0; i < datasplit.length; i++) {
                if (!startJSON) {
                    startJSON = datasplit[i] == "RGUIstartJSON";
                }
                else {
                    if (datasplit[i] == "RGUIendJSON") {
                        startJSON = false;
                        response = JSON.parse(longresponse);
                        
                        mainWindow.webContents.send("consolog", longresponse);

                        if (response.error && response.error[0] != "") {
                            // dialog.showErrorBox("R says:", response.error[0]);
                            dialog.showMessageBox(mainWindow, {
                                type: "error",
                                title: "R says error:",
                                message: response.error[0]
                            }).then(() => {
                                mainWindow.webContents.send("clearLoader");
                            })
                        }
                        else {
                            if (response.variables && Object.keys(response.variables).length > 0) {
                                mainWindow.webContents.send("sendCommand-reply", response);
                            }
                            mainWindow.webContents.send("clearLoader");
                        }

                        longresponse = "";
                        break;
                    }

                    longresponse += datasplit[i];

                }
            }
    });
};
