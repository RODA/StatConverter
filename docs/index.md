StatConverter v1.0.0 (by [<b>RODA</b>](http://www.roda.ro)) is a tool to convert to and from various statistical software formats: R, SPSS, Stata, SAS (even Excel) and DDI Codebook.

<p align="center">
  <img src="StatConverter.png" alt="StatConverter screenshot" style="width:600px;"/>
</p>

The actual conversion is done using the R environment. StatConverter is a graphical user interface using Node.js and Electron, to build cross-platform desktop applications using HTML, CSS, and JavaScript. It is available in multiple formats, depending on the operating system: apart from the GitHub source files, platform specific binaries and installers are also available.

## Everything packed in

On Windows (64 bit), the is no need to separately install R. It can be made portable and packed into the converter:

- install as a self-contained application: <button type="button" style="background:#3E72AF;color:white;"><a href="https://github.com/RODA/Files/blob/main/StatConverter_Setup_1.0.0.exe?raw=true"><span style="color:white">Download installer</span></a></button>

- executable application, no need to install <button type="button" style="background:#3E72AF;color:white;"><a href="https://github.com/RODA/Files/blob/main/StatConverter_1.0.0.zip?raw=true"><span style="color:white">Download .zip</span></a></button>

## Separate installation of R

Since it is not possible to make R portable on MacOS and Linux, on these platforms StatConverter requires a separate installation of R (link to [<b>CRAN</b>](https://cran.r-project.org/bin/) download page), in a similar way to RStudio. Further instructions about the necessary R packages are presented below. When R is successfully installed on the local computer, StatConverter can directly communicate with it on all operating systems (including Windows):

- install as an application (installers to be added)

- executable binaries, no need to install (compressed files to be added)



## Necessary R packages

StatConverter uses a couple of R packages that need to be installed:

```r
install.packages(c("DDIwR", "jsonlite"), dependencies = TRUE)
```

It is important to have these packages with all their dependencies, otherwise functionality might be lost.

The actual package that does the heavy lifting is [<b>DDIwR</b>](https://cran.r-project.org/web/packages/DDIwR/index.html) (DDI with R), which uses the package [<b>haven</b>](https://cran.r-project.org/web/packages/haven/index.html) which in turn uses Evan Miller's [<b>ReadStat</b>](https://github.com/WizardMac/ReadStat) C library.

## R on the system PATH

On Unix systems (including MacOS), R is automatically added to the system PATH upon installation. On Windows, this has to be done manually:

- search for "Edit the system environment variabled" in Control Panel

- click the "Advanced" tab

- click on the "Environment Variables..." button

- double-click on the "Path" variable to open it

- click on "New", then "Browse" and indicate the folder where R is installed, typically in C:/Program Files/R/R-4.2.0/bin
(the actual version number depends on the moment when R is installed)

## Running StatConverter from sources

For the advanced users (Linux, usually) StatConverter can also be started from its source files.

The first step is to create a clone of the [<b>GitHub</b>](https://github.com/RODA/StatConverter) repository.

[<b>Node.js</b>](https://nodejs.org/download/release/v14.18.2/) needs to be installed, we recommend version 14 which we are using.

On Windows, users need to install the [<b>Microsoft Visual Studio Tools</b>](https://visualstudio.microsoft.com/downloads/) (we've installed the 2019 community version, especially the C++ build tools) and also [<b>Git</b>](https://git-scm.com/downloads), which needs to be on the system PATH as well.

Then open a Terminal in the clone of the StatConverter directory, and type:

```
npm install
```

After Node.js will install all the necessary modules, type:

```
npm start
```

to start the application.
