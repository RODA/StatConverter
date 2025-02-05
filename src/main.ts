
// https://r-wasm.github.io/rwasm/articles/mount-fs-image.html
// https://docs.r-wasm.org/webr/latest/

// ./node_modules/.bin/electron-builder install-app-deps --arch arm64
// ./node_modules/.bin/electron-builder install-app-deps --arch x64


// Setting ENVIROMENT
process.env.NODE_ENV = 'development';
// process.env.NODE_ENV = 'production';

const production = process.env.NODE_ENV === 'production';
const development = process.env.NODE_ENV === 'development';
const OS_Windows = process.platform == 'win32';

import { app, BrowserWindow, ipcMain, dialog, shell, Menu, session } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as webr from "webr";
import * as interfaces from './library/interfaces';
import { util } from "./library/helpers";


const webR = new webr.WebR({ interactive: false });
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
        await webR.init();

        // mount a virtual filesystem containing contributed R packages
        const data =  new Blob([
            fs.readFileSync(
                path.join(__dirname, '../src/library/R/library.data')
            )
        ]);

        const metadata = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '../src/library/R/library.js.metadata'),
                'utf-8'
            )
        );

        const options = {
            packages: [{
                blob: data,
                metadata: metadata,
            }]
        };

        await webR.FS.mkdir('/my-library');
        await webR.FS.mount(
            "WORKERFS",
            options,
            '/my-library'
        );

        await webR.evalR(`.libPaths(c(.libPaths(), "/my-library"))`);
        await webR.evalR(`library(DDIwR)`);
    } catch (error) {
        throw error;
    }
}

// Create the main browser window
function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        title: 'StatConverter',
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            sandbox: false
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
});


app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});


app.on("window-all-closed", () => {
    app.quit();
});


ipcMain.on('showMessage', (event, args) => {
    dialog.showMessageBox(mainWindow, {
        type: args.type,
        title: args.title,
        message: args.message,
    })
});

ipcMain.on('showError', (event, message) => {
    dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "Error",
        message: message
    });
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
            // if (!result.canceled) {
            if (!result.canceled) {
                inputOutput.fileFrom = result.filePaths[0];

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

                mount({ what: inputOutput.fileFromDir, where: "/input" }).then(() => {
                    mainWindow.webContents.send("selectFileFrom-reply", inputOutput);
                });
            }
        });

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


// Handle the command request
ipcMain.on("sendCommand", async (event, args) => {
    const command = args.command;
    mainWindow.webContents.send("startLoader");

    let output_dir_writable = true;
    if (!util.isTrue(args.updateVariables)) {
        try {
            await webR.evalR(`write.csv(data.frame(A = 1:2), "/output/test.csv")`);
            await webR.evalR(`unlink("/output/test.csv")`);
        } catch (error) {
            output_dir_writable = false;
        }
    }

    if (util.isFalse(args.updateVariables) && util.isFalse(output_dir_writable)) {
        dialog.showMessageBox(mainWindow, {
            type: "error",
            title: "Error",
            message:"The target directory has writing constraints. Try saving into a different one."
        });
    } else {

        try {
            await webR.evalR(command);
        } catch (error) {
            console.log(error);
            throw error;
        }

        if (util.isTrue(args.updateVariables)) {
            // consolog("main: updating variables");
            try {
                const result = await webR.evalR(`as.character(jsonlite::toJSON(lapply(
                    collectRMetadata(dataset),
                    function(x) {
                        values <- names(x$labels)
                        names(values) <- x$labels
                        x$values <- as.list(values)
                        return(x)
                    }
                )))`);

                if (!webr.isRCharacter(result)) throw new Error('Not a character!');

                const response = await result.toString();
                webR.destroy(result);
                mainWindow.webContents.send("updateVariables", JSON.parse(response));

            } catch (error) {
                console.log(error);
                throw error;
            }
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
