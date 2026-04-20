/*
    Copyright (c) 2021-2025, Adrian Dusa
    All rights reserved.

    License: Academic Non-Commercial License (see LICENSE file for details).
    SPDX-License-Identifier: LicenseRef-ANCL-AdrianDusa
*/

// ./node_modules/.bin/electron-builder install-app-deps --arch arm64
// ./node_modules/.bin/electron-builder install-app-deps --arch x64

import { app, BrowserWindow, ipcMain, dialog, shell, Menu, session } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as interfaces from './library/interfaces';
import { util } from "./library/helpers"; // , debugLog
import { evalRString, initEmbeddedR } from "./modules/backend/embeddedR";

// Environment detection: prefer app.isPackaged at runtime; fall back to NODE_ENV for dev tooling
const production = app.isPackaged || process.env.NODE_ENV === 'production';
const development = !production;
const OS_Windows = process.platform == 'win32';
let mainWindow: BrowserWindow;
let autoUpdaterInstance: import("electron-updater").AppUpdater | null = null;

function normalizeSemverLike(version: string): string {
    const match = /^([0-9]+)\.([0-9]+)\.([0-9]+)(.*)$/.exec(version);

    if (!match) {
        return version;
    }

    const [, major, minor, patch, suffix] = match;
    return `${Number(major)}.${Number(minor)}.${Number(patch)}${suffix}`;
}

function initializeAutoUpdater() {
    const rawVersion = app.getVersion();
    const normalizedVersion = normalizeSemverLike(rawVersion);

    if (normalizedVersion !== rawVersion) {
        (app as Electron.App & { getVersion(): string }).getVersion = () => normalizedVersion;
    }

    const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
    autoUpdaterInstance = autoUpdater;

    autoUpdaterInstance.on('update-available', () => {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: 'A new version is available. It will be downloaded in the background.',
        });
    });

    autoUpdaterInstance.on('update-downloaded', () => {
        dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Restart', 'Later'],
            defaultId: 0,
            cancelId: 1,
            title: 'Update Ready',
            message: 'Update downloaded. Restart now to apply it?',
        }).then(result => {
            if (result.response === 0) {
                autoUpdaterInstance?.quitAndInstall();
            }
        });
    });

    autoUpdaterInstance.checkForUpdatesAndNotify();
}

function normalizePathForR(filePath: string): string {
    return (OS_Windows ? filePath.replace(/\\/g, "/") : filePath)
        .replace(/'/g, "\\'");
}

function replaceAllLiteral(input: string, search: string, replacement: string): string {
    return input.split(search).join(replacement);
}

function commandToHostPaths(command: string): string {
    let resolved = command;

    if (inputOutput.fileFrom) {
        const fileFromPath = normalizePathForR(inputOutput.fileFrom);
        const inputToken = `/input/${inputOutput.fileFromName}${inputOutput.fileFromExt}`;
        resolved = replaceAllLiteral(resolved, inputToken, fileFromPath);
    }

    if (inputOutput.fileTo) {
        const fileToPath = normalizePathForR(inputOutput.fileTo);
        const outputToken = `/output/${inputOutput.fileToName}${inputOutput.fileToExt}`;
        resolved = replaceAllLiteral(resolved, outputToken, fileToPath);
    }

    return resolved;
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
    initEmbeddedR().catch((error: Error) => {
        dialog.showMessageBox(mainWindow, {
            type: "error",
            title: "Error",
            message: error.message || "Failed to initialize the embedded R runtime."
        });
    });

    if (production) {
        initializeAutoUpdater();
    }
});


ipcMain.on("outputType", (event, args) => {
    inputOutput.fileToExt = args.extension;
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

                mainWindow.webContents.send("selectFileTo-reply", inputOutput);
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
                mainWindow.webContents.send("selectFileFrom-reply", inputOutput);
            }
            else {
                // debugLog("selectFileFrom canceled");
            }
        });
    }
});


// Handle the command request
ipcMain.on("sendCommand", async (event, args) => {
    if (args.io && typeof args.io === "object") {
        Object.assign(inputOutput, args.io);
    }

    const command = commandToHostPaths(args.command);
    mainWindow.webContents.send("startLoader");

    let output_dir_writable = true;
    if (!util.isTrue(args.updateVariables)) {
        try {
            if (!inputOutput.fileTo) {
                throw new Error("Missing output directory");
            }
            const outputDir = path.dirname(inputOutput.fileTo);
            const probeFile = path.join(outputDir, `.statconverter-write-test-${Date.now()}.tmp`);
            fs.writeFileSync(probeFile, "ok");
            fs.unlinkSync(probeFile);
        }
        catch (error) {
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

        const result = await evalRString(`run_cmd(${JSON.stringify(command)}, return = FALSE)`);
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

            const result = await evalRString(`run_cmd("dataset_metadata()")`);
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
