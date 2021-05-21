import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from "path";
import * as exec from "child_process";

let mainWindow: BrowserWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      }
    })
  
    mainWindow.loadFile(path.join(__dirname, "../index.html"))
  }
  
  app.whenReady().then(() => {
    createWindow()
  
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
  
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })


  let fileToConvert: string;
  let convertedFile: string;

  ipcMain.on('selectFile', (event, args) => {
   
    dialog.showOpenDialog(mainWindow, {
      
      title: 'Alege fisier',
      properties: ['openFile']
    
    }).then(result => {


      if(!result.canceled){

        fileToConvert = result.filePaths[0];
        
        const file = path.basename(fileToConvert, 'sav');
        const dir = path.dirname(fileToConvert);
        convertedFile = dir + '/' + file + 'dta';

        event.reply('selectFile-reply', { file1: fileToConvert, file2: convertedFile});
      }
    
    }).catch(err => {
      console.log(err)
    })
  });


  ipcMain.on('startConvert', (event, args) => {

      // run R command
      exec.exec('Rscript -e "DDIwR::convert(\''+fileToConvert+'\', to = \''+convertedFile+'\')"', (error, stdout, stderr) => {
        
        if (error) {
          console.error(`exec error: ${error}`);
          return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);


        dialog.showMessageBox(mainWindow, {
          title: 'Merge',
          message: 'S-a terminat conversia!'
        })


      });

      

  });