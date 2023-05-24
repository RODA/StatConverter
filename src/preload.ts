import { ipcRenderer } from 'electron';
import * as path from 'path';
import { helpers } from './helpers';
import { InputOutputType } from './interfaces';

const inputOutput: InputOutputType = {
    inputType: '',
    fileFrom: '',
    fileFromDir: '',
    fileFromName: '',

    outputType: '',
    fileTo: '',
    fileToDir: '',
    fileToName: '',
};

window.addEventListener('DOMContentLoaded', () => {
    // const replaceText = (selector: string, text: string) => {
    //     const element = document.getElementById(selector)
    //     if (element) element.innerText = text
    // }

    // for (const type of ['chrome', 'node', 'electron']) {
    //     replaceText(`${type}-version`, <any> process.versions[type as keyof NodeJS.ProcessVersions]);
    // }

    document.getElementById('declared')?.addEventListener('click', () => {
        ipcRenderer.send('declared');
    });

    document.getElementById('gotoRODA')?.addEventListener('click', () => {
        ipcRenderer.send('gotoRODA');
    });

    ipcRenderer.on('startLoader', () => {
        // console.log('start loader');

        document.body.classList.add('stop-scrolling');
        (<HTMLDivElement>document.getElementById('loader')).classList.remove('d-none');
        (<HTMLDivElement>document.getElementById('cover')).classList.remove('d-none');
    });

    ipcRenderer.on('clearLoader', () => {
        // console.log('clear loader');
        document.body.classList.remove('stop-scrolling');
        (<HTMLDivElement>document.getElementById('loader')).classList.add('d-none');
        (<HTMLDivElement>document.getElementById('cover')).classList.add('d-none');
    });

    // ipcRenderer.send('sendCommand', 'require(DDIwR)');

    let all_vars_selected = true;
    let variables: {
        [key: string]: {
            label: [string];
            values: {
                [key: string]: [string];
            };
            missing: [string];
            selected: [boolean];
        }
    } = {};

    const inputType = <HTMLSelectElement>document.getElementById('inputType');
    const fileEncoding = <HTMLSelectElement>document.getElementById('fileEncoding');
    const outputType = <HTMLSelectElement>document.getElementById('outputType');
    const fileFrom = <HTMLInputElement>document.getElementById('fileFrom');
    const fileTo = <HTMLInputElement>document.getElementById('fileTo');
    const selectFileFrom = <HTMLInputElement>document.getElementById('selectFileFrom');
    const selectFileTo = <HTMLInputElement>document.getElementById('selectFileTo');
    const startConvert = <HTMLInputElement>document.getElementById('startConvert');

    selectFileFrom.addEventListener('click', function () {
        const loader = document.getElementById('loader') as HTMLDivElement;
        loader.innerHTML = "Reading...";
        const inputType = <HTMLSelectElement>document.getElementById('inputType');
        const inputTypeValue = inputType.options[inputType.selectedIndex].value;

        ipcRenderer.send('selectFileFrom', { inputType: inputTypeValue });
    });

    ipcRenderer.on('selectFileFrom-reply', (event, io) => {
        inputOutput.inputType = io.inputType;
        inputOutput.fileFrom = io.fileFrom;
        inputOutput.fileFromDir = io.fileFromDir;
        inputOutput.fileFromName = io.fileFromName;

        let command = "RGUI_parseCommand(\"dataset <- convert('" + io.fileFrom + "', declared = FALSE, n_max = 10";
        if (fileEncoding.value != 'utf8') {
            if (fileEncoding.value == "default") {
                command += ", encoding = NULL";
            }
            else {
                command += ", encoding = '" + fileEncoding.value + "'";
            }
        }

        const recodeFALSE = document.getElementById('recodeFALSE') as HTMLInputElement;
        if (recodeFALSE.checked) {
            command += ', recode = FALSE';
        }

        command += ")\")\n";

        // ipcRenderer.send('sendCommand', 'require(DDIwR)');
        console.log(command);
        ipcRenderer.send('sendCommand', command.replace(/\\/g, '/'));

        fileFrom.value = io.fileFrom;

        const outputTypeValue = outputType.options[outputType.selectedIndex].value;

        // if (inputOutput.fileToDir == '') {
            inputOutput.fileToDir = io.fileFromDir;
        // }
        
        if (outputTypeValue != 'none') {
            const ext = helpers.getExtensionFromType(outputTypeValue);
            const fileTo = <HTMLInputElement>document.getElementById('fileTo');

            fileTo.value = path.join(inputOutput.fileToDir, io.fileFromName + ext);
            inputOutput.outputType = outputTypeValue;
            inputOutput.fileTo = fileTo.value;
            inputOutput.fileToName = io.fileFromName;
        }

        const message = helpers.validate(inputOutput);

        if (message == 'Unsupported input type.') {
            inputType.selectedIndex = 0;
            ipcRenderer.send('showError', { message: message });
        }
        else {
            fileTo.dispatchEvent(new Event('change'));
        }
    });

    selectFileTo.addEventListener('click', function () {
        const outputTypeValue = outputType.options[outputType.selectedIndex].value;
        ipcRenderer.send('selectFileTo', { outputType: outputTypeValue });
    });

    ipcRenderer.on('selectFileTo-reply', (event, io) => {
        inputOutput.outputType = io.outputType;
        inputOutput.fileTo = io.fileTo;
        inputOutput.fileToDir = io.fileToDir;
        inputOutput.fileToName = io.fileToName;

        fileTo.value = io.fileTo;

        const message = helpers.validate(inputOutput);

        if (message == 'Unsupported output type.') {
            outputType.selectedIndex = 0;
            inputOutput.outputType = '';
            outputType.dispatchEvent(new Event('change'));
            ipcRenderer.send('showError', { message: message });
        }

        fileTo.dispatchEvent(new Event('change'));
    });

    startConvert.addEventListener('click', function () {
        const loader = document.getElementById('loader') as HTMLDivElement;
        loader.innerHTML = "Converting...";
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
            ipcRenderer.send('showError', { message: 'At least one variable has to be selected.' });
        } else {
            


            
            let command = "RGUI_parseCommand(\"convert('" + inputOutput.fileFrom + "', to = '" + inputOutput.fileTo + "'";

            const declaredTRUE = document.getElementById("declaredTRUE") as HTMLInputElement;
            command += ", declared = " + ((inputOutput.outputType == "r" && declaredTRUE.checked) ? "TRUE" : "FALSE");


            // recode is by default TRUE, for instance from Stata to SPSS this is mandatory
            // const from_extended = inputOutput.inputType == "stata" || inputOutput.inputType == "sas";
            // const to_normal = inputOutput.outputType == "spss" || inputOutput.outputType == "ddi";
            const recodeFALSE = document.getElementById("recodeFALSE") as HTMLInputElement;
            if (recodeFALSE.checked) {
                command += ", recode = FALSE";
            }

            const chartonum = document.getElementById("chartonumTRUE") as HTMLInputElement;
            if (chartonum.checked) {
                command += ", chartonum = TRUE";
            }

            const targetOS = document.getElementById('targetOS') as HTMLInputElement;
            if (targetOS.value != 'local') {
                command += ", OS = '" + targetOS.value + "'";
            }

            const fileEncoding = document.getElementById('fileEncoding') as HTMLInputElement;
            if (fileEncoding.value != 'utf8') {
                if (fileEncoding.value == "default") {
                    command += ", encoding = NULL";
                }
                else {
                    command += ", encoding = '" + fileEncoding.value + "'";
                }
            }

            const select_cases = document.getElementById('select_cases') as HTMLInputElement;
            
            let select = "";
            if (indices.length > 0) {
                select = (all_vars_selected ? "-" : "") + "c(" + helpers.paste(indices, { sep: "," }) + ")";
            }

            
            
            let subset = "";
            if (select_cases.value != "" || select != "") {
                
                if (select_cases.value != "") {
                    subset += select_cases.value;
                }
                
                const keep = document.getElementById('keepSelectionCases') as HTMLInputElement;
                if (!keep.checked) {
                    select_cases.value = "";
                }
            }

            if (select != "") {
                subset += (subset == "" ? "" : ", ") + "select = " + select;
            }
            
            if (subset != "") {
                command += ", subset = '" + subset + "'";
            }

            const embed = document.getElementById('embedFALSE') as HTMLInputElement;
            if (embed.checked) {
                command += ", embed = FALSE";
            }

            if (inputOutput.outputType == "stata") {
                const stataVersion = document.getElementById('stataVersion') as HTMLInputElement;
                if (stataVersion.value != "14") {
                    command += ", version = " + stataVersion.value;
                }
            }

            if (inputOutput.outputType == "xpt") {
                const xptVersion = document.getElementById('xptVersion') as HTMLInputElement;
                if (xptVersion.value != "8") {
                    command += ", version = " + xptVersion.value;
                }
            }

            const agency = document.getElementById('agency') as HTMLInputElement;
            if (agency.value != "default") {
                command += ", agency = '" + agency.value + "'";
            }

            const xmlang = document.getElementById('xmlang') as HTMLInputElement;
            if (xmlang.value != 'en') {
                command += ", xmlang = '" + xmlang.value + "'";
            }

            const xmlns = document.getElementById('xmlns') as HTMLInputElement;
            if (xmlns.value != '') {
                command += ", xmlns = '" + xmlns.value + "'";
            }

            const monolang = document.getElementById('monolang') as HTMLInputElement;
            if (monolang.checked) {
                command += ", monolang = TRUE"
            }
            
            const IDNo = document.getElementById('IDNo') as HTMLInputElement;
            if (IDNo.value != 'S0000') {
                command += ", IDNo = '" + IDNo.value + "'";
            }
            
            const URI = document.getElementById('URI') as HTMLInputElement;
            if (URI.value != 'http://www.default.eu') {
                command += ", URI = '" + URI.value + "'";
            }

            command += ")\")\n";

            ipcRenderer.send('sendCommand', command.replace(/\\/g, '/'));
        }
    });

    fileEncoding.addEventListener('change', function () {
        if (inputOutput.fileFrom != '') {
            let command = "RGUI_parseCommand(\"dataset <- convert('" + inputOutput.fileFrom + "', declared = FALSE, n_max = 10";
            if (fileEncoding.value != 'utf8') {
                if (fileEncoding.value == "default") {
                    command += ", encoding = NULL";
                }
                else {
                    command += ", encoding = '" + fileEncoding.value + "'";
                }
            }

            command += ")\")\n";
            ipcRenderer.send('sendCommand', command.replace(/\\/g, '/'));
            
        }
    });

    inputType.addEventListener('change', function () {
        inputOutput.fileFrom = '';
        inputOutput.fileFromName = '';
        fileTo.value = '';
        const inputTypeValue = inputType.options[outputType.selectedIndex].value;
        inputOutput.inputType = inputTypeValue;
    });

    outputType.addEventListener('change', function () {
        
        const outputTypeValue = outputType.options[outputType.selectedIndex].value;
        inputOutput.outputType = outputTypeValue;
        const ext = helpers.getExtensionFromType(outputTypeValue);

        if (inputOutput.fileToDir == '' && inputOutput.fileFromDir != '') {
            inputOutput.fileToDir = inputOutput.fileFromDir;
        }

        if (inputOutput.fileToName == '' && inputOutput.fileFromName != '') {
            inputOutput.fileToName = inputOutput.fileFromName;
        }

        if (inputOutput.fileToDir != '' && inputOutput.fileToName != '') {
            inputOutput.fileTo = path.join(inputOutput.fileToDir, inputOutput.fileToName + ext);

            if (process.platform == 'win32') {
                inputOutput.fileTo = inputOutput.fileTo.replace(/\\/g, '/');
                inputOutput.fileToDir = inputOutput.fileToDir.replace(/\\/g, '/');
            }

            fileTo.value = inputOutput.fileTo;
            fileTo.dispatchEvent(new Event('change'));
        }
    });

    // =================================================
    // ================= Variables =====================
    ipcRenderer.on('sendCommand-reply', (event, response) => {
        variables = response.variables;
        // console.log(response);
        //load variable list
        const variablesList = document.getElementById('variables') as HTMLElement;
        const variablesListCases = document.getElementById('variablesCases') as HTMLElement;
        const varlabel = document.getElementById('variable-label') as HTMLElement;
        const vallabels = document.getElementById('value-labels') as HTMLElement;
        variablesList.innerHTML = '';
        variablesListCases.innerHTML = '';
        varlabel.innerHTML = '';
        vallabels.innerHTML = '';
        
        all_vars_selected = true;

        for (const key in variables) {
            const formCheck = document.createElement('div');
            formCheck.classList.add('form-check');
            formCheck.style.marginLeft = '5px';
            formCheck.style.cursor = 'pointer';
            formCheck.id = 'div-' + key;

            const elInput = document.createElement('input');
            elInput.classList.add('form-check-input');
            elInput.type = 'checkbox';
            elInput.checked = true;
            // TODO -- is this okay? are the variables unique?
            elInput.id = key;
            const elLabel = document.createElement('label');
            elLabel.classList.add('form-check-label');
            // elLabel.htmlFor = key;
            elLabel.innerHTML = key;
            formCheck.appendChild(elInput);
            formCheck.appendChild(elLabel);
            // console.log(formCheck);
            variablesList?.appendChild(formCheck);

            formCheck.addEventListener('click', () => {
                // console.log(formCheck.classList.contains('activeVariable'));

                if (formCheck.classList.contains('activeVariable')) {
                    removeActive();
                    (<HTMLDivElement>document.getElementById('variable-label')).innerHTML = '';
                    (<HTMLDivElement>document.getElementById('value-labels')).innerHTML = '';
                } else {
                    removeActive();
                    formCheck.classList.add('activeVariable');

                    const el = <HTMLInputElement>document.querySelector('.activeVariable input[type="checkbox"]');
                    // console.log(formCheck);
                    // console.log(variables[formCheck.id]);
                    if (variables[el.id] && variables[el.id].label[0]) {
                        (<HTMLDivElement>document.getElementById('variable-label')).innerHTML = variables[el.id].label[0];
                        const vals = <HTMLDivElement>document.getElementById('value-labels');
                        let valList = '';
                        if (Object.keys(variables[el.id].values).length > 0) {
                            for (const key in variables[el.id].values) {
                                valList += '<div class="ms-2">' + key + ' : ' + variables[el.id].values[key] + '</div>';
                            }
                        }
                        vals.innerHTML = valList;
                    }
                }
            });

            elInput.addEventListener('click', () => {
                variables[key].selected[0] = elInput.checked;
            });

            const caseVar = document.createElement('div');
            caseVar.classList.add('caseVar');
            caseVar.style.paddingLeft = '10px';
            caseVar.style.cursor = 'pointer';
            caseVar.innerHTML = key;
            caseVar.dataset.id = key;
            caseVar.id = 'case-' + key;
            variablesListCases?.appendChild(caseVar);
            caseVar.addEventListener('dblclick', (e) => {
                // console.log((<HTMLDivElement>e.target).getAttribute('data-id'));
                const key = (<HTMLDivElement>e.target).getAttribute('data-id');
                if (key) {
                    // added space after name/key
                    insertAtPosition('select_cases', key + ' ');
                }
            });
        }

        // Search for variables
        (<HTMLInputElement>document.getElementById('varsearch')).addEventListener('keyup', debounce(varSearchF.bind(this, variables), 750));

        // Search for variables in cases
        (<HTMLInputElement>document.getElementById('varSearchCases')).addEventListener('keyup', debounce(varSearchCasesF.bind(this, variables), 750));

        document.getElementById('select-all-variables')?.addEventListener('click', () => {
            Object.keys(variables).forEach((item) => {
                (<HTMLInputElement>document.getElementById(item)).checked = true;
                variables[item].selected[0] = true;
            });
            all_vars_selected = true;
        });

        document.getElementById('deselect-all-variables')?.addEventListener('click', () => {
            Object.keys(variables).forEach((item) => {
                (<HTMLInputElement>document.getElementById(item)).checked = false;
                variables[item].selected[0] = false;
            });
            all_vars_selected = false;
        });

        document.getElementById('keep-variables')?.addEventListener('click', () => {
            let f1 = '';
            document.getElementsByName('filterRadio').forEach((item) => {
                if ((<HTMLInputElement>item).checked) {
                    f1 = (<HTMLInputElement>item).value;
                }
            });

            const f2 = (<HTMLInputElement>document.getElementById('filterInput')).value;

            // console.log(f1);
            // console.log(f2);
            filterVar(variables, f1, f2, true);
        });

        document.getElementById('drop-variables')?.addEventListener('click', () => {
            let f1 = '';
            document.getElementsByName('filterRadio').forEach((item) => {
                if ((<HTMLInputElement>item).checked) {
                    f1 = (<HTMLInputElement>item).value;
                }
            });

            const f2 = (<HTMLInputElement>document.getElementById('filterInput')).value;

            // console.log(f1);
            // console.log(f2);
            filterVar(variables, f1, f2, false);
        });
    });
});

function removeActive() {
    document.querySelectorAll('#variables .form-check').forEach((item) => {
        item.classList.remove('activeVariable');
    });
}

type variablesType = { [key: string]: { label: [string]; values: { [key: string]: [string] }; missing: [string]; selected: [boolean] } };

function filterVar(variables: variablesType, f1: string, f2: string, make: boolean) {
    if (f2 == '') {
        alert('Text or pattern should be specified.');
    } else {
        // console.log('working...');
        if (f1 == '1') {
            for (const key in variables) {
                if (key.indexOf(f2) != -1) {
                    (<HTMLInputElement>document.getElementById(key)).checked = make;
                    variables[key].selected[0] = make;
                }
            }
        } else {
            if (f2.indexOf('*') == -1) {
                alert('Pattern should include a star sign * at the beginning or at the end');
            } else {
                // check pattern
                // ends with
                if (f2.slice(0, 1) == '*') {
                    const searchFor = f2.slice(-f2.length + 1);
                    for (const key in variables) {
                        if (key.slice(-searchFor.length) == searchFor) {
                            (<HTMLInputElement>document.getElementById(key)).checked = make;
                            variables[key].selected[0] = make;
                        }
                    }
                }
                // starts with
                if (f2.slice(-1) == '*') {
                    const searchFor = f2.slice(0, -1);
                    // console.log(searchFor);
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

function varSearchF(variables: variablesType): void {
    const value = (<HTMLInputElement>document.getElementById('varsearch')).value;
    if (value != '') {
        for (const key in variables) {
            if (key.indexOf(value) == -1) {
                (<HTMLInputElement>document.getElementById('div-' + key)).style.display = 'none';
            } else {
                (<HTMLInputElement>document.getElementById('div-' + key)).style.display = 'block';
            }
        }
    } else {
        for (const key in variables) {
            (<HTMLInputElement>document.getElementById('div-' + key)).style.display = 'block';
        }
    }
}
function varSearchCasesF(variables: variablesType): void {
    const value = (<HTMLInputElement>document.getElementById('varSearchCases')).value;
    if (value != '') {
        for (const key in variables) {
            if (key.indexOf(value) == -1) {
                (<HTMLInputElement>document.getElementById('case-' + key)).style.display = 'none';
            } else {
                (<HTMLInputElement>document.getElementById('case-' + key)).style.display = 'block';
            }
        }
    } else {
        for (const key in variables) {
            (<HTMLInputElement>document.getElementById('case-' + key)).style.display = 'block';
        }
    }
}

function debounce(callback: () => void, delay: number) {
    let timeout: NodeJS.Timeout;
    return function () {
        clearTimeout(timeout);
        timeout = setTimeout(callback, delay);
    };
}
// insert element at the position
// https://stackoverflow.com/questions/1064089/inserting-a-text-where-cursor-is-using-javascript-jquery
function insertAtPosition(areaId: string, text: string) {
    const txtarea = <HTMLTextAreaElement>document.getElementById(areaId);

    // console.log(areaId);
    // console.log(text);

    if (!txtarea) {
        return;
    }

    // console.log('aici');
    

    // console.log('gasit');
    // console.log(text);

    const scrollPos = txtarea.scrollTop;
    let strPos = 0;
    strPos = txtarea.selectionStart;

    if (txtarea.value) {
        const front = txtarea.value.substring(0, strPos);
        const back = txtarea.value.substring(strPos, txtarea.value.length);
        txtarea.value = front + text + back;
        strPos = strPos + text.length;
    } else {
        txtarea.value = text;
    }

    txtarea.scrollTop = scrollPos;
}
