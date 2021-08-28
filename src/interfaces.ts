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
