// import cloneDeep from "lodash.clonedeep";
import orderBy from "lodash/orderBy";
// import * as _ from "lodash";
import * as path from "path";

import {
    InputOutputType,
    FileFromInfoType 
} from "./interfaces";

export const helpers = {
    // isArray: function(x: Record<string, unknown>): boolean {
    //     return Object.prototype.toString.call(x) == '[object Array]';
    // },

    isArray: function(obj: unknown): boolean {
        // return (obj instanceof Array);
        return Object.prototype.toString.call(obj) == "[object Array]";
    },


    getKeys: function(obj: Record<string, unknown>): Array<string> {
        if (obj === null) return([]);
        return Object.keys(obj);
    },


    missing: function (x: unknown): boolean {
        return(x === void 0 || x === undefined);
    },


    exists: function (x: unknown): boolean {
        return(x !== void 0 && x !== undefined);
    },


    isString: function (x: unknown): boolean {
        return Object.prototype.toString.call(x) === "[object String]"
    },


    isNumeric: function (x: number | string): boolean {
        if (this.missing(x) || x === null || ("" + x).length == 0) {
            return false;
        }

        return (
                Object.prototype.toString.call(x) === "[object Number]" &&
                !isNaN(parseFloat("" + x)) &&
                isFinite(this.asNumeric(x))
            )
    },


    possibleNumeric: function(x: string|number): boolean {
        if (this.isNumeric(x)) {
            return true;
        }

        if (this.isNumeric(this.asNumeric(x))) {
            return true;
        }

        return false;
    },


    isInteger: function (x: number): boolean {
        return parseFloat("" + x) == parseInt("" + x, 10);
    },


    asNumeric: function(x: string|number): number {
        return parseFloat("" + x);
    },


    asInteger: function(x: string|number): number {
        return parseInt("" + x);
    },


    isTrue: function(x: boolean): boolean {
        return (x === true);
    },

    
    isFalse: function(x: boolean): boolean {
        return (x === false);
    },

    // modified version from: https://github.com/pieterprovoost/jerzy/blob/master/lib/vector.js
    sortArray: function(
        x: Array<string|number>, options?: {[key: string]: boolean}
    ): Array<string|number> {
        
        // empty last is needed to get something like:
        // ["A", "B", ""] instead of ["", "A", "B"]
        // same with numbers
        let emptylast = true;
        let decreasing = false;

        if (options !== void 0 && options !== undefined) { // it exists
            if (this.exists(options.emptylast)) {
                emptylast = options.emptylast;
            }

            if (this.exists(options.decreasing)) {
                decreasing = options.decreasing;
            }
        }
        
        const sorted: Array<string|number> = orderBy(
            x,
            [],
            decreasing ? ["desc"] : ["asc"]
        );
        
        
        if (emptylast) {
            // unlike R vectors (where all elements have to be of the same type)
            // array elements in Javascript can be different
            x = this.rep("", x.length);
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



    round: function(x: number, decimals: number): number {
        decimals = Math.pow(10, decimals);
        return(Math.round(x * decimals)/decimals);
    },


    all: function(x: Array<number|string>, rule: string, value?: unknown): boolean {
        if (this.missing(value)) {
            value = "";
        }

        let check = true;
        
        for (let i = 0; i < x.length; i++) {
            // if (this.isArray(value)) {
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


    any: function(x: Array<number|string>, rule: string, value?: unknown): boolean {
        if (this.missing(value)) {
            value = "";
        }

        let check = false;
        
        for (let i = 0; i < x.length; i++) {
            // if (this.isArray(value)) {
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


    order: function(x: Array<number|string>, descending = false): Array<number|string> {
        
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


    rep: function(x: number|string, times: number): Array<number|string> {
        const result = new Array(times);
        for (let i = 0; i < times; i++) {
            result[i] = x;
        }
        return(result);
    },


    seq: function(from: number, to: number): Array<number> {
        const length = to - from + 1;
        const result = new Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = from + i;
        }
        return(result);
    },


    unique: function(x: Array<number|string>): Array<number|string> {
        
        const uniques: Array<number|string> = [];

        x.forEach(value => {
            if (uniques.indexOf(value) < 0) {
                uniques.push(value);
            }
        })
        
        return(uniques);        
    },


    min: function(x: Array<number>): number {
        return(Math.min.apply(null, x));
    },


    max: function(x: Array<number>): number {
        return(Math.max.apply(null, x));
    },


    //                                         options?: {sep: string, from: number, to: number}
    //                                         options?: {[key: string]: string|number}
    paste: function(arr: Array<number|string>, options?: Record<string, string|number>): string {
        if (arr.length == 0) return("");
        
        let sep = " ";
        let from = 0;
        let to = arr.length - 1;

        if (options !== void 0 && options !== undefined) {
            if (this.exists(options.sep)) {
                sep = "" + options.sep;
            }
        
            if (this.exists(options.from)) {
                from = Number(options.from);
            }
            
            if (this.exists(options.to)) {
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
    duplicates: function(arr: Array<number|string>): Array<number|string> {
        const len = arr.length,
            out: Array<number|string> = [],
            counts: {
                [key: string]: number,
            } = {};
        let item = "";
            
        for (let i = 0; i < len; i++) {
            item = "" + arr[i];
            counts[item] = this.exists(counts[item]) ? (counts[item] + 1) : 1;
        }
        
        for (item in counts) {
            if (counts[item] > 1) {
                if (this.isNumeric(item)) {
                    out.push(this.asNumeric(item));
                } else {
                    out.push(item);
                }
            }
        }
        
        return out;
    },


    sum: function (x: Array<number>): number {
        return(x.reduce((sum, i) => sum += i, 0));
    },


    prod: function(x: Array<number>): number {
        return x.reduce((prod, i) => prod * i);
    },

	// recode: function (
    //     x: Array<number>, cut: Array<number>, onebased = false
    // ): Array<number> {
    //     // x is an array of values
        
    //     // cut is an array of cut values, i.e. [a, b, c] and values get
    //     // recoded into the intervals (min, a), [a, b), [b, c) etc.

    //     // onebased is a flag to get the numbers 1 based
    //     // (instead of Javascript's 0 based system)

    //     const copycut = cloneDeep(cut); // to avoid any reference assignments
    //     copycut.push(this.min(x));
    //     // uscut = unique and sorted cut
    //     const uscut = this.sortArray(this.unique(copycut));
		
    //     const result = new Array<number>(x.length);
    //     for (let i = 0; i < x.length; i++) {
    //         for (let j = 0; j < uscut.length; j++) {
    //             if (x[i] >= uscut[j]) {
    //                 result[i] = j + (onebased ? 1 : 0);
    //             }
    //         }
    //     }

	// 	return(result);
    // },

    getExtensionFromType: function(type: string): string {
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

    getTypeFromExtension: function(ext: string): string {
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

    fileFromInfo: function(inputType: string): FileFromInfoType {
        const result = {
            ext: <Array<string>>[],
            fileTypeName: ''
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

    validate: function(inputOutput: InputOutputType): string {

        if (inputOutput.fileFrom != "") {
            
            const fileType = this.getTypeFromExtension(path.extname(inputOutput.fileFrom));
            if (fileType == "" || (inputOutput.inputType != "" && fileType != inputOutput.inputType)) {
                return("Unsupported input type.");
            }
        }

        if (inputOutput.fileTo != "") {
            
            const fileType = this.getTypeFromExtension(path.extname(inputOutput.fileTo));
            if (fileType == "" || (inputOutput.outputType != "" && fileType != inputOutput.outputType)) {
                return("Unsupported output type.");
            }
        }

        return("ok");

    },
}
