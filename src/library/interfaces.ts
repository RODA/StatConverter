export interface InputOutputType {
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

export interface FileFromInfoType {
    ext: string[];
    fileTypeName: string;
}

export interface VariablesType {
    [key: string]: {
        label: [string];
        values: {
            [key: string]: [string]
        };
        missing: [string];
        selected: [boolean];
    }
}

