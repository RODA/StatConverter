import { ipcRenderer } from "electron";

window.addEventListener('DOMContentLoaded', () => {
    // const replaceText = (selector: string, text: string) => {
    //     const element = document.getElementById(selector)
    //     if (element) element.innerText = text
    // }

    // for (const type of ["chrome", "node", "electron"]) {
    //     replaceText(`${type}-version`, <any> process.versions[type as keyof NodeJS.ProcessVersions]);
    // }
    

    document.getElementById('selectFile')?.addEventListener('click', function(){

        ipcRenderer.send('selectFile');

        ipcRenderer.on('selectFile-reply', (event, args) => {
            
            
            // const fileName = args.fileName;

            console.log(args.file);
            
            const fileToConvert = <HTMLInputElement>document.getElementById('fileToConvert');
            const convertedFile = <HTMLInputElement>document.getElementById('convertedFile');
            
            fileToConvert.value = args.file1;
            convertedFile.value = args.file2;

        });

    });

    document.getElementById('runConvert')?.addEventListener('click', function(){
        ipcRenderer.send('startConvert');


        // ipcRenderer.on('selectFile-reply', (event, args) => {
            
        // })

    });

}) 