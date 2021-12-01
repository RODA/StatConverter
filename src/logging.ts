/**
 * Copyright (c) 2020
 *
 * MIT license
 *
 * @summary log messages to file
 * @author Emilian Adrian Hossu (emil.hossu@gmail.com)
 *
 * Created at     : 2020-05-21 12:46:59
 * Last modified  : 2020-06-30 17:25:22
 */

import * as fs from "fs";
import * as path from "path";

const today = new Date();

export const logging = {
	theFile: "log-" + today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate() + ".log",
	path: path.normalize(__dirname + "/../"),

	info: function (message: string, file?: string): void {
		if (file) {
			logging.theFile = file;
		}
		logging.writeToFile("INFO (" + today.toLocaleDateString() + " " + String(new Date().getHours()).padStart(2, "0") + ":" + String(new Date().getMinutes()).padStart(2, "0") + ":" + String(new Date().getSeconds()).padStart(2, "0") + "): " + JSON.stringify(message) + "\r\n");
	},

	warning: function (message: string, file?: string): void {
		if (file) {
			logging.theFile = file;
		}
		logging.writeToFile("WARNING (" + today.toLocaleDateString() + " " + String(new Date().getHours()).padStart(2, "0") + ":" + String(new Date().getMinutes()).padStart(2, "0") + ":" + String(new Date().getSeconds()).padStart(2, "0") + "): " + JSON.stringify(message) + "\r\n");
	},

	error: function (message: string, file?: string): void {
		if (file) {
			logging.theFile = file;
		}
		logging.writeToFile("ERROR (" + today.toLocaleDateString() + " " + String(new Date().getHours()).padStart(2, "0") + ":" + String(new Date().getMinutes()).padStart(2, "0") + ":" + String(new Date().getSeconds()).padStart(2, "0") + "): " + JSON.stringify(message) + "\r\n");
	},

	setPath: function (appPath: string, override: boolean): void {
		if (logging.path === null) {
			logging.path = appPath + "/";
		} else if (override !== void 0) {
			logging.path = appPath + "/";
		}
	},

	writeToFile: function (data: string): void {
		if (process.env.NODE_ENV !== "development") {
			logging.theFile = path.join(logging.path+ "/../../../../") + logging.theFile;
		} else {
			logging.theFile = path.normalize(logging.path + logging.theFile);
		}

		fs.writeFile(
			logging.theFile,
			data,
			{
				encoding: "utf8",
				flag: "a+",
			},
			function writingLog(err) {
				if (err) {
					throw err;
				}
			},
		);
	},
};
