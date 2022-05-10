process.env.NODE_ENV = "development";
// process.env.NODE_ENV = 'production';

import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import * as path from "path";
import * as commandExec from "child_process";

import { InputOutputType } from "./interfaces";

import { helpers } from "./helpers";

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
let startlong = false; // start of a long burst of buffers

app.on("window-all-closed", () => {
	// if (RptyProcess) {
	// 	RptyProcess.kill();
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
		width: 1024,
		height: 700 + (process.platform == "win32" ? 10 : 0),
		maxWidth: 1024,
		maxHeight: 700,
		minWidth: 1024,
		minHeight: 700,
		backgroundColor: "#fff",
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
		},
	});

	mainWindow.loadFile(path.join(__dirname, "../index.html"));

	if (process.env.NODE_ENV === "production") {
		// mainWindow.removeMenu();
	}

	if (process.env.NODE_ENV === "development") {
		// Open the DevTools.
		mainWindow.webContents.openDevTools();
	}
}

app.whenReady().then(() => {
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});

    let R_path = "";

    if (process.platform == 'win32') {
		if (process.env.NODE_ENV == "production") {
            R_path = path.join(__dirname, '../../R_Portable/bin/R.exe');
		}
		else {
			R_path = path.join(__dirname, '../R_Portable/bin/R.exe');
		}
    }
    else {
        // check if R is installed
        let findR;

        try {
            // if (process.platform === "win32") {
            //     findR = commandExec.execSync("where.exe R", {
            //         shell: "cmd.exe",
            //         cwd: process.cwd(),
            //         env: process.env,
            //         encoding: "utf-8" as BufferEncoding,
            //     });
            // } else {
                findR = commandExec.execSync("which R", {
                    shell: "/bin/bash",
                    cwd: process.cwd(),
                    env: process.env,
                    encoding: "utf-8" as BufferEncoding,
                });
            // }
    
            R_path = findR.replace(/(\r\n|\n|\r)/gm, "");
    
        } catch (error) {
            dialog.showMessageBox(mainWindow, {
                type: "question",
                title: "Select R path",
                message: "Could not find R. Select the path to the binary?",
            })
            .then((response) => {
                if (response) {
                    dialog
                        .showOpenDialog(mainWindow, {
                            title: "R path",
                            properties: ["openFile"],
                        })
                        .then((result) => {

                            if(result.canceled){
                                app.quit();
                            }
                            
                            R_path = result.filePaths[0];

                            if (R_path != "") {
                                start_R(R_path);
                            }
                        });
                }
            });
        }
    }



	if (R_path != "") {
		start_R(R_path);
	}

	ipcMain.on("selectFileFrom", (event, args) => {
		if (args.inputType === "Select file type") {
			dialog.showErrorBox("Error", "Select input type");
		} else {
			const info = helpers.fileFromInfo(args.inputType);

			dialog
				.showOpenDialog(mainWindow, {
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
		Rprocess.stdin.write(command);
	});

	ipcMain.on("gotoRODA", () => {
		shell.openExternal("http://www.roda.ro");
	});

	ipcMain.on("declared", () => {
		shell.openExternal("https://cran.r-project.org/web/packages/declared/index.html");
	});
});

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

	Rprocess = commandExec.spawn(R_path, ["-q", "--no-save"]);

	let command = "";

    // make sure we use the R package library from R_Portable, otherwise
    // a different version of the code depending on using a locally installed R
    if (process.env.NODE_ENV == "production") {
        command = ".libPaths('" + path.join(__dirname, "../../R_Portable/library") + "')";
    }
    else {
        command = ".libPaths('" + path.join(__dirname, "../R_Portable/library") + "')";
    }

	if (process.platform === "win32") {
        command = command.replace(/\\/g, '/'); // replace backslash with forward slash
	}

	Rprocess.stdin.write(command + '\n');
    
	if (process.env.NODE_ENV == 'production') {
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
	
	Rprocess.stdout.on("data", (data: string) => {
        
        const datasplit = data.toString().split(/\r?\n/);
        // console.log(datasplit);
        for (let i = 0; i < datasplit.length; i++) {
            if (datasplit[i].charAt(0) == "{") {
                startlong = datasplit[i].slice(-1) != "}";
                longresponse = datasplit[i];
            }
            else if (startlong) {
                if (datasplit[i].slice(-1) == "}") {
                    startlong = false;
                }

                longresponse += datasplit[i];
            }

            // console.log(startlong, longresponse);

            if (!startlong && longresponse != "") {
                response = JSON.parse(longresponse);
                mainWindow.webContents.send("clearLoader");
                
                if (response.error && response.error[0] != "") {
                    dialog.showErrorBox("R says:", response.error[0]);
                }
                else if (response.variables && Object.keys(response.variables).length > 0) {
                    mainWindow.webContents.send("sendCommand-reply", response);
                }

                longresponse = "";
                break;
            }
        }
	});
};
