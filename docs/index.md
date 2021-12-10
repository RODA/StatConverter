## StatConverter

StatConverter is a tool to convert to and from various statistical software formats: R, SPSS, Stata, SAS and DDI Codebook.

It is a graphical user interface using Node.js and Electron, to build cross-platform desktop applications using HTML, CSS, and JavaScript.

This is not a self-contained application, instead it relies on an existing installation of the **R** software (link to [CRAN](https://cran.r-project.org/bin/) download page), much like RStudio which sits on top of **R**.

Platform specific binaries will be uploaded here in this page, in the upcoming future, so users can download and run the latest version of the software.


### Installing the necessary R packages

StatConverter uses a number of **R** packages that need to be installed:

```r
install.packages(c("DDIwR", "httpuv", "digest", "jsonlite"), dependencies = TRUE)
```

It is important to have these packages with all their dependencies, otherwise functionality might be lost.

The actual package that does the heavy lifting is `DDIwR` (DDI with R), which uses the package `haven` which in turn uses Evan Miller's `ReadStat` C library.

### R on PATH

On Unix systems (including MacOS), R is automatically added to the system PATH upon installation. On Windows, this has to be done manually:

- search for "Edit the system environment variabled" in Control Panel

- click the "Advanced" tab

- click on the "Environment Variables..." button

- double-click on the "Path" variable to open it

- click on "New", then "Browse" and indicate the folder where **R** is installed, typically in C:/Program Files/R/R-4.1/bin
(the actual version number depends on the moment when **R** is installed)

### Running StatConverter from sources

StatConverter can be started from its source files, not only by using a binary version.

The first step is to create a clone of the [GitHub](https://github.com/RODA/StatConverter) repository.

Obviously, [Node.js](https://nodejs.org/download/release/v14.18.2/) needs to be installed, we recommend version 14 which we are using.

On Windows, users need to install the Microsoft Visual Studio Tools (we've installed the 2017 version, especially the C++ tools) and also [Git](https://git-scm.com/downloads), which needs to be on the system PATH as well.

Then open a Terminal in the clone of the StatConverter directory, and type:

```
npm install
```

After Node.js will install all the necessary modules, type:

```
npm start
```

to start the application from sources.
