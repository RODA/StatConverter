export interface InputOutputType {
    inputType: string;
    fileFrom: string;
    fileFromDir: string;
    fileFromName: string;

    outputType: string;
    fileTo: string;
    fileToDir: string;
    fileToName: string;
}

export interface FileFromInfoType {
    ext: string[];
    fileTypeName: string;
}

export interface variablesType {
    [key: string]: {
        label: [string];
        values: {
            [key: string]: [string]
        };
        missing: [string];
        selected: [boolean];
    }
}
