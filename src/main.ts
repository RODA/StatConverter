import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from "path";
import * as pty from "node-pty";


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


  import * as spawn from "child_process";
  // import * as exec from "child_process";
  import EventEmitter from 'events';
  import rCommand from './r-connection';


  const command = new rCommand(spawn.spawn, new EventEmitter());
  // let R: any;
  // let exit = true;
  
// console.log(process.env);


  // function startProces(){
  //   R = child.spawn('R', ['--quiet --no-save']);
  //   R.stdout.on('data', (data:string) => {
  //     console.log(`stdout: ${data}`);
  //   });
  
  
  //   R.stderr.on('data', (data:string) => {
  //     console.error(`stderr: ${data}`);
  //   });
    
  //   R.on('close', (code:string) => {
  //     exit = true;
  //     console.log(`child process exited with code ${code}`);
  //   });
  //   R.on('exit', (code:string) => {
  //     exit = true;
  //     console.log(`child process exiteeeed with code ${code}`);
  //   });

  //   exit = false;
  //   console.log('restarted');
    
  // } 
 
  const ptyProcess = pty.spawn('R', ['--no-save', '--slave'], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    
  });
  
  // ptyProcess.on('data', function(data) {
  //   console.log(typeof data);
  //   console.log(data);
  // });

  ptyProcess.onData( (aa) => {
    console.log(aa);
    
  })

  ptyProcess.

  // import * as fs from 'fs';

  // const out = fs.openSync('./out.log', 'a');
  // const err = fs.openSync('./out.log', 'a');
  
  // const subprocess = spawn.spawn('R', ['--no-save', '--slave'], {
  //   detached: true,
  //   stdio: [ 'pipe', out, err ]
  // });
  
  // subprocess.unref();


  ipcMain.on('startConvert', (event, args) => {

      // // run R command
      // exec.exec('Rscript -e "DDIwR::convert(\''+fileToConvert+'\', to = \''+convertedFile+'\')"', (error, stdout, stderr) => {
        
      //   if (error) {
      //     console.error(`exec error: ${error}`);
      //     return;
      //   }
      //   console.log(`stdout: ${stdout}`);
      //   console.error(`stderr: ${stderr}`);


      //   dialog.showMessageBox(mainWindow, {
      //     title: 'Merge',
      //     message: 'S-a terminat conversia!'
      //   })


      // });

      // console.log(args.aa);
    
      
      ptyProcess.write(args.aa+'\n');

      // subprocess.stdin?.write(args.aa+'\n');

      // TODO -- pass a stream and on data log??
      // WIP -- return a stream????
      // command.executeCommand(args.aa).then((response) => {
      //   console.log(response);
      // });

      
      // // const childProcess = require('child_process');

      // const result = (() => {
      //   const { stderr, stdout, status } = spawn.spawnSync('R', ['--no-save']);

      //   if (status !== 0) {
      //     const errorText = stderr.toString();
      //     console.log('Fatal error from <code>npm install</code>.');

      //     throw new Error(errorText);
      //   }
      //   return stdout.toString();




      // })();

      // if(exit){
      //   startProces();        
      // }

      // R.stdin.write(args.aa+'\n');
    
      // console.log('after');
      
  });


