/*
    Copyright (c) 2021-2025, Adrian Dusa
    All rights reserved.

    License: Academic Non-Commercial License (see LICENSE file for details).
    SPDX-License-Identifier: LicenseRef-ANCL-AdrianDusa
*/
import tippy from "tippy.js";
import { orderBy } from "lodash";
import * as path from "path";
import * as interfaces from "./interfaces";


interface UtilHelpersInterface {
    getKeys(obj: Record<string, unknown>): Array<string>;
    isNumeric: (x: string) => boolean;
    possibleNumeric: (x: string) => boolean;
    isInteger: (x: number) => boolean;
    asNumeric(x: string): number;
    asInteger(x: string): number;
    isTrue: (x: unknown) => boolean;
    isFalse: (x: unknown) => boolean;
    isNull: (x: unknown) => boolean;
    isElementOf<T>(x: T, set: T[]): boolean;
    isNotElementOf<T>(x: T, set: T[]): boolean;
    makeSum: (array: number[]) => number;
    makeSumFromElements: (array: string[]) => number;
    makeSumDecimal: (array: number[]) => string;
    makeInputSumDecimal: (array: string[]) => string;
    getInputNumericValue: (el: string) => number;
    getInputDecimalValue: (el: string) => number;
    inputHasValue: (el: string) => boolean;
    allInputsHaveValue: (array: string[]) => boolean;
    anyInputHasValue: (array: string[]) => boolean;
    radioIDs: (name: string) => string[];
    selectElement: (element: string) => HTMLSelectElement;
    htmlElement: (element: string) => HTMLInputElement;
    setValue: (element: string | string[], value: string | number) => void;
    trigger: (element: string | string[], change: string | string[]) => void;
    listen: (element: string | string[], event: string | string[], callback: () => void) => void;
    customDate: (el?: string) => string;
    standardDate: (date: string) => Date;
    diffDates: (startDate: Date, endDate: Date, type?:string) => number;
    focus: (element: string) => void;
    blur: (element: string) => void;
    addOption: (element: string, value: string, text: string) => void;
    resetSelect: (element: string, value: string, text: string) => void;
    selectValues: (element: string) => string[];
    missing: (x: unknown) => boolean;
    exists: (x: unknown) => boolean;
    repeat: (value: string|number, times: number) => Array<string|number>;
    sequence: (from: number, to: number) => number[];
    sortArray: (x: Array<string | number>, options?: {[key: string]: boolean}) => Array<string | number>;
    round: (x: number, decimals: number) => number;
    all: (x: Array<string|number>, rule: string, value?: unknown) => boolean;
    any: (x: Array<string|number>, rule: string, value?: unknown) => boolean;
    order: (x: Array<string|number>, descending?: boolean) => Array<string|number>;
    unique: (x: Array<string|number>) => Array<string|number>;
    min: (x: Array<number>) => number;
    max: (x: Array<number>) => number;
    paste: (arr: Array<string|number>, options?: Record<string, string | number>) => string;
    duplicates: (arr: Array<string|number>) => Array<string|number>;
    sum: (x: Array<number>) => number;
    prod: (x: Array<number>) => number;
    getExtensionFromType: (type: string) => string;
    getTypeFromExtension: (ext: string) => string;
    fileFromInfo: (inputType: string) => interfaces.FileFromInfo;
    validate: (inputOutput: interfaces.InputOutput) => string;
    replaceUnicode: (x: Array<string>) => Array<string>;
}

const validation_messages: interfaces.ValidationMessage = {};
const error_tippy: interfaces.ErrorTippy = {};

const errorHelperFunctions = {
    // https://stackoverflow.com/questions/4793604/how-to-insert-an-element-after-another-element-in-javascript-without-using-a-lib
    insertAfter: function (referenceNode: Node, newNode: Node): void {
        if (referenceNode.parentNode) {
            referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
        }
    },

    removeError: function (element: string | string[], error: string): void {
        if (!Array.isArray(element)) {
            element = [element];
        }

        element.forEach((item) => {
            const errIndex = util.exists(validation_messages[item]) ? validation_messages[item].errors.indexOf(error) : -1;

            if (errIndex !== -1) {
                let selectEl = document.getElementById(item);
                let isRadio = false;
                if (selectEl === null) {
                    const nameElement = document.getElementsByName(item)[0];
                    if (nameElement && nameElement.parentNode && nameElement.parentNode.parentNode) {
                        selectEl = <HTMLElement>nameElement.parentNode.parentNode;
                    }
                    isRadio = true;
                }
                if (document.querySelector(".errorclass" + item)) {
                    // console.trace(item);
                    // console.log(validation_messages);

                    validation_messages[item].errors.splice(errIndex, 1);

                    if (validation_messages[item].errors.length == 0) {
                        // remove error
                        error_tippy[item][0].destroy();
                        // remove from validation messages
                        delete validation_messages[item];
                        errorHelperFunctions.removeErrorStyle(item, isRadio);
                        document.querySelectorAll(".errorclass" + item).forEach((el) => el.classList.remove("errorclass" + item));
                    } else {
                        error_tippy[item][0].setContent(validation_messages[item].errors[0]);
                    }
                }
            }
        })
    },

    addError: function (element: string | string[], error: string): void {
        if (!Array.isArray(element)) {
            element = [element];
        }

        element.forEach((item) => {

            let selectEl = document.getElementById(item);
            if (selectEl) {
                let isRadio = false;
                if (selectEl === null) {
                    const nameElement = document.getElementsByName(item)[0];
                    if (nameElement && nameElement.parentNode && nameElement.parentNode.parentNode) {
                        selectEl = <HTMLElement>nameElement.parentNode.parentNode;
                    }
                    isRadio = true;
                }

                if (!document.querySelector(".errorclass" + item)) {
                    selectEl.classList.add("errorclass" + item);
                    // !!this may not work if you have multiple error on the item.
                    // error_tippy[item] = tippy("#" + item, {
                    error_tippy[item] = [
                        tippy(selectEl, {
                            theme: "light-red",
                            placement: "top-start",
                            content: Array.isArray(error) ? errorHelperFunctions.mergeMessages(error) : error,
                            arrow: false,
                            allowHTML: true,
                        }),
                    ];
                }

                if (!isRadio) {
                    selectEl.classList.add("error-in-field");
                } else {
                    selectEl.classList.add("error-in-radio");
                }

                if (util.exists(validation_messages[item])) {
                    if (
                        validation_messages[item].errors.findIndex(function (e) {
                            return e == error;
                        }) == -1
                    ) {
                        if (Array.isArray(error)) {
                            validation_messages[item].errors = Array.from(error);
                        } else {
                            validation_messages[item].errors.push(error);
                        }
                    }
                } else {
                    validation_messages[item] = {
                        name: item,
                        errors: Array.isArray(error) ? error : [error],
                    };
                }
            }
        })
    },

    mergeMessages: function (arr: Array<string>): string {
        let resp = "";
        for (const element of arr) {
            resp += "<p class=mb-0 aici>" + element + "</p>";
        }
        return resp;
    },

    removeErrorStyle: function (name: string, isRadio: boolean): void {
        if (isRadio) {
            const jumpID = document.getElementsByName(name)[0].id;
            const el = util.htmlElement(jumpID);
            if (util.isNull(el)) {
                const nameElement = document.getElementsByName(name)[0];
                if (nameElement && nameElement.parentNode && nameElement.parentNode.parentNode) {
                    const x = <HTMLElement>nameElement.parentNode.parentNode;
                    x.classList.remove("overrideBorder");
                    x.classList.remove("error-in-radio");
                }
            } else {
                // const nameElement = document.getElementById(jumpID);
                const nameElement = util.htmlElement(jumpID);
                if (nameElement && nameElement.parentNode && nameElement.parentNode.parentNode) {
                    const x = <HTMLElement>nameElement.parentNode.parentNode;
                    x.classList.remove("overrideBorder");
                    x.classList.remove("error-in-radio");
                }
            }
        } else {
            const element = util.htmlElement(name);
            element.classList.remove("error-in-field");
        }
    },
}

// API - export
export const errorHandler = {
    addError: errorHelperFunctions.addError,
    removeError: errorHelperFunctions.removeError,
}

// Validation functions
export const validate: interfaces.ValidationHelpers = {

    valueInInterval: (value: number, interval: [min: number, max: number]) => {
        if (value >= interval[0] && value <= interval[1]) {
            return true;
        }
        return false;
    }

}

// Util functions
export const util: UtilHelpersInterface = {

    getKeys: function(obj) {
        if (obj === null) return([]);
        return Object.keys(obj);
    },

    isNumeric: function (x) {
        if (util.missing(x) || x === null || ("" + x).length == 0) {
            return false;
        }

        return (
            Object.prototype.toString.call(x) === "[object Number]" &&
            !isNaN(parseFloat("" + x)) &&
            isFinite(util.asNumeric(x as string))
        )
    },

    possibleNumeric: function(x) {
        if (util.isNumeric(x)) {
            return true;
        }

        if (util.isNumeric("" + util.asNumeric(x))) {
            return true;
        }

        return false;
    },

    isInteger: function (x) {
        return parseFloat("" + x) == parseInt("" + x, 10);
    },

    asNumeric: function(x) {
        return parseFloat("" + x);
    },

    asInteger: function(x) {
        return parseInt("" + x);
    },

    isTrue: function(x) {
        if (util.missing(x) || util.isNull(x)) {
            return false;
        }
        return (x === true || (typeof x === 'string' && (x === 'true' || x === 'True')));
    },

    isFalse: function(x) {
        if (util.missing(x) || util.isNull(x)) {
            return false;
        }
        return (x === false || (typeof x === 'string' && (x === 'false' || x === 'False')));
    },

    isNull: function(x) {
        return util.exists(x) && x === null;
    },

    isElementOf: function(x, set) {
        if (
            util.missing(x) ||
            util.isNull(x) ||
            util.missing(set) ||
            util.isNull(set) ||
            set.length === 0
        ) {
            return false;
        }

        return set.indexOf(x) >= 0;
    },

    isNotElementOf: function(x, set) {
        if (
            util.missing(x) ||
            util.isNull(x) ||
            util.missing(set) ||
            util.isNull(set) ||
            set.length === 0
        ) {
            return false;
        }

        return set.indexOf(x) < 0;
    },

    makeSum: (array) => {
        return array.reduce((sum, i) => sum + i, 0);
    },

    makeSumFromElements: (array) => {
        const elements = new Array(array.length);
        for (let i = 0; i < array.length; i++) {
            const value = util.getInputNumericValue(array[i]);
            elements[i] = (value >= 0) ? value : 0;
        }
        return(util.makeSum(elements));
    },

    makeSumDecimal: (array) => {
        return util.makeSum(array).toFixed(2);
    },

    makeInputSumDecimal: (array) => {
        let sum = 0;
        array.forEach(item => {
            sum += util.getInputDecimalValue(item);
        })
        return sum.toFixed(2);
    },

    getInputNumericValue: (el) => {
        const input = document.getElementById(el) as HTMLInputElement;
        if (!util.isNull(input)) {
            return Number(input.value);
        }
        return 0;
    },

    getInputDecimalValue: (el) => {
        const input = document.getElementById(el) as HTMLInputElement;
        if (!util.isNull(input)) {
            return !isNaN(parseFloat(input.value)) ? parseFloat(input.value) : 0;
        }
        return 0;
    },

    inputHasValue: (el) => {
        const input = util.htmlElement(el);
        if (input.value != '') {
            return true;
        }
        return false;
    },

    allInputsHaveValue: (array) => {
        let hasvalue = true;
        let i = 0;
        while (hasvalue && i < array.length - 1) {
            const input = util.htmlElement(array[i]);
            hasvalue &&= input.value != '';
            i++;
        }
        return hasvalue;
    },

    anyInputHasValue: (array) => {
        let hasvalue = false;
        let i = 0;
        while (!hasvalue && i < array.length - 1) {
            const input = util.htmlElement(array[i]);
            hasvalue ||= input.value != '';
            i++;
        }
        return hasvalue;
    },

    radioIDs: (name) => {
        return Array.from(
            document.querySelectorAll('input[name=' + name + ']')
        ).map(
            (el) => el.id
        );
    },

    selectElement: (element) => {
        return document.getElementById(element) as HTMLSelectElement;
    },

    htmlElement: (element) => {
        return document.getElementById(element) as HTMLInputElement;
    },

    setValue: (element, value) => {
        if (!Array.isArray(element)) {
            element = [element];
        }
        element.forEach((el) => {
            util.htmlElement(el).value = value.toString();
            util.trigger(el, "change");
        });
    },

    trigger: (element, change) => {
        if (!Array.isArray(element)) {
            element = [element];
        }

        if (!Array.isArray(change)) {
            change = [change];
        }

        if (element.length !== change.length) {
            change = util.repeat(change[0], element.length) as string[];
        }

        for (let i = 0; i < element.length; i++) {
            util.htmlElement(element[i]).dispatchEvent(new Event(change[i]));
        }
    },

    listen: (element, event, callback) => {
        if (!Array.isArray(element)) {
            element = [element];
        }

        if (!Array.isArray(event)) {
            event = [event];
        }

        if (element.length !== event.length) {
            event = util.repeat(event[0], element.length) as string[];
        }

        for (let i = 0; i < element.length; i++) {
            if (util.htmlElement(element[i]) !== null) {
                util.htmlElement(element[i]).addEventListener(event[i], callback);
            } else {
                console.log("Element not found: " + element[i]);
            }
        }
    },

    customDate: (el?) => {
        if (el) {
            return el.replace(/(\d{2})\/(\d{2})\/(\d{4})/,'$3-$2-$1')
        } else {
            return new Date().getDate().toString().padStart(2, '0') + "/" +
            (new Date().getMonth() + 1).toString().padStart(2, '0') + "/" +
            new Date().getFullYear().toString()
        }
    },

    standardDate: (date) => {
        const eldate = date.split('/');
        if (eldate.length == 2) {
            return new Date(Number(eldate[1]), Number(eldate[0]) - 1, 1);
        }
        // const stdate = new Date(Number(eldate[2]), Number(eldate[1]) - 1, Number(eldate[0]));
        return new Date(date.replace(/(\d{2})\/(\d{2})\/(\d{4})/,'$3-$2-$1'));
    },

    diffDates: (startDate, endDate, type?) => {
        if (!type) {
            type = "years";
        }

        let yearDiff = endDate.getFullYear() - startDate.getFullYear();
        let monthDiff = endDate.getMonth() - startDate.getMonth();
        const dayDiff = endDate.getDate() - startDate.getDate();

        if (type == "years") {
            if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
                yearDiff--;
            }
            return(yearDiff);
        }
        else if (type == "months") {
            monthDiff += yearDiff * 12;
            if (dayDiff < 0) {
                monthDiff--;
            }
            return(monthDiff);
        }

        return 0;
    },

    focus: (element) => {
        const el = util.htmlElement(element);
        el.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
        el.focus();
    },

    blur: (element) => {
        util.htmlElement(element).blur();
    },

    addOption: (element, value, text) => {
        const option = document.createElement("option");
        option.value = value;
        option.text = text;
        util.htmlElement(element).appendChild(option);
    },

    resetSelect: (element, value, text) => {
        util.htmlElement(element).innerHTML = "";
        util.addOption(element, value, text);
    },

    selectValues: (element) => {
        const item = document.getElementById(element) as HTMLSelectElement;
        return Array.from(item.options).map((el) => el.value);
    },

    missing: function (x) {
        return x === void 0 || x === undefined;
    },

    exists: function (x) {
        return x !== void 0 && x !== undefined;
    },

    repeat: function(value, times) {
        return new Array(times).fill(value);
    },

    sequence: function (from, to) {
        const length = to - from + 1;
        const result = new Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = from + i;
        }
        return result;
    },

    // modified version from: https://github.com/pieterprovoost/jerzy/blob/master/lib/vector.js
    sortArray: function(x, options?) {

        // empty last is needed to get something like:
        // ["A", "B", ""] instead of ["", "A", "B"]
        // same with numbers
        let emptylast = true;
        let decreasing = false;

        if (options !== void 0 && options !== undefined) { // it exists
            if (util.exists(options.emptylast)) {
                emptylast = options.emptylast;
            }

            if (util.exists(options.decreasing)) {
                decreasing = options.decreasing;
            }
        }

        const sorted = orderBy(
            x,
            [],
            decreasing ? ["desc"] : ["asc"]
        );


        if (emptylast) {
            // unlike R vectors (where all elements have to be of the same type)
            // array elements in Javascript can be different
            x = util.repeat("", x.length);
            let pos = 0;

            for (let i = 0; i < x.length; i++) {
                if (sorted[i] !== "") {
                    x[pos] = sorted[i];
                    pos++;
                }
            }

            return x;
        }

        return sorted;
    },

    round: function(x, decimals) {
        decimals = Math.pow(10, decimals);
        return(Math.round(x * decimals)/decimals);
    },

    all: function(x, rule, value?) {
        if (util.missing(value)) {
            value = "";
        }

        let check = true;

        for (let i = 0; i < x.length; i++) {
            // if (util.isArray(value)) {
            if (value instanceof Array) {
                let check2 = false;
                for (let j = 0; j < value.length; j++) {
                    check2 = check2 || eval("x[i]" + rule + value[j]);
                }
                check = check && check2;
            }
            else {
                check = check && eval("x[i]" + rule + value);
            }
        }

        return(check);
    },

    any: function(x, rule, value?) {
        if (util.missing(value)) {
            value = "";
        }

        let check = false;

        for (let i = 0; i < x.length; i++) {
            // if (util.isArray(value)) {
                if (value instanceof Array) {
                for (let j = 0; j < value.length; j++) {
                    check = check || eval("x[i]" + rule + value[j]);
                }
            }
            else {
                check = check && eval("x[i]" + rule + value);
            }
        }

        return(check);
    },

    order: function(x, descending = false) {

        // const values = cloneDeep(x);
        const values = [];
        for (let v = 0; v < x.length; v++) {
            values.push(x[v]);
        }

        for (let i = 0; i < values.length; i++) {
            values[i] = [values[i], i];
        }

        values.sort(
            function(left, right) {
                const a = ("" + left)[0];
                const b = ("" + right)[0];
                return (descending ? -1 : 1) * (a < b ? -1 : 1);
            }
        );

        // TODO:
        // const result = [];
        // for (let i = 0; i < values.length; i++) {
        //     result.push(values[i][1]);
        // }

        return [1];
    },

    unique: function(x) {

        const uniques: Array<number|string> = [];

        x.forEach(value => {
            if (uniques.indexOf(value) < 0) {
                uniques.push(value);
            }
        })

        return(uniques);
    },

    min: function(x) {
        return(Math.min.apply(null, x));
    },

    max: function(x) {
        return(Math.max.apply(null, x));
    },

    //                   options?: {sep, from, to}
    paste: function(arr, options?) {
        if (arr.length == 0) return("");

        let sep = " ";
        let from = 0;
        let to = arr.length - 1;

        if (options !== void 0 && options !== undefined) {
            if (util.exists(options.sep)) {
                sep = "" + options.sep;
            }

            if (util.exists(options.from)) {
                from = Number(options.from);
            }

            if (util.exists(options.to)) {
                to = Number(options.to);
            }
        }

        let result: string = "" + arr[from];

        if (from < to) {
            for (let i = from + 1; i <= to; i++) {
                result += sep + arr[i];
            }
        }
        else {
            for (let i = from - 1; i >= to; i--) {
                result += sep + arr[i];
            }
        }

        return(result);
    },

    // adapted from:
    // http://stackoverflow.com/questions/840781/easiest-way-to-find-duplicate-values-in-a-javascript-array
    duplicates: function(arr) {
        const len = arr.length,
            out: Array<number|string> = [],
            counts: {
                [key: string]: number,
            } = {};
        let item = "";

        for (let i = 0; i < len; i++) {
            item = "" + arr[i];
            counts[item] = util.exists(counts[item]) ? (counts[item] + 1) : 1;
        }

        for (item in counts) {
            if (counts[item] > 1) {
                if (util.isNumeric(item)) {
                    out.push(util.asNumeric(item));
                } else {
                    out.push(item);
                }
            }
        }

        return out;
    },

    sum: function (x) {
        return(x.reduce((sum, i) => sum + i, 0));
    },

    prod: function(x) {
        return x.reduce((prod, i) => prod * i);
    },

    getExtensionFromType: function(type) {
        let ext = '';
        switch (type) {
            case 'ddi':
                ext = '.xml';
                break
            case 'excel':
                ext = '.xlsx';
                break
            case 'sas':
                ext = '.sas7bdat';
                break
            case 'xpt':
                ext = '.xpt';
                break
            case 'spss':
                ext = '.sav';
                break
            case 'stata':
                ext = '.dta';
                break
            case 'r':
                ext = '.rds';
                break
        }

        return ext;
    },

    getTypeFromExtension: function(ext) {
        let type = '';
        switch (ext) {
            case '.xml':
                type = 'ddi';
                break
            case '.xlsx':
                type = 'excel';
                break
            case '.sas7bdat':
                type = 'sas';
                break
            case '.xpt':
                type = 'sas';
                break
            case '.sav':
                type = 'spss';
                break
            case '.zsav':
                type = 'spss';
                break
            case '.por':
                type = 'spss';
                break
            case '.dta':
                type = 'stata';
                break
            case '.rds':
                type = 'r';
                break
        }

        return type;
    },

    fileFromInfo: function(inputType) {
        const result = {
            fileTypeName: '',
            ext: <Array<string>>[]
        }

        switch (inputType) {
            case 'ddi':
                result.ext.push('xml');
                result.fileTypeName = 'DDI Files';
                break
            case 'excel':
                result.ext.push('xlsx');
                result.fileTypeName = 'Excel Files';
                break
            case 'sas':
                result.ext.push('sas7bdat');
                result.fileTypeName = 'SAS Files';
                break
            case 'xpt':
                result.ext.push('xpt');
                result.fileTypeName = 'SAS Transport Files';
                break
            case 'spss':
                result.ext.push('sav');
                result.ext.push('zsav');
                result.ext.push('por');
                result.fileTypeName = 'SPSS Files';
                break
            case 'stata':
                result.ext.push('dta');
                result.fileTypeName = 'Stata Files';
                break
            case 'r':
                result.ext.push('rds');
                result.fileTypeName = 'R Files';
                break
            default:
                result.ext.push('*');
        }

        return result;
    },

    validate: function(inputOutput) {

        if (inputOutput.fileFrom != "") {

            const fileType = util.getTypeFromExtension(path.extname(inputOutput.fileFrom));
            if (fileType == "" || (inputOutput.inputType != "" && fileType != inputOutput.inputType)) {
                return("Unsupported input type.");
            }
        }

        if (inputOutput.fileTo != "") {

            const fileType = util.getTypeFromExtension(path.extname(inputOutput.fileTo));
            if (fileType == "" || (inputOutput.outputType != "" && fileType != inputOutput.outputType)) {
                return("Unsupported output type.");
            }
        }

        return("ok");

    },

    replaceUnicode: function(x) {
        for (let i = 0; i < x.length; i++) {
            x[i] = x[i].replace(
                /<U\+([A-Fa-f0-9]{4})>/g,
                function(match: string, hex: string): string {
                    const codepoint = parseInt(hex, 16);
                    return String.fromCharCode(codepoint);
                }
            );
        }
        return(x);
    }
}
