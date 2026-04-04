import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { spawn, spawnSync } from "child_process";
import type { ChildProcess } from "child_process";
import { resolveBundledRDir, resolveBundledRscriptPath } from "../appPaths";

type NativeWorkerResponse = {
    id?: number;
    type?: string;
    status?: string;
    missing?: string[];
    message?: string;
    result?: unknown;
};

type RscriptCandidate = {
    rscriptPath: string;
    runtimeLibraryDir?: string;
};

class EmbeddedWorkerInitError extends Error {
    public missingPackages: string[];

    constructor(message: string, missingPackages: string[] = []) {
        super(message);
        this.missingPackages = missingPackages;
        Object.setPrototypeOf(this, EmbeddedWorkerInitError.prototype);
    }
}

const prependEnvPath = (currentValue: string | undefined, valueToAdd: string, separator: string): string => {
    const values = [valueToAdd, currentValue || ""].filter(Boolean);
    return values.join(separator);
};

const resolveNativeRBinaryPath = (rscript: string): string => {
    if (process.platform !== "win32") {
        return rscript.replace(/Rscript(?:\.exe)?$/i, "R");
    }

    const scriptDir = path.dirname(rscript);
    const candidates = [
        path.join(scriptDir, "Rterm.exe"),
        path.join(scriptDir, "x64", "Rterm.exe"),
        path.join(scriptDir, "R.exe"),
        path.join(scriptDir, "x64", "R.exe")
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return rscript.replace(/Rscript(?:\.exe)?$/i, "R.exe");
};

const buildRuntimeEnv = (rscript: string, runtimeLibraryDir?: string): NodeJS.ProcessEnv => {
    const env: NodeJS.ProcessEnv = { ...process.env };

    if (!runtimeLibraryDir || !fs.existsSync(runtimeLibraryDir)) {
        return env;
    }

    const runtimeDir = path.resolve(path.dirname(rscript), "..");
    env.R_HOME = runtimeDir;
    env.R_LIBS_SITE = runtimeLibraryDir;
    env.R_LIBS_USER = runtimeLibraryDir;

    const runtimeBinDir = path.join(runtimeDir, "bin");
    env.PATH = prependEnvPath(env.PATH, runtimeBinDir, path.delimiter);

    if (process.platform !== "win32") {
        const runtimeLibDir = path.join(runtimeDir, "lib");
        if (fs.existsSync(runtimeLibDir)) {
            env.LD_LIBRARY_PATH = prependEnvPath(env.LD_LIBRARY_PATH, runtimeLibDir, ":");
        }
    }

    return env;
};

class EmbeddedRWorker {
    private proc: ChildProcess | null = null;
    private reader: readline.Interface | null = null;
    private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
    private nextId = 1;
    private readyPromise: Promise<void> | null = null;
    private readyResolve: (() => void) | null = null;
    private readyReject: ((error: Error) => void) | null = null;
    private initialized = false;

    start(rscript: string, libraryDir: string, runtimeLibraryDir?: string): Promise<void> {
        if (this.readyPromise) {
            return this.readyPromise;
        }

        this.nextId = 1;
        this.pending.clear();
        this.initialized = false;

        const rbin = resolveNativeRBinaryPath(rscript);
        this.proc = spawn(rbin, ["--vanilla", "--quiet", "--no-save", "--no-restore", "--slave"], {
            stdio: ["pipe", "pipe", "pipe"],
            env: buildRuntimeEnv(rscript, runtimeLibraryDir)
        });

        const rl = readline.createInterface({ input: this.proc.stdout! });
        this.reader = rl;
        let stderrBuf = "";

        rl.on("line", (line: string) => this.handleLine(line));
        this.proc.stderr!.on("data", (chunk: Buffer) => {
            stderrBuf += chunk.toString();
        });

        this.proc.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
            if (!this.initialized && this.readyReject) {
                const details: string[] = [];
                if (typeof code === "number") {
                    details.push(`exit code ${code}`);
                }
                if (signal) {
                    details.push(`signal ${signal}`);
                }

                const suffix = details.length ? ` (${details.join(", ")})` : "";
                const stderrMessage = stderrBuf.trim();
                const message = stderrMessage
                    ? `Embedded R exited before initialization${suffix}\n\n${stderrMessage}`
                    : `Embedded R exited before initialization${suffix}`;

                this.readyReject(new EmbeddedWorkerInitError(message));
            }

            this.rejectAllPending(new Error("Embedded R session terminated"));
            this.cleanup();
        });

        this.proc.on("error", (error: Error) => {
            if (!this.initialized && this.readyReject) {
                this.readyReject(new EmbeddedWorkerInitError(error.message));
            }

            this.rejectAllPending(error);
            this.cleanup();
        });

        this.readyPromise = new Promise((resolve, reject) => {
            this.readyResolve = resolve;
            this.readyReject = reject;
        });

        const initTimeout = setTimeout(() => {
            if (!this.initialized && this.readyReject) {
                this.readyReject(new EmbeddedWorkerInitError("Embedded R did not initialize in time"));
                this.stop();
            }
        }, 8000);

        this.readyPromise.finally(() => clearTimeout(initTimeout));

        if (runtimeLibraryDir && fs.existsSync(runtimeLibraryDir)) {
            this.proc.stdin?.write(`.libPaths(c(${JSON.stringify(runtimeLibraryDir)}, .libPaths()))\n`);
        }

        const libDirLiteral = JSON.stringify(libraryDir);
        this.proc.stdin?.write(`source(file.path(${libDirLiteral}, "dependencies.R"))\n`);

        return this.readyPromise;
    }

    evalRString(expr: string): Promise<string> {
        if (!this.proc || !this.initialized) {
            return Promise.reject(new Error("Embedded R session is not initialized"));
        }

        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve: (value) => resolve(String(value ?? "")), reject });
            const wrapped = `local({ tryCatch({ .sc_res <- ( ${expr} ); cat(jsonlite::toJSON(list(id=${id},status="ok",result=.sc_res), auto_unbox=TRUE, null="null"), "\\n", sep="") }, error=function(e) { cat(jsonlite::toJSON(list(id=${id},status="error",message=conditionMessage(e)), auto_unbox=TRUE, null="null"), "\\n", sep="") }) })`;
            const ok = this.proc!.stdin!.write(wrapped + "\n");
            if (!ok) {
                this.pending.delete(id);
                reject(new Error("Failed to send expression to embedded R"));
            }
        });
    }

    stop() {
        if (this.proc && !this.proc.killed) {
            this.proc.kill();
        }
        this.cleanup();
    }

    private handleLine(line: string) {
        if (!line) {
            return;
        }

        let payload: NativeWorkerResponse;
        try {
            payload = JSON.parse(line);
        } catch {
            return;
        }

        if (!this.initialized && payload.type === "init") {
            if (payload.status === "ok") {
                this.initialized = true;
                this.readyResolve?.();
            } else {
                const missing = Array.isArray(payload.missing)
                    ? payload.missing.map(String)
                    : [];
                const message = payload.message || "Embedded R initialization failed";
                this.readyReject?.(new EmbeddedWorkerInitError(message, missing));
                this.stop();
            }
            return;
        }

        if (!this.initialized || typeof payload.id !== "number") {
            return;
        }

        const pending = this.pending.get(payload.id);
        if (!pending) {
            return;
        }

        this.pending.delete(payload.id);

        if (payload.status === "ok") {
            pending.resolve(payload.result);
        } else {
            pending.reject(new Error(payload.message || "Embedded R error"));
        }
    }

    private rejectAllPending(error: Error) {
        for (const pending of Array.from(this.pending.values())) {
            pending.reject(error);
        }
        this.pending.clear();
    }

    private cleanup() {
        this.reader?.close();
        this.reader = null;
        this.proc = null;
        this.readyPromise = null;
        this.readyResolve = null;
        this.readyReject = null;
        this.initialized = false;
    }
}

const embeddedRWorker = new EmbeddedRWorker();
let embeddedRscriptPath: string | null = null;

const resolveRuntimeLibraryDirFromRscript = (rscriptPath: string | null): string | null => {
    if (!rscriptPath) {
        return null;
    }

    const runtimeDir = path.resolve(path.dirname(rscriptPath), "..");
    const libDir = path.join(runtimeDir, "library");
    return fs.existsSync(libDir) ? libDir : null;
};

const findSystemRscript = (): string | null => {
    const lookup = process.platform === "win32" ? "where" : "which";
    try {
        const result = spawnSync(lookup, ["Rscript"], { encoding: "utf8" });
        if (result.status !== 0) {
            return null;
        }

        const first = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
        return first || null;
    } catch {
        return null;
    }
};

const getNativeRscriptCandidates = (): RscriptCandidate[] => {
    const candidates: RscriptCandidate[] = [];
    const bundled = resolveBundledRscriptPath(__dirname);

    if (bundled) {
        const runtimeLibraryDir = resolveRuntimeLibraryDirFromRscript(bundled);
        candidates.push({
            rscriptPath: bundled,
            runtimeLibraryDir: runtimeLibraryDir || undefined
        });
    }

    const system = findSystemRscript();
    if (system && system !== bundled) {
        candidates.push({ rscriptPath: system });
    }

    return candidates;
};

export async function initEmbeddedR(): Promise<void> {
    if (embeddedRscriptPath) {
        return;
    }

    const libraryDir = resolveBundledRDir({ fromDir: __dirname });
    const candidates = getNativeRscriptCandidates();
    const errors: string[] = [];

    for (const candidate of candidates) {
        try {
            await embeddedRWorker.start(candidate.rscriptPath, libraryDir, candidate.runtimeLibraryDir);
            embeddedRscriptPath = candidate.rscriptPath;
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`${candidate.rscriptPath}: ${message}`);
        }
    }

    if (errors.length === 0) {
        throw new Error("No R runtime was found. Add an embedded R-runtime folder or install Rscript.");
    }

    throw new Error(errors.join("\n\n"));
}

export async function evalRString(expr: string): Promise<string> {
    await initEmbeddedR();
    return embeddedRWorker.evalRString(expr);
}

export function getEmbeddedRscriptPath(): string | null {
    return embeddedRscriptPath;
}
