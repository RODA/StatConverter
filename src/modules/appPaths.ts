import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

type BundledRDirOptions = {
    fromDir?: string;
    requiredFiles?: string[];
};

const R_HELPER_REQUIRED_FILES = [
    "dependencies.R",
    "utils.R"
];

const DEV_MAC_ARM64_PORTABLE_SOURCE = "/Users/dusadrian/Lucru/_R/R_Portable/darwin-arm64";

const isDir = (value: string): boolean => {
    try {
        return fs.statSync(value).isDirectory();
    } catch {
        return false;
    }
};

const isFile = (value: string): boolean => {
    try {
        return fs.statSync(value).isFile();
    } catch {
        return false;
    }
};

const newestMtimeMs = (targetPath: string): number => {
    try {
        const stat = fs.statSync(targetPath);
        let latest = stat.mtimeMs;

        if (!stat.isDirectory()) {
            return latest;
        }

        for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
            const childPath = path.join(targetPath, entry.name);
            latest = Math.max(latest, newestMtimeMs(childPath));
        }

        return latest;
    } catch {
        return 0;
    }
};

const shouldRefreshRuntime = (sourceDir: string, targetDir: string): boolean => {
    if (!isDir(sourceDir)) {
        return false;
    }

    if (!isDir(targetDir)) {
        return true;
    }

    return newestMtimeMs(sourceDir) > newestMtimeMs(targetDir);
};

const syncDevEmbeddedRuntime = (fromDir: string): void => {
    if (app.isPackaged || process.platform !== "darwin" || process.arch !== "arm64") {
        return;
    }

    const sourceDir = DEV_MAC_ARM64_PORTABLE_SOURCE;
    const targetCandidates = [
        path.resolve(process.cwd(), "R-runtime"),
        path.resolve(fromDir, "../../R-runtime"),
        path.resolve(fromDir, "../R-runtime")
    ];
    const targetDir = targetCandidates[0];

    if (!shouldRefreshRuntime(sourceDir, targetDir)) {
        return;
    }

    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.cpSync(sourceDir, targetDir, { recursive: true });
};

const hasRequiredFiles = (dir: string, requiredFiles: readonly string[]): boolean => {
    try {
        return requiredFiles.every((name) => fs.existsSync(path.join(dir, name)));
    } catch {
        return false;
    }
};

export function resolveBundledRDir(options: BundledRDirOptions = {}): string {
    const fromDir = options.fromDir ?? __dirname;
    const requiredFiles = options.requiredFiles ?? R_HELPER_REQUIRED_FILES;
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

    const candidates = app.isPackaged
        ? [
            resourcesPath ? path.resolve(resourcesPath, "library", "R") : ""
        ]
        : [
            path.resolve(fromDir, "../../src/library/R"),
            path.resolve(fromDir, "../src/library/R"),
            path.resolve(process.cwd(), "src/library/R")
        ];

    for (const candidate of candidates) {
        if (candidate && isDir(candidate) && hasRequiredFiles(candidate, requiredFiles)) {
            return candidate;
        }
    }

    return app.isPackaged && resourcesPath
        ? path.resolve(resourcesPath, "library", "R")
        : path.resolve(process.cwd(), "src/library/R");
}

const portableRuntimeCandidates = (fromDir: string): string[] => {
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

    if (app.isPackaged) {
        return [
            resourcesPath ? path.resolve(resourcesPath, "R-runtime") : "",
            resourcesPath ? path.resolve(resourcesPath, "R_Portable") : ""
        ].filter(Boolean);
    }

    syncDevEmbeddedRuntime(fromDir);

    const macPortableCandidates = process.platform === "darwin"
        ? [
            DEV_MAC_ARM64_PORTABLE_SOURCE
        ]
        : [];

    return [
        ...macPortableCandidates,
        path.resolve(fromDir, "../../R-runtime"),
        path.resolve(fromDir, "../R-runtime"),
        path.resolve(process.cwd(), "R-runtime"),
        path.resolve(fromDir, "../../R_Portable"),
        path.resolve(fromDir, "../R_Portable"),
        path.resolve(process.cwd(), "R_Portable")
    ].filter(Boolean);
};

export function resolveBundledRscriptPath(fromDir: string = __dirname): string | null {
    const exeName = process.platform === "win32"
        ? "Rscript.exe"
        : process.platform === "darwin"
            ? "R"
            : "Rscript";

    for (const runtimeDir of portableRuntimeCandidates(fromDir)) {
        const candidate = path.join(runtimeDir, "bin", exeName);
        if (isFile(candidate)) {
            return candidate;
        }
    }

    return null;
}
