/*
    Copyright (c) 2021-2025, Adrian Dusa
    All rights reserved.

    License: Academic Non-Commercial License (see LICENSE file for details).
    SPDX-License-Identifier: LicenseRef-ANCL-AdrianDusa
*/

// https://r-wasm.github.io/rwasm/articles/mount-fs-image.html
// https://docs.r-wasm.org/webr/latest/

// ./node_modules/.bin/electron-builder install-app-deps --arch arm64
// ./node_modules/.bin/electron-builder install-app-deps --arch x64

import { app, BrowserWindow, ipcMain, dialog, shell, Menu, session } from "electron";
import * as path from "path";
import * as fs from "fs";
import { WebR } from "webr";
import { ungzip } from "pako";
import * as interfaces from './library/interfaces';
import { util } from "./library/helpers"; // , debugLog
import { autoUpdater } from "electron-updater";

// Environment detection: prefer app.isPackaged at runtime; fall back to NODE_ENV for dev tooling
const production = app.isPackaged || process.env.NODE_ENV === 'production';
const development = !production;
const OS_Windows = process.platform == 'win32';


const webR = new WebR({ interactive: false });
let mainWindow: BrowserWindow;
// const root = production ? "../../" : "../";

async function mount(obj: interfaces.MountArgs) {

    try {
        await webR.FS.unmount(obj.where);
    } catch (error) {
        // consolog(obj.where + " directory is not mounted yet.");
        try {
            await webR.FS.mkdir(obj.where);
        } catch (error) {
            consolog("Failed to make " + obj.where);
            throw error;
        }
    }

    try {
        await webR.FS.mount(
            "NODEFS",
            { root: obj.what },
            obj.where
        );
    } catch (error) {
        consolog("Failed to mount " + obj.what + " to " + obj.where);
        throw error;
    }
}

async function initWebR() {
    try {
        // debugLog("initWebR start", production ? "prod" : "dev");
        await webR.init();

        const rAssetsPath = production
            ? path.join(process.resourcesPath, "library", "R")
            : path.join(__dirname, "../src/library/R");
        const rFile = (name: string) => path.join(rAssetsPath, name);

        const buffer = Buffer.from(ungzip(fs.readFileSync(rFile("library.data.gz"))));
        const data = new Blob([buffer]);

        const metadata = JSON.parse(
            fs.readFileSync(
                rFile("library.js.metadata"),
                "utf-8"
            )
        );

        const options = {
            packages: [{
                blob: data,
                metadata: metadata,
            }]
        };

        await webR.FS.mkdir("/my-library");
        await webR.FS.mount(
            "WORKERFS",
            options,
            "/my-library"
        );

        await webR.evalRVoid(`.libPaths(c(.libPaths(), "/my-library"))`);
        await webR.evalRVoid(`library(DDIwR)`);

        await mount({ what: rAssetsPath, where: "/app-r" });
        await webR.evalRVoid(`source("/app-r/utils.R")`);
        // debugLog("initWebR done");

    } catch (error) {
        // debugLog("initWebR error", String(error));
        throw error;
    }
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        title: 'StatConverter',
        webPreferences: {
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, "preload.js"),
        },
        autoHideMenuBar: true,
        width: 800,
        height: 550 + (OS_Windows ? 10 : 0),
        maxWidth: 800,
        maxHeight: 550,
        minWidth: 800,
        minHeight: 550,
        backgroundColor: "#fff",
        center: true
    });

    mainWindow.loadFile(path.join(__dirname, "../src/index.html"));

    // Open the DevTools.
    if (development) {
        mainWindow.webContents.openDevTools();
    } else {
        // Remove the default menu
        Menu.setApplicationMenu(null);
    }

}

app.whenReady().then(() => {
    createWindow();
    initWebR();

    if (production) {
        autoUpdater.checkForUpdatesAndNotify();
    }
});


ipcMain.on("outputType", (event, args) => {
    inputOutput.fileToExt = args.extension;
    if (inputOutput.fileFromDir != "" && inputOutput.fileToDir == "") {
        mount({ what: inputOutput.fileFromDir, where: "/output" });
    }
})

ipcMain.on("selectFileTo", (event, args) => {
    if (args.outputType === "Select file type") {
        dialog.showMessageBox(mainWindow, {
            type: "error",
            title: "Error",
            message: "Select output type"
        });
    } else {
        const ext = util.getExtensionFromType(args.outputType);

        dialog.showSaveDialog(mainWindow, {
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

                inputOutput.outputType = util.getTypeFromExtension(ext);
                inputOutput.fileToName = path.basename(inputOutput.fileTo, ext);
                inputOutput.fileToDir = path.dirname(inputOutput.fileTo);
                inputOutput.fileToExt = ext;

                if (OS_Windows) {
                    inputOutput.fileTo = inputOutput.fileTo.replace(/\\/g, '/');
                    inputOutput.fileToDir = inputOutput.fileToDir.replace(/\\/g, '/');
                }

                mount({ what: inputOutput.fileToDir, where: "/output" }).then(() => {
                    mainWindow.webContents.send("selectFileTo-reply", inputOutput);
                });
            }
        })
        .catch((err) => {
            consolog(err);
        });
    }
});


ipcMain.on("gotoRODA", () => {
    shell.openExternal("http://www.roda.ro");
});

ipcMain.on("declared", () => {
    shell.openExternal("https://cran.r-project.org/web/packages/declared/index.html");
});


ipcMain.on("selectFileFrom", (event, args) => {
    if (args.inputType === "Select file type") {
        dialog.showMessageBox(mainWindow, {
            type: "error",
            title: "Error",
            message: "Select input type"
        });
    } else {
        const info = util.fileFromInfo(args.inputType);
        // debugLog("selectFileFrom dialog", args.inputType);

        dialog.showOpenDialog(mainWindow, {
            title: "Select source file",
            filters: [
                {
                    name: info.fileTypeName,
                    extensions: info.ext,
                },
            ],
            properties: ["openFile"],
        }).then(async (result) => {
            if (!result.canceled) {
                inputOutput.fileFrom = result.filePaths[0];
                // debugLog("selectFileFrom chosen", inputOutput.fileFrom);

                const file = path.basename(inputOutput.fileFrom);
                const ext = path.extname(file);

                inputOutput.inputType = util.getTypeFromExtension(ext);
                inputOutput.fileFromName = path.basename(inputOutput.fileFrom, ext);
                inputOutput.fileFromDir = path.dirname(inputOutput.fileFrom);

                inputOutput.fileFromExt = ext;

                if (OS_Windows) {
                    inputOutput.fileFrom = inputOutput.fileFrom.replace(/\\/g, '/');
                    inputOutput.fileFromDir = inputOutput.fileFromDir.replace(/\\/g, '/');
                }

                mount(
                    {
                        what: inputOutput.fileFromDir,
                        where: "/input"
                    }
                ).then(() => {
                    // debugLog("selectFileFrom mounted", inputOutput.fileFromDir);
                    mainWindow.webContents.send("selectFileFrom-reply", inputOutput);
                });
            }
            else {
                // debugLog("selectFileFrom canceled");
            }
        });
    }
});


// Handle the command request
ipcMain.on("sendCommand", async (event, args) => {
    const command = args.command;
    mainWindow.webContents.send("startLoader");

    let output_dir_writable = true;
    if (!util.isTrue(args.updateVariables)) {
        try {
            await webR.evalRVoid(`write.csv(data.frame(A = 1:2), "/output/test.csv")`);
            await webR.evalRVoid(`unlink("/output/test.csv")`);
        } catch (error) {
            output_dir_writable = false;
        }
    }

    // TODO: a false updateVariables signals a save command: replace with a proper, explicit flag
    if (util.isFalse(args.updateVariables) && util.isFalse(output_dir_writable)) {
        dialog.showMessageBox(mainWindow, {
            type: "error",
            title: "Error",
            message:"The target directory has writing constraints. Try saving into a different one."
        });
    } else {
        // debugLog("sendCommand", command);

        const result = await webR.evalRString(`run_cmd(${JSON.stringify(command)}, return = FALSE)`);
        const parsed = JSON.parse(result);
        // debugLog("sendCommand parsed.ok", parsed.ok === true, "error", parsed.error ? parsed.error : "");
        // consolog(parsed);


        if (!parsed.ok && parsed.error) {
            dialog.showMessageBox(mainWindow, {
                type: "error",
                title: "Error",
                message: parsed.error
            });

            mainWindow.webContents.send("clearLoader");
            throw parsed.error;
        }

        if (util.isTrue(args.updateVariables)) {
            // consolog("main: updating variables");

            const result = await webR.evalRString(`run_cmd("dataset_metadata()")`);
            const parsed = JSON.parse(result);

            if (!parsed.ok && parsed.error) {
                dialog.showMessageBox(mainWindow, {
                    type: "error",
                    title: "Error",
                    message: parsed.error
                });

                mainWindow.webContents.send("clearLoader");
                throw parsed.error;
            }

            // mainWindow.webContents.send("consolog", parsed);
            mainWindow.webContents.send("updateVariables", parsed.result);
        }
    }

    mainWindow.webContents.send("clearLoader");
});

const inputOutput: interfaces.InputOutput = {
    inputType: "",
    fileFrom: "",
    fileFromDir: "",
    fileFromName: "",
    fileFromExt: "",

    outputType: "",
    fileTo: "",
    fileToDir: "",
    fileToName: "",
    fileToExt: ""
};


function consolog(x: any) {
    mainWindow.webContents.send("consolog", x);
}


function consoletrace(x: any) {
    mainWindow.webContents.send("consoletrace", x);
}


process.on('unhandledRejection', (error: Error, promise) => {
    consoletrace(error);
});

autoUpdater.on('update-available', () => {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: 'A new version is available. It will be downloaded in the background.',
    });
});

autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Restart', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update Ready',
        message: 'Update downloaded. Restart now to apply it?',
    }).then(result => {
        if (result.response === 0) autoUpdater.quitAndInstall();
    });
});
