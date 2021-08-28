import { ipcRenderer } from "electron";
import * as path from "path";
import {helpers} from "./helpers";
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

    // for (const type of ["chrome", "node", "electron"]) {
    //     replaceText(`${type}-version`, <any> process.versions[type as keyof NodeJS.ProcessVersions]);
    // }
    
    const inputType = <HTMLSelectElement>document.getElementById('inputType');
    const outputType = <HTMLSelectElement>document.getElementById('outputType');
    const fileFrom = <HTMLInputElement>document.getElementById('fileFrom');
    const fileTo = <HTMLInputElement>document.getElementById('fileTo');
    const selectFileFrom = <HTMLInputElement>document.getElementById('selectFileFrom');
    const selectFileTo = <HTMLInputElement>document.getElementById('selectFileTo');
    const startConvert = <HTMLInputElement>document.getElementById('startConvert');

    selectFileFrom.addEventListener('click', function(){

        const inputType = <HTMLSelectElement>document.getElementById('inputType');
        const inputTypeValue = inputType.options[inputType.selectedIndex].value;

        ipcRenderer.send('selectFileFrom', { inputType: inputTypeValue });

        ipcRenderer.on('selectFileFrom-reply', (event, io) => {
            inputOutput.inputType = io.inputType;
            inputOutput.fileFrom = io.fileFrom;
            inputOutput.fileFromDir = io.fileFromDir;
            inputOutput.fileFromName = io.fileFromName;
            
            
            fileFrom.value = io.fileFrom;

            const outputTypeValue = outputType.options[outputType.selectedIndex].value;
            
            if (outputTypeValue != "Select file type") {
                const ext = helpers.getExtensionFromType(outputTypeValue);
                const fileTo = <HTMLInputElement>document.getElementById('fileTo');
                if (inputOutput.fileToDir == '') {
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
                ipcRenderer.send('showError', { message: message });
            }

        });

    });

    

    selectFileTo.addEventListener('click', function() {

        
        const outputTypeValue = outputType.options[outputType.selectedIndex].value;

        ipcRenderer.send('selectFileTo', { outputType: outputTypeValue });

        ipcRenderer.on('selectFileTo-reply', (event, io) => {

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
                ipcRenderer.send('showError', { message: message });
            }
        });
    });



    startConvert.addEventListener('click', function() {
        const message = helpers.validate(inputOutput);
        if (message != "ok") {
            ipcRenderer.send('startConvert', {
                'inputOutput': inputOutput
            });
        }
        else {
            // 
        }

    });

    inputType.addEventListener('change', function() {

        inputOutput.fileFrom = "";
        inputOutput.fileFromName = "";
        fileTo.value = "";
        const inputTypeValue = inputType.options[outputType.selectedIndex].value;
        inputOutput.inputType = inputTypeValue;

    });
    
    outputType.addEventListener('change', function() {
        
        const outputTypeValue = outputType.options[outputType.selectedIndex].value;
        // const selectFileToTooltip = document.getElementById('selectFileToTooltip')
        // const ftTooltip = new bootstrap.Tooltip(selectFileToTooltip, {
        //     boundary: document.body // or document.querySelector('#boundary')
        // })
        // if (outputTypeValue != 'Select file type') {
        //     selectFileTo.disabled = false;
        //     ftTooltip.disable();
        // } else {
        //     selectFileTo.disabled = true;
        //     ftTooltip.enable();
        // }
        
        
        inputOutput.outputType = outputTypeValue;
        if (inputOutput.fileToDir != "" && inputOutput.fileToName != "") {
            const ext = helpers.getExtensionFromType(outputTypeValue);
            inputOutput.fileTo = path.join(inputOutput.fileToDir, inputOutput.fileToName + ext);
            fileTo.value = inputOutput.fileTo;
        }

    });

    

}) 
