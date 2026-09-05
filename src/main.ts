/*
    Copyright (c) 2021-2026, Adrian Dusa
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
import { evalRString, initEmbeddedR, shutdownEmbeddedR } from "./modules/backend/embeddedR";

// Environment detection: prefer app.isPackaged at runtime; fall back to NODE_ENV for dev tooling
const production = app.isPackaged || process.env.NODE_ENV === 'production';
const development = !production;
const OS_Windows = process.platform == 'win32';
let mainWindow: BrowserWindow;
let autoUpdaterInstance: import("electron-updater").AppUpdater | null = null;
let backendShutdownStarted = false;

// Unpackaged runs would otherwise take the lowercase package name, which shows
// up in the menu roles as "Quit statconverter".
app.setName("StatConverter");

type AppUpdateMode = "available" | "downloading" | "downloaded" | "hidden";

interface AppUpdateState {
    mode: AppUpdateMode;
    percent: number;
    version: string;
}

const APP_UPDATE_STATE_CHANNEL = "app-update-state";
const APP_UPDATE_ACTION_CHANNEL = "app-update-action";
const UPDATE_FEED_URL = "https://github.com/RODA/StatConverter/releases/download/latest";
const UPDATE_CHANNEL = process.arch === "arm64" ? "latest-arm64" : "latest-x64";

function shutdownBackend() {
    if (backendShutdownStarted) {
        return;
    }

    backendShutdownStarted = true;
    try { shutdownEmbeddedR(); } catch {}
}

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
    autoUpdaterInstance.autoDownload = false;
    autoUpdaterInstance.autoInstallOnAppQuit = false;
    autoUpdaterInstance.channel = UPDATE_CHANNEL;
    autoUpdaterInstance.setFeedURL({ provider: "generic", url: UPDATE_FEED_URL });

    let availableInfo: import("electron-updater").UpdateInfo | null = null;
    let available = false;
    let downloading = false;
    let downloaded = false;
    let installRequested = false;

    const sendUpdateState = (state: AppUpdateState) => {
        if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
            return;
        }
        mainWindow.webContents.send(APP_UPDATE_STATE_CHANNEL, state);
    };

    const formatVersion = (info: import("electron-updater").UpdateInfo | null): string => {
        return String(info?.version || "").trim();
    };

    const clearProgress = () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setProgressBar(-1);
        }
    };

    const hideUpdate = () => {
        available = false;
        downloading = false;
        clearProgress();
        sendUpdateState({ mode: "hidden", percent: 0, version: "" });
    };

    const isMissingUpdateMetadataError = (error: unknown): boolean => {
        const message = String(
            error instanceof Error ? `${error.name} ${error.message}` : error || ""
        ).toLowerCase();
        const referencesMetadata = message.includes("latest.yml")
            || message.includes("-mac.yml")
            || message.includes("latest-linux.yml")
            || message.includes("app-update.yml")
            || message.includes("channel file");
        const isMissing = message.includes("status 404")
            || message.includes(" 404")
            || message.includes("not found")
            || message.includes("enoent")
            || message.includes("cannot find channel");
        return referencesMetadata && isMissing;
    };

    autoUpdaterInstance.on("update-available", (info) => {
        availableInfo = info;
        available = true;
        downloading = false;
        downloaded = false;
        sendUpdateState({ mode: "available", percent: 0, version: formatVersion(info) });
    });

    autoUpdaterInstance.on("update-not-available", hideUpdate);

    autoUpdaterInstance.on("download-progress", (progress) => {
        const percent = Math.max(0, Math.min(100, progress.percent || 0));
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setProgressBar(percent / 100);
        }
        sendUpdateState({
            mode: "downloading",
            percent,
            version: formatVersion(availableInfo)
        });
    });

    autoUpdaterInstance.on("update-downloaded", (info) => {
        availableInfo = info;
        available = false;
        downloading = false;
        downloaded = true;
        clearProgress();
        sendUpdateState({ mode: "downloaded", percent: 100, version: formatVersion(info) });
    });

    autoUpdaterInstance.on("error", (error) => {
        const userWasWaiting = downloading || installRequested;
        installRequested = false;

        if (isMissingUpdateMetadataError(error)) {
            hideUpdate();
            return;
        }

        if (downloading && availableInfo) {
            available = true;
            downloading = false;
            clearProgress();
            sendUpdateState({
                mode: "available",
                percent: 0,
                version: formatVersion(availableInfo)
            });
        } else if (downloaded) {
            sendUpdateState({
                mode: "downloaded",
                percent: 100,
                version: formatVersion(availableInfo)
            });
        } else {
            hideUpdate();
        }

        if (userWasWaiting) {
            dialog.showMessageBox(mainWindow, {
                type: "error",
                title: "Update Failed",
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });

    ipcMain.on(APP_UPDATE_ACTION_CHANNEL, () => {
        if (!autoUpdaterInstance) {
            return;
        }

        if (downloaded) {
            if (installRequested) {
                return;
            }
            installRequested = true;
            autoUpdaterInstance.quitAndInstall(false, true);
            return;
        }

        if (!available || downloading || !availableInfo) {
            return;
        }

        available = false;
        downloading = true;
        sendUpdateState({
            mode: "downloading",
            percent: 0,
            version: formatVersion(availableInfo)
        });
        void autoUpdaterInstance.downloadUpdate().catch(() => {
            // electron-updater emits the corresponding error event, which restores the offer.
        });
    });

    void autoUpdaterInstance.checkForUpdates().catch((error) => {
        if (!isMissingUpdateMetadataError(error)) {
            console.error("Failed to check for updates:", error);
        }
    });
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
    }

}

function buildApplicationMenu() {
    // Windows and Linux have no menu bar at all.
    if (process.platform !== "darwin") {
        Menu.setApplicationMenu(null);
        return;
    }

    // macOS always shows a menu bar, so the default one is replaced with the
    // smallest menu that still behaves like a Mac application: the application
    // menu with Quit, and About.
    //
    // The clipboard and undo shortcuts are routed through the menu by macOS, so
    // the roles have to exist for Cmd+C, Cmd+V and friends to keep working in
    // the text fields. They are hidden; the accelerators still fire, because
    // acceleratorWorksWhenHidden defaults to true on macOS.
    const hiddenEditRoles: Electron.MenuItemConstructorOptions[] = ([
        "undo", "redo", "cut", "copy", "paste", "selectAll"
    ] as const).map((role) => ({ role, visible: false }));

    // In development the reload and DevTools shortcuts stay available the same
    // way: registered, never shown.
    const hiddenDevRoles: Electron.MenuItemConstructorOptions[] = development
        ? ([ "reload", "forceReload", "toggleDevTools" ] as const)
            .map((role) => ({ role, visible: false }))
        : [];

    Menu.setApplicationMenu(Menu.buildFromTemplate([
        {
            label: app.name,
            submenu: [
                { role: "quit" },
                ...hiddenEditRoles,
                ...hiddenDevRoles
            ]
        },
        {
            label: "About",
            submenu: [
                { role: "about", label: "Application" }
            ]
        }
    ]));
}

app.whenReady().then(() => {
    buildApplicationMenu();
    createWindow();
    initEmbeddedR().catch((error: Error) => {
        dialog.showMessageBox(mainWindow, {
            type: "error",
            title: "Error",
            message: error.message || "Failed to initialize the embedded R runtime."
        });
    });

    if (production) {
        mainWindow.webContents.once("did-finish-load", initializeAutoUpdater);
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

app.on("window-all-closed", () => {
    app.quit();
});

app.on("before-quit", shutdownBackend);
app.on("will-quit", shutdownBackend);
app.on("quit", shutdownBackend);
process.once("exit", shutdownBackend);
process.once("SIGINT", () => {
    shutdownBackend();
    setTimeout(() => process.exit(130), 1600);
});
process.once("SIGTERM", () => {
    shutdownBackend();
    setTimeout(() => process.exit(143), 1600);
});
