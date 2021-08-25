import { ipcRenderer } from "electron";

window.addEventListener('DOMContentLoaded', () => {
    // const replaceText = (selector: string, text: string) => {
    //     const element = document.getElementById(selector)
    //     if (element) element.innerText = text
    // }

    // for (const type of ["chrome", "node", "electron"]) {
    //     replaceText(`${type}-version`, <any> process.versions[type as keyof NodeJS.ProcessVersions]);
    // }
    

    ( <HTMLInputElement>document.getElementById('selectFileFrom')).addEventListener('click', function(){

        const inputType = <HTMLSelectElement>document.getElementById('inputType');
        const inputTypeValue = inputType.options[inputType.selectedIndex].value;

        ipcRenderer.send('selectFileFrom', { inputType: inputTypeValue });

        ipcRenderer.on('selectFileFrom-reply', (event, args) => {
            
            
            // const fileName = args.fileName;

            console.log(args);
            

            const fileFrom = <HTMLInputElement>document.getElementById('fileFrom');

            // const outputType = <HTMLSelectElement>document.getElementById('outputType');
            // const outputTypeValue = outputType.options[outputType.selectedIndex].value;
            const fileTo = <HTMLInputElement>document.getElementById('fileTo');
            
            fileFrom.value = args.file1;
            fileTo.value = args.file2;

        });

    });

    (<HTMLInputElement>document.getElementById('selectFileTo')).addEventListener('click', function(){

        const outputType = <HTMLSelectElement>document.getElementById('outputType');
        const outputTypeValue = outputType.options[outputType.selectedIndex].value;

        ipcRenderer.send('selectFileTo', { outputType: outputTypeValue });

        ipcRenderer.on('selectFileTo-reply', (event, args) => {
            
            console.log(args);
              
            const fileTo = <HTMLInputElement>document.getElementById('fileTo');
            fileTo.value = args.file;

            (<HTMLInputElement>document.getElementById('runConvert')).disabled = false;

        });

    });



    (<HTMLInputElement>document.getElementById('runConvert')).addEventListener('click', function(){
        
        const outputType = <HTMLSelectElement>document.getElementById('outputType');
        const outputTypeValue = outputType.options[outputType.selectedIndex].value;
        const fileTo = <HTMLInputElement>document.getElementById('fileTo');

        ipcRenderer.send('startConvert', {'to': outputTypeValue, 'file': fileTo.value});
        // ipcRenderer.on('selectFile-reply', (event, args) => {
            
        // })

    });

}) 