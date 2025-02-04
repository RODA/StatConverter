export interface InputOutput {
    inputType: string;
    fileFrom: string;
    fileFromDir: string;
    fileFromName: string;
    fileFromExt: string;

    outputType: string;
    fileTo: string;
    fileToDir: string;
    fileToName: string;
    fileToExt: string;
}

export interface FileFromInfo {
    ext: string[];
    fileTypeName: string;
}

export interface Variables {
    [key: string]: {
        label: [string];
        values: {
            [key: string]: [string]
        };
        missing: [string];
        selected: [boolean];
    }
}

export interface ShowMessage {
    type: 'info' | 'error' | 'question' | 'warning';
    title: string;
    message: string;
}

export interface ValidationHelpers {
    valueInInterval: (value: number, interval: [min: number, max: number]) => boolean;
}

export interface ValidationMessage {
    [element: string]: {
        name: string;
        errors: string[];
    }
}


export interface ErrorTippy {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [element: string]: Array<any>
}