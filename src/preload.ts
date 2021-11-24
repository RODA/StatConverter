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

// const variables = {
// 	timpliber: {
// 		label: "Prima variabila",
// 		values: {
// 			Da: 1,
// 			Nu: 2,
// 			"Nu stiu": -1,
// 		},
// 	},
// 	gender: {
// 		label: "A doua variabila",
// 		values: {
// 			M: 1,
// 			F: 2,
// 		},
// 	},
// 	timplucrat: {
// 		label: "A doua variabila",
// 		values: {
// 			Minute: 1,
// 			Ore: 2,
// 		},
// 	},
// };

window.addEventListener("DOMContentLoaded", () => {
	// const replaceText = (selector: string, text: string) => {
	//     const element = document.getElementById(selector)
	//     if (element) element.innerText = text
	// }

	// for (const type of ["chrome", "node", "electron"]) {
	//     replaceText(`${type}-version`, <any> process.versions[type as keyof NodeJS.ProcessVersions]);
	// }

	document.getElementById("gotoRODA")?.addEventListener("click", () => {
		ipcRenderer.send("gotoRODA");
	});

	let dataset = "dataset";
	let all_vars_selected = true;
	let variables: {
		[key: string]: {
			label: [string];
			values: { 
				[key: string]: [string]
			},
			missing: [string],
			selected: [boolean]
		}
	} = {};

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

		ipcRenderer.send("sendCommand", 'dataset <- DDIwR::convert("' + io.fileFrom + '", declared = TRUE)');

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

	startConvert.addEventListener("click", function () {
		const indices = [];
		let i = 1;
		for (const key in variables) {
			if (!variables[key].selected[0] && all_vars_selected) {
				indices.push(i);
			}
			
			if (variables[key].selected[0] && !all_vars_selected) {
				indices.push(i);
			}

			i += 1;
		}

		if (indices.length == 0 && !all_vars_selected) {
			//
		}
		else {
			dataset = "dataset";
			const subset = ""; // for case selection: document.getElementById("blah").value;
			let select = "";
			if (indices.length > 0) {
				select = (all_vars_selected ? "-" : "") + "c(" + helpers.paste(indices, {sep: ","}) + ")";
			}

			if (subset != "" || select != "") {
				dataset = "subset(" + dataset;
				if (subset != "") {
					dataset += ", subset = " + subset;
				}

				if (select != "") {
					dataset += ", select = " + select;
				}

				dataset += ")";
			}
			
			ipcRenderer.send("sendCommand", "DDIwR::convert(" + dataset + ', to = "' + inputOutput.fileTo + '", embed = TRUE)');
		}
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
	ipcRenderer.on("sendCommand-reply", (event, response) => {
		
		variables = response.variables;
		//load variable list
		const variablesList = document.getElementById("variables");
		all_vars_selected = true;

		for (const key in variables) {
			const formCheck = document.createElement("div");
			formCheck.classList.add("form-check");
			formCheck.style.marginLeft = "5px";
			formCheck.style.cursor = "pointer";

			const elInput = document.createElement("input");
			elInput.classList.add("form-check-input");
			elInput.type = "checkbox";
			elInput.checked = true;
			// TODO -- is this okay? are the variables unique?
			elInput.id = key;
			const elLabel = document.createElement("label");
			elLabel.classList.add("form-check-label");
			// elLabel.htmlFor = key;
			elLabel.innerHTML = key;
			formCheck.appendChild(elInput);
			formCheck.appendChild(elLabel);
			// console.log(formCheck);
			variablesList?.appendChild(formCheck);

			formCheck.addEventListener("click", () => {
				// console.log(formCheck.classList.contains("activeVariable"));

				if (formCheck.classList.contains("activeVariable")) {
					removeActive();
					(<HTMLDivElement>document.getElementById("variable-label")).innerHTML = "";
					(<HTMLDivElement>document.getElementById("value-labels")).innerHTML = "";
				} else {
					removeActive();
					formCheck.classList.add("activeVariable");

					const el = <HTMLInputElement>document.querySelector('.activeVariable input[type="checkbox"]');
					// console.log(formCheck);
					// console.log(variables[formCheck.id]);
					if (variables[el.id]) {
						(<HTMLDivElement>document.getElementById("variable-label")).innerHTML = variables[el.id].label[0];
						const vals = <HTMLDivElement>document.getElementById("value-labels");
						let valList = "";
						if (Object.keys(variables[el.id].values).length > 0) {
							for (const key in variables[el.id].values) {
								valList += '<div class="ms-2">' + key + " : " + variables[el.id].values[key] + "</div>";
							}
						}
						vals.innerHTML = valList;
					}
				}
			});

			elInput.addEventListener("click", () => {
				variables[key].selected[0] = elInput.checked;
			})
		}

		document.getElementById("select-all-variables")?.addEventListener("click", () => {
			Object.keys(variables).forEach((item) => {
				(<HTMLInputElement>document.getElementById(item)).checked = true;
				variables[item].selected[0] = true;
			});
			all_vars_selected = true;
		});

		document.getElementById("deselect-all-variables")?.addEventListener("click", () => {
			Object.keys(variables).forEach((item) => {
				(<HTMLInputElement>document.getElementById(item)).checked = false;
				variables[item].selected[0] = false;
			});
			all_vars_selected = false;
		});

		document.getElementById("keep-variables")?.addEventListener("click", () => {
			let f1 = "";
			document.getElementsByName("filterRadio").forEach((item) => {
				if ((<HTMLInputElement>item).checked) {
					f1 = (<HTMLInputElement>item).value;
				}
			});

			const f2 = (<HTMLInputElement>document.getElementById("filterInput")).value;

			// console.log(f1);
			// console.log(f2);
			filterVar(variables, f1, f2, true);
		});

		document.getElementById("drop-variables")?.addEventListener("click", () => {
			let f1 = "";
			document.getElementsByName("filterRadio").forEach((item) => {
				if ((<HTMLInputElement>item).checked) {
					f1 = (<HTMLInputElement>item).value;
				}
			});

			const f2 = (<HTMLInputElement>document.getElementById("filterInput")).value;

			// console.log(f1);
			// console.log(f2);
			filterVar(variables, f1, f2, false);
		});
	});
});

function removeActive() {
	document.querySelectorAll("#variables .form-check").forEach((item) => {
		item.classList.remove("activeVariable");
	});
}

function filterVar(
	variables: { [key: string]: { label: [string]; values: { [key: string]: [string] }, missing: [string], selected: [boolean] } },
	f1: string, f2: string, make: boolean
) {
	if (f2 == "") {
		alert("Text or pattern should be specified.");
	} else {
		console.log("working...");
		if (f1 == "1") {
			for (const key in variables) {
				if (key.indexOf(f2) != -1) {
					(<HTMLInputElement>document.getElementById(key)).checked = make;
					variables[key].selected[0] = make;
				}
			}
		} else {
			if (f2.indexOf("*") == -1) {
				alert("Pattern should include a star sign * at the beginning or at the end");
			} else {
				// check pattern
				// ends with
				if (f2.slice(0, 1) == "*") {
					const searchFor = f2.slice(-f2.length + 1);
					for (const key in variables) {
						if (key.slice(-searchFor.length) == searchFor) {
							(<HTMLInputElement>document.getElementById(key)).checked = make;
							variables[key].selected[0] = make;
						}
					}
				}
				// starts with
				if (f2.slice(-1) == "*") {
					const searchFor = f2.slice(0,-1);
					console.log(searchFor);
					for (const key in variables) {
						if (key.slice(0, searchFor.length) == searchFor) {
							(<HTMLInputElement>document.getElementById(key)).checked = make;
							variables[key].selected[0] = make;
						}
					}
				}
			}
		}
	}
}
