process.env.NODE_ENV = "development";
// process.env.NODE_ENV = 'production';

if (require('electron-squirrel-startup')) {
	app.quit();
}

import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import * as path from "path";
import * as commandExec from "child_process";
import * as pty from "node-pty";
import WebSocket from "ws";

import { InputOutputType } from "./interfaces";

import { helpers } from "./helpers";

let mainWindow: BrowserWindow;
let Rws: WebSocket;

let RptyProcess: pty.IPty;

app.on("window-all-closed", () => {
	if (RptyProcess) {
		RptyProcess.kill();
	}
	
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
		width: 1024,
		height: 700,
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
		mainWindow.removeMenu();
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

	// check if R is installed
	let R_path = "";
	let findR;
	
	try {
		if (process.platform === "win32") {
			findR = commandExec.execSync("where.exe R", {
				shell: "cmd.exe",
				cwd: process.cwd(),
				env: process.env,
				encoding: "utf-8" as BufferEncoding,
			});
		} else {
			findR = commandExec.execSync("which R", {
				shell: "/bin/bash",
				cwd: process.cwd(),
				env: process.env,
				encoding: "utf-8" as BufferEncoding,
			});
		}

		R_path = findR.replace(/(\r\n|\n|\r)/gm, "");

	} catch (error) {
		dialog
			.showMessageBox(mainWindow, {
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
								start_R_server(R_path);
							}
						});
				}
			});
	}

	if (R_path != "") {
		start_R_server(R_path);
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

						console.log(inputOutput.fileTo);
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
		Rws.send(command);
	});

	ipcMain.on("gotoRODA", () => {
		shell.openExternal("http://www.roda.ro");
	});
});

// let Rprocess: commandExec.ChildProcessWithoutNullStreams;

// const pause = async function(x: number): Promise<boolean> {
//   const sleepNow = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
//   await sleepNow(x);
//   return(true)
// }

const start_R_server = function (R_path: string): void {
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let penv: any;
	// eslint-disable-next-line prefer-const
	penv = process.env;

	if (process.platform === "win32") {
		if (penv.HOME && !(penv.HOME.includes("Documents"))) {
			penv.HOME = penv.HOME + '\\Documents';
		}
	}
	else {
		penv.test = "test";
	}

	RptyProcess = pty.spawn(R_path, ["-q", "--no-save"], {
		env: penv
	});

	let command = 'source("' + path.join(__dirname, "../src/") + 'startServer.R")';
	if (process.platform === "win32") {
		command = command.replace(/\\/g, '/'); // replace backslash with forward slash
	}
	
	command += '\n';
	
	RptyProcess.write(command);

	RptyProcess.onData((data) => {
		
		const datanoe = data.replace(/(\r\n|\n|\r)/gm, "");
		
		if (datanoe.includes("_server_started_")) {
			// console.log("server started");
			// TODO -- check if there is no error on that port
			Rws = new WebSocket("ws://127.0.0.1:12345");

			// Rws.on('open', function open() {
			//     Rws.send('(aa <- 2 + 2)');
			//     Rws.send('bb <- aa + 4');
			//     Rws.send('ls()');
			// });

			Rws.addEventListener("message", function (e) {
				mainWindow.webContents.send("clearLoader");
				
				const response = JSON.parse(e.data);
				if (response.error && response.error[0] != "") {
					dialog.showErrorBox("R says:", response.error[0]);
				} else if (response.variables) {
					mainWindow.webContents.send("sendCommand-reply", response);
				}
			});
		}
	});
};
