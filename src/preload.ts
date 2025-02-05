import { ipcRenderer } from 'electron';
import * as path from 'path';
import { util } from './library/helpers';
import * as interfaces from './library/interfaces';


const inputOutput: interfaces.InputOutput = {
    inputType: '',
    fileFrom: '',
    fileFromDir: '',
    fileFromName: '',
    fileFromExt: '',

    outputType: '',
    fileTo: '',
    fileToDir: '',
    fileToName: '',
    fileToExt: ''
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

    let all_vars_selected = true;
    const variables: interfaces.Variables = {};

    const inputType = util.selectElement('inputType');
    const fileEncoding = util.selectElement('fileEncoding');
    const outputType = util.selectElement('outputType');
    const fileFrom = util.htmlElement('fileFrom'); // as HTMLInputElement;
    const fileTo = util.htmlElement('fileTo');
    const selectFileFrom = util.htmlElement('selectFileFrom');
    const selectFileTo = util.htmlElement('selectFileTo');
    const startConvert = util.htmlElement('startConvert');
    const embedFALSE = util.htmlElement('embedFALSE');
    // const embedTRUE = util.htmlElement('embedTRUE');
    // const serializeTRUE = util.htmlElement('serializeTRUE');
    // const serializeFALSE = util.htmlElement('serializeFALSE');

    // embedTRUE.addEventListener('click', function () {
    //     serializeTRUE.disabled = false;
    //     serializeFALSE.disabled = false;
    // });

    // embedFALSE.addEventListener('click', function () {
    //     serializeTRUE.disabled = true;
    //     serializeFALSE.disabled = true;
    // });

    selectFileFrom.addEventListener('click', function () {
        const loader = util.htmlElement('loader');
        loader.innerHTML = "Reading...";
        const inputType = util.selectElement('inputType');
        const inputTypeValue = inputType.options[inputType.selectedIndex].value;

        ipcRenderer.send(
            'selectFileFrom', { inputType: inputTypeValue }
        )
    });

    ipcRenderer.on('selectFileFrom-reply', (event, io) => {
        inputOutput.inputType = io.inputType;
        inputOutput.fileFrom = io.fileFrom;
        inputOutput.fileFromDir = io.fileFromDir;
        inputOutput.fileFromName = io.fileFromName;
        inputOutput.fileFromExt = io.fileFromExt;

        let command = "dataset <- convert('/host/" + io.fileFromName + io.fileFromExt + "', declared = FALSE, n_max = 10";
        if (fileEncoding.value != 'utf8') {
            if (fileEncoding.value == "default") {
                command += ", encoding = NULL";
            }
            else {
                command += ", encoding = '" + fileEncoding.value + "'";
            }
        }

        const recodeFALSE = util.htmlElement('recodeFALSE');
        if (recodeFALSE.checked) {
            command += ', recode = FALSE';
        }

        command += ")";
        console.log("preload116: ", command);

        ipcRenderer.send('sendCommand', {
            command: command.replace(/\\/g, '/'),
            updateVariables: true
        });

        fileFrom.value = io.fileFrom;

        const outputTypeValue = outputType.options[outputType.selectedIndex].value;

        // if (inputOutput.fileToDir == '') {
            inputOutput.fileToDir = io.fileFromDir;
        // }

        if (outputTypeValue != 'none') {
            const ext = util.getExtensionFromType(outputTypeValue);
            const fileTo = util.htmlElement('fileTo');

            fileTo.value = path.join(inputOutput.fileToDir, io.fileFromName + ext);
            inputOutput.outputType = outputTypeValue;
            inputOutput.fileTo = fileTo.value;
            inputOutput.fileToName = io.fileFromName;
        }

        const message = util.validate(inputOutput);

        if (message == 'Unsupported input type.') {
            inputType.selectedIndex = 0;
            ipcRenderer.send('showError', message);
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
        inputOutput.fileToExt = io.fileToExt;

        fileTo.value = io.fileTo;

        const message = util.validate(inputOutput);

        if (message == 'Unsupported output type.') {
            outputType.selectedIndex = 0;
            inputOutput.outputType = '';
            outputType.dispatchEvent(new Event('change'));
            ipcRenderer.send('showError', message);
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
            ipcRenderer.send('showError', 'At least one variable has to be selected.');
        } else {
            let command = "convert('/host/" + inputOutput.fileFromName + inputOutput.fileFromExt + "', to = '/host/" + inputOutput.fileToName + inputOutput.fileToExt + "'";
            // let command = "convert('" + inputOutput.fileFrom + "', to = '" + inputOutput.fileTo + "'";

            const declaredTRUE = util.htmlElement("declaredTRUE");
            command += ", declared = " + ((inputOutput.outputType == "r" && declaredTRUE.checked) ? "TRUE" : "FALSE");


            // recode is by default TRUE, for instance from Stata to SPSS this is mandatory
            // const from_extended = inputOutput.inputType == "stata" || inputOutput.inputType == "sas";
            // const to_normal = inputOutput.outputType == "spss" || inputOutput.outputType == "ddi";
            const recodeFALSE = util.htmlElement("recodeFALSE");
            if (recodeFALSE.checked) {
                command += ", recode = FALSE";
            }

            const chartonum = util.htmlElement("chartonumTRUE");
            if (chartonum.checked) {
                command += ", chartonum = TRUE";
            }

            const targetOS = util.htmlElement('targetOS');
            if (targetOS.value != 'local') {
                command += ", OS = '" + targetOS.value + "'";
            }

            const fileEncoding = util.htmlElement('fileEncoding');
            if (fileEncoding.value != 'utf8') {
                if (fileEncoding.value == "default") {
                    command += ", encoding = NULL";
                }
                else {
                    command += ", encoding = '" + fileEncoding.value + "'";
                }
            }

            const select_cases = util.htmlElement('select_cases');

            let select = "";
            if (indices.length > 0) {
                select = (all_vars_selected ? "-" : "") + "c(" + util.paste(indices, { sep: "," }) + ")";
            }



            let subset = "";
            if (select_cases.value != "" || select != "") {

                if (select_cases.value != "") {
                    subset += select_cases.value;
                }

                const keep = util.htmlElement('keepSelectionCases');
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

            if (embedFALSE.checked) {
                command += ", embed = FALSE";
            }

            // if (embedTRUE.checked && serializeTRUE.checked) {
            //     command += ", serialize = TRUE";
            // }

            if (inputOutput.outputType == "stata") {
                const stataVersion = util.htmlElement('stataVersion');
                if (stataVersion.value != "14") {
                    command += ", version = " + stataVersion.value;
                }
            }

            if (inputOutput.outputType == "xpt") {
                const xptVersion = util.htmlElement('xptVersion');
                if (xptVersion.value != "8") {
                    command += ", version = " + xptVersion.value;
                }
            }

            const agency = util.htmlElement('agency');
            if (agency.value != "") {
                command += ", agency = '" + agency.value + "'";
            }

            const xmlang = util.htmlElement('xmlang');
            if (xmlang.value != "") {
                command += ", xmlang = '" + xmlang.value + "'";
            }

            const monolang = util.htmlElement('monolang');
            if (!monolang.checked) {
                command += ", monolang = FALSE"
            }

            const IDNo = util.htmlElement('IDNo');
            if (IDNo.value != "") {
                command += ", IDNo = '" + IDNo.value + "'";
            }

            const URI = util.htmlElement('URI');
            if (URI.value != "") {
                command += ", URI = '" + URI.value + "'";
            }

            command += ")";

            ipcRenderer.send('sendCommand', {
                command: command.replace(/\\/g, '/'),
                updateVariables: false
            });
        }
    });

    fileEncoding.addEventListener('change', function () {
        if (inputOutput.fileFrom != '') {
            let command = "dataset <- convert('" + inputOutput.fileFrom + "', declared = FALSE, n_max = 10";
            if (fileEncoding.value != 'utf8') {
                if (fileEncoding.value == "default") {
                    command += ", encoding = NULL";
                }
                else {
                    command += ", encoding = '" + fileEncoding.value + "'";
                }
            }

            command += ")";
            ipcRenderer.send('sendCommand', {
                command: command.replace(/\\/g, '/'),
                updateVariables: true
            });
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
        const ext = util.getExtensionFromType(outputTypeValue);
        inputOutput.fileToExt = ext;

        ipcRenderer.send('outputType', { extension: ext });

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
    ipcRenderer.on('updateVariables', (event, variables) => {
        // console.log(variables);
        //load variable list
        const variablesList = util.htmlElement('variables');
        const variablesListCases = util.htmlElement('variablesCases');
        const varlabel = util.htmlElement('variable-label');
        const vallabels = util.htmlElement('value-labels');
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

                if (formCheck.classList.contains('activeVariable')) {
                    removeActive();
                    (util.htmlElement('variable-label')).innerHTML = '';
                    (util.htmlElement('value-labels')).innerHTML = '';
                } else {
                    removeActive();
                    formCheck.classList.add('activeVariable');

                    const el = <HTMLInputElement>document.querySelector('.activeVariable input[type="checkbox"]');
                    if (variables[el.id] && variables[el.id].label[0]) {
                        (util.htmlElement('variable-label')).innerHTML = util.replaceUnicode(variables[el.id].label)[0];
                        const vals = util.htmlElement('value-labels');
                        let valList = '';
                        if (Object.keys(variables[el.id].values).length > 0) {
                            for (const key in variables[el.id].values) {
                                valList += '<div class="ms-2">' + key + ' : ' + util.replaceUnicode(variables[el.id].values[key]) + '</div>';
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
        (util.htmlElement('varsearch')).addEventListener('keyup', debounce(varSearchF.bind(this, variables), 750));

        // Search for variables in cases
        (util.htmlElement('varSearchCases')).addEventListener('keyup', debounce(varSearchCasesF.bind(this, variables), 750));

        document.getElementById('select-all-variables')?.addEventListener('click', () => {
            Object.keys(variables).forEach((item) => {
                (util.htmlElement(item)).checked = true;
                variables[item].selected[0] = true;
            });
            all_vars_selected = true;
        });

        document.getElementById('deselect-all-variables')?.addEventListener('click', () => {
            Object.keys(variables).forEach((item) => {
                (util.htmlElement(item)).checked = false;
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

            const f2 = (util.htmlElement('filterInput')).value;

            filterVar(variables, f1, f2, true);
        });

        document.getElementById('drop-variables')?.addEventListener('click', () => {
            let f1 = '';
            document.getElementsByName('filterRadio').forEach((item) => {
                if ((<HTMLInputElement>item).checked) {
                    f1 = (<HTMLInputElement>item).value;
                }
            });

            const f2 = (util.htmlElement('filterInput')).value;

            filterVar(variables, f1, f2, false);
        });
    });
});


function removeActive() {
    document.querySelectorAll('#variables .form-check').forEach((item) => {
        item.classList.remove('activeVariable');
    });
}

function filterVar(variables: interfaces.Variables, f1: string, f2: string, make: boolean) {
    if (f2 == '') {
        alert('Text or pattern should be specified.');
    } else {
        // console.log('working...');
        if (f1 == '1') {
            for (const key in variables) {
                if (key.indexOf(f2) != -1) {
                    (util.htmlElement(key)).checked = make;
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
                            (util.htmlElement(key)).checked = make;
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
                            (util.htmlElement(key)).checked = make;
                            variables[key].selected[0] = make;
                        }
                    }
                }
            }
        }
    }
}

function varSearchF(variables: interfaces.Variables): void {
    const value = (util.htmlElement('varsearch')).value;
    if (value != '') {
        for (const key in variables) {
            if (key.indexOf(value) == -1) {
                (util.htmlElement('div-' + key)).style.display = 'none';
            } else {
                (util.htmlElement('div-' + key)).style.display = 'block';
            }
        }
    } else {
        for (const key in variables) {
            (util.htmlElement('div-' + key)).style.display = 'block';
        }
    }
}

function varSearchCasesF(variables: interfaces.Variables): void {
    const value = (util.htmlElement('varSearchCases')).value;
    if (value != '') {
        for (const key in variables) {
            if (key.indexOf(value) == -1) {
                (util.htmlElement('case-' + key)).style.display = 'none';
            } else {
                (util.htmlElement('case-' + key)).style.display = 'block';
            }
        }
    } else {
        for (const key in variables) {
            (util.htmlElement('case-' + key)).style.display = 'block';
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

    if (!txtarea) {
        return;
    }

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


ipcRenderer.on('consolog', (event, object: any) => {
    console.log(object);
});

ipcRenderer.on('consoletrace', (event, object: any) => {
    console.trace(object);
});
