/*
    Copyright (c) 2021-2025, Adrian Dusa
    All rights reserved.

    License: Academic Non-Commercial License (see LICENSE file for details).
    SPDX-License-Identifier: LicenseRef-ANCL-AdrianDusa
*/
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

export interface CommandArgs {
    command: string;
    variables: boolean;
}

export interface MountArgs {
    what: string;
    where: string;
}
