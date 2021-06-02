export default class rCommand {
  process: any;
  R: any;
  EventEmitter: any;
  closed = true;
  response: { message: string; type: string} = { message: '', type: ''};

  constructor(process: any, event: any){
    this.process = process;
    this.EventEmitter = event;
  }

  async executeCommand(command:string): Promise<any>
  {
    const dataFromR = new Promise( (resolve) => {
      this.startProcess();

      
      this.R.stdin.write(command+'\n');
      
      // resolve(true);

      this.EventEmitter.on('dataProcessed', () =>{
        // console.log(this.response);
        resolve(true)
      })

    });

    await dataFromR;

    return this.response;

  }
  startProcess(): void
  {
    if(this.closed){

      this.R = this.process('R', ['--save --slave --args']);

      // console.log(this.R);

      this.R.on('error', () => {
        const errorText = this.R.stderr;
        console.log('Fatal error :'+ JSON.stringify(errorText));

        throw new Error(errorText);
      });


      this.R.stdout.on('data', (data:string) => {
        this.processResponse(data, 'data');
      });
      this.R.stderr.on('data', (data:string) => {
        this.processResponse(data, 'error');
      });
      
      // // this.R.on('close', (code:string) => {
      // //   this.closed = true;
      // //   this.processResponse(code, 'closed');

      // // });
      // this.R.on('beforeExit', (code:string) => {
      //   console.log('Process beforeExit event with code: ', code);
      // });

      // process.on('SIGINT', function () {
      //   console.log('just ignore SIGINT');
      // });

      this.R.on('exit', (code:string) => {
        this.closed = true;
        this.processResponse(code, 'exit');

      });
      this.closed = false;

    }
  }

  processResponse(data:string, type:string): void
  {
    if(type === 'error' || type === 'data'){
      // console.log(type);
      // console.log(data.toString());
      this.response = {
        message : data.toString(),
        type: type
      }
      // console.log(this.response);

    } else if(type == 'closed' || type == 'exit'){
      console.log('prosses exit ' + type);
    }

    this.EventEmitter.emit('dataProcessed');
  }

}