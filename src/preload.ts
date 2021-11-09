import { ipcRenderer } from "electron";
import * as path from "path";
import { helpers } from "./helpers";
import { InputOutputType } from "./interfaces";

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

const variabile = {
	timpliber: {
		label: "Prima variabila",
		values: {
			Da: 1,
			Nu: 2,
			"Nu stiu": -1,
		},
	},
	gender: {
		label: "A doua variabila",
		values: {
			M: 1,
			F: 2,
		},
	},
	timplucrat: {
		label: "A doua variabila",
		values: {
			Minute: 1,
			Ore: 2,
		},
	},
};

window.addEventListener("DOMContentLoaded", () => {
	// const replaceText = (selector: string, text: string) => {
	//     const element = document.getElementById(selector)
	//     if (element) element.innerText = text
	// }

	// for (const type of ["chrome", "node", "electron"]) {
	//     replaceText(`${type}-version`, <any> process.versions[type as keyof NodeJS.ProcessVersions]);
	// }

	document.getElementById("gotoRODA")?.addEventListener("click", ()=> {
		ipcRenderer.send("gotoRODA");
	});

	// TODO: change <const> to <let> when it will be used to subset data
	const subset = "xyz";

	const inputType = <HTMLSelectElement>document.getElementById("inputType");
	const outputType = <HTMLSelectElement>document.getElementById("outputType");
	const fileFrom = <HTMLInputElement>document.getElementById("fileFrom");
	const fileTo = <HTMLInputElement>document.getElementById("fileTo");
	const selectFileFrom = <HTMLInputElement>document.getElementById("selectFileFrom");
	const selectFileTo = <HTMLInputElement>document.getElementById("selectFileTo");
	const startConvert = <HTMLInputElement>document.getElementById("startConvert");

	selectFileFrom.addEventListener("click", function () {
		const inputType = <HTMLSelectElement>document.getElementById("inputType");
		const inputTypeValue = inputType.options[inputType.selectedIndex].value;

		ipcRenderer.send("selectFileFrom", { inputType: inputTypeValue });
	});

	ipcRenderer.on("selectFileFrom-reply", (event, io) => {
		inputOutput.inputType = io.inputType;
		inputOutput.fileFrom = io.fileFrom;
		inputOutput.fileFromDir = io.fileFromDir;
		inputOutput.fileFromName = io.fileFromName;

		ipcRenderer.send("sendCommand", 'xyz <- DDIwR::convert("' + io.fileFrom + '", declared = TRUE)');

		fileFrom.value = io.fileFrom;

		const outputTypeValue = outputType.options[outputType.selectedIndex].value;

		if (outputTypeValue != "none") {
			const ext = helpers.getExtensionFromType(outputTypeValue);
			const fileTo = <HTMLInputElement>document.getElementById("fileTo");
			if (inputOutput.fileToDir == "") {
				inputOutput.fileToDir = io.fileFromDir;
			}

			fileTo.value = path.join(inputOutput.fileToDir, io.fileFromName + ext);
			inputOutput.outputType = outputTypeValue;
			inputOutput.fileTo = fileTo.value;
			inputOutput.fileToName = io.fileFromName;
		}

		const message = helpers.validate(inputOutput);

		if (message == "Unsupported input type.") {
			inputType.selectedIndex = 0;
			ipcRenderer.send("showError", { message: message });
		}
	});

	selectFileTo.addEventListener("click", function () {
		const outputTypeValue = outputType.options[outputType.selectedIndex].value;
		ipcRenderer.send("selectFileTo", { outputType: outputTypeValue });
	});

	ipcRenderer.on("selectFileTo-reply", (event, io) => {
		inputOutput.outputType = io.outputType;
		inputOutput.fileTo = io.fileTo;
		inputOutput.fileToDir = io.fileToDir;
		inputOutput.fileToName = io.fileToName;

		fileTo.value = io.fileTo;

		const message = helpers.validate(inputOutput);

		if (message == "Unsupported output type.") {
			outputType.selectedIndex = 0;
			inputOutput.outputType = "";
			outputType.dispatchEvent(new Event("change"));
			ipcRenderer.send("showError", { message: message });
		}

		fileTo.dispatchEvent(new Event("change"));
	});

	ipcRenderer.on("sendCommand-reply", (event, data) => {
		console.log(data);
	});

	startConvert.addEventListener("click", function () {
		ipcRenderer.send("sendCommand", "DDIwR::convert(" + subset + ', to = "' + inputOutput.fileTo + '", embed = TRUE)');
	});

	inputType.addEventListener("change", function () {
		inputOutput.fileFrom = "";
		inputOutput.fileFromName = "";
		fileTo.value = "";
		const inputTypeValue = inputType.options[outputType.selectedIndex].value;
		inputOutput.inputType = inputTypeValue;
	});

	outputType.addEventListener("change", function () {
		const outputTypeValue = outputType.options[outputType.selectedIndex].value;
		inputOutput.outputType = outputTypeValue;
		const ext = helpers.getExtensionFromType(outputTypeValue);

		if (inputOutput.fileToDir == "" && inputOutput.fileFromDir != "") {
			inputOutput.fileToDir = inputOutput.fileFromDir;
		}

		if (inputOutput.fileToName == "" && inputOutput.fileFromName != "") {
			inputOutput.fileToName = inputOutput.fileFromName;
		}

		if (inputOutput.fileToDir != "" && inputOutput.fileToName != "") {
			inputOutput.fileTo = path.join(inputOutput.fileToDir, inputOutput.fileToName + ext);
			fileTo.value = inputOutput.fileTo;
			fileTo.dispatchEvent(new Event("change"));
		}
	});

	// =================================================
	// ================= Variables =====================

	//load variable list
	const variablesList = document.getElementById("variables");
	for (const key in variabile) {
		const formCheck = document.createElement("div");
		formCheck.classList.add("form-check");
		formCheck.style.marginLeft = "5px";
		formCheck.style.cursor = "pointer";

		const elInput = document.createElement("input");
		elInput.classList.add("form-check-input");
		elInput.type = "checkbox";
		// TODO -- is this okay? are the variables unique?
		elInput.id = key;
		const elLabel = document.createElement("label");
		elLabel.classList.add("form-check-label");
		elLabel.htmlFor = key;
		elLabel.innerHTML = key;
		formCheck.appendChild(elInput);
		formCheck.appendChild(elLabel);
		// console.log(formCheck);
		variablesList?.appendChild(formCheck);

		formCheck.addEventListener("click", () => {
            console.log(formCheck.classList.contains("activeVariable"));
            
			if (formCheck.classList.contains("activeVariable")) {
                removeActive();
			} else {
				removeActive();
				formCheck.classList.add("activeVariable");
			}
		});
	}

	document.getElementById("select-all-variables")?.addEventListener("click", () => {
		Object.keys(variabile).forEach((item) => {
			(<HTMLInputElement>document.getElementById(item)).checked = true;
		});
	});
	document.getElementById("deselect-all-variables")?.addEventListener("click", () => {
		Object.keys(variabile).forEach((item) => {
			(<HTMLInputElement>document.getElementById(item)).checked = false;
		});
	});
});

function removeActive() {
	document.querySelectorAll("#variables .form-check").forEach((item) => {
		item.classList.remove("activeVariable");
	});
}
