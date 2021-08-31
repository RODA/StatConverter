
attach(NULL, name = "RGUI") 
env <- as.environment("RGUI")

packages <- c("DDIwR", "digest", "httpuv", "jsonlite")
installed <- logical(length(packages))

for (i in seq(length(packages))) {
    installed[i] <- requireNamespace(packages[i], quietly = TRUE)
}

if (sum(installed) < length(packages)) {
    cat(paste("Package(s) not installed:", paste(packages[!installed], collapse = ", "), "\n"))
} else {
    
    env$RGUI_server <- httpuv::startServer("127.0.0.1", 12345,
        list(
            onHeaders = function(req) {
                # cat(capture.output(str(as.list(req))), sep = "\n")
            },
            onWSOpen = function(ws) {
                cat("Connection opened.\n")
                ws$onMessage(function(binary, message) {
                    cat("Server received message:", message, "\n")
                    
                    # if (grepl("RGUI_call\\.R", message)) {
                    #     eval(parse(text = message), envir = .GlobalEnv)
                    # } else {
                        
                        console <- RGUI_tryCatchWEM(
                            # I have my own function RGUI_evalparse()
                            # but don't remember why I need that function
                            eval(
                                parse(text = message),
                                envir = .GlobalEnv
                            )
                        )

                        if (length(console) == 0) {
                            console <- list(visible = c())
                        }

                        toreturn <- list()
                        objects <- ls(envir = .GlobalEnv)

                        if (length(objects) > 0) {
                            toreturn$info <- RGUI_tryCatchWEM(RGUI_call())$visible
                        }
                        
                        toreturn$console <- console
                        # print(console)

                        ws$send(
                            jsonlite::toJSON(
                                toreturn,
                                pretty = TRUE
                            )
                        )
                        
                    # }
                })
                ws$onClose(function() {
                    cat("Connection closed (message in R).\n")
                })
            }
        )
    )
    
    cat("_server_started_\n")


}


env$RGUI_formatted <- FALSE
env$RGUI_hashes <- list()
env$RGUI_objtype <- list()
env$RGUI_visiblecols <- 8 # visible columns \
env$RGUI_visiblerows <- 17 # visible rows   / from (size of) the data editor in the GUI
env$RGUI_result <- c()
env$RGUI_server <- list()

env$RGUI_continue <- lapply(c("a(", "'a"), function(x) {
    x <- unlist(strsplit(unlist(strsplit(tryCatch(eval(parse(text = x)), error = identity)$message, "\n"))[1], ":"))
    return(gsub("^[[:space:]]+|[[:space:]]+$", "", x[length(x)]))
})

env$RGUI_trimstr <- function(x) {
    gsub("^[[:space:]]+|[[:space:]]+$", "", x)
}

env$RGUI_possibleNumeric <- function(x) {
    if (all(is.na(x))) {
        return(FALSE)
    }

    if (inherits(x, "haven_labelled") || inherits(x, "declared")) {
        return(Recall(unclass(x)) && !any(is.na(suppressWarnings(as.numeric(names(attr(x, "labels")))))))
    }

    if (is.numeric(x)) {
        return(TRUE)
    }

    if (is.factor(x)) {
        return(!any(is.na(suppressWarnings(as.numeric(levels(x))))))
    }
    
    if (any(grepl("[^!-~ ]", x))) {
        return(FALSE)
    }

    # as.character converts everything (especially factors)
    return(!any(is.na(suppressWarnings(as.numeric(na.omit(x))))))
}

env$RGUI_asNumeric <- function (x) {
    if (is.numeric(x)) {
        return(x)
    }

    if (is.factor(x)) {
        return(suppressWarnings(as.numeric(levels(x)))[x])
    }

    result <- rep(NA, length(x))
    multibyte <- grepl("[^!-~ ]", x)
    result[!multibyte] <- suppressWarnings(as.numeric(x[!multibyte]))
    
    return(result)
}

env$RGUI_jsonify <- function(x, n = 1) {
    # x should ALWAYS  be a list
    # whose components are either:
    # - lists, when RGUI_jsonify() will be Recall()-ed recursively
    # or
    # - vectors
    # the argument n helps indent the JSON output

    env <- as.environment("RGUI")
    indent <- paste(rep(" ", n*4), collapse = "")
    followup <- paste(rep(" ", (n - 1)*4), collapse = "")
    nms <- names(x)
    result <- ""
    for (i in seq(length(x))) {

        xi <- x[[i]]

        if (inherits(xi, "list")) {
            
            if (length(xi) > 0) {
                nmsi <- names(xi)

                if (is.null(nmsi)) {
                    # unnamed list, ex. vdata
                    result <- paste(result, "\"", nms[i], "\": [\n", indent, Recall(xi, n = n + 1), "\n", followup, "]",  sep = "")
                }
                else {
                    if (is.null(xi)) {
                        result <- paste(result, "\"", nms[i], "\"", ": undefined", sep = "")
                    }
                    else {
                        result <- paste(result, "\"", nms[i], "\"", ": {\n", indent, Recall(xi, n = n + 1), "\n", followup, "}",  sep = "")
                    }
                }
            }
            else {
                result <- paste(result, "\"", nms[i], "\"", ": {}",  sep = "")
            }
        }
        else {
            # xi is a vector
            collapse <- ", "
            prefix <- ""
            if (!env$RGUI_possibleNumeric(xi) || inherits(xi, "Date")) {
                collapse <- '", "'
                prefix <- '"'
            }
            
            if (is.logical(x[[i]])) {
                x[[i]] <- gsub("TRUE", "true", gsub("FALSE", "false", as.character(x[[i]])))
            }

            x[[i]] <- gsub('"', '\\\\\"', x[[i]])
            x[[i]][is.na(x[[i]])] <- ""
            # check <- length(x[[i]]) > 1 | is.character(x)
            result <- paste(result,
                ifelse (is.null(nms[i]), 
                    # sprintf(ifelse(check, "[%s%s%s]", "%s%s%s"), prefix, paste(x[[i]], collapse = collapse), prefix),
                    # sprintf(ifelse(check, '"%s": [%s%s%s]', '"%s": %s%s%s'), nms[i], prefix, paste(x[[i]], collapse = collapse), prefix)
                    sprintf("[%s%s%s]", prefix, paste(x[[i]], collapse = collapse), prefix),
                    sprintf('"%s": [%s%s%s]', nms[i], prefix, paste(x[[i]], collapse = collapse), prefix)
                ),
            sep = "")

        }

        if (i < length(x)) {
            result <- paste(result, ",\n", followup, sep = "")
        }
    }

    return(result)
}

env$RGUI_scrollvh <- function(...) {
    env <- as.environment("RGUI")
    # fie fac ceva cu ea, fie o sa intre in fata in lista de comenzi, pun informatiile in env si le folosesc mai tarziu
}

env$RGUI_scrollobj <- function(...) {
    env <- as.environment("RGUI")
    x <- list(...)
    # o sa intre in fata in lista de comenzi, pun informatiile in env si le folosesc mai tarziu
    scrollvh <- lapply(x$scrollvh, function(x) unlist(x) + 1)
    env$RGUI_visiblerows <- x$RGUI_visiblerows + 1
    env$RGUI_visiblecols <- x$RGUI_visiblecols + 1

    if (!x$alldata) {
        scrollvh <- scrollvh[x$dataset]
    }

    tosend <- vector(mode = "list", length = length(scrollvh))
    names(tosend) <- names(scrollvh)
    
    for (n in names(scrollvh)) {
        dimdata <- dim(.GlobalEnv[[n]])
        nrowd <- dimdata[1]
        ncold <- dimdata[2]
        
        dscrollvh <- scrollvh[[n]]
        srow <- min(dscrollvh[1], nrowd - min(nrowd, x$RGUI_visiblerows) + 1)
        scol <- min(dscrollvh[2], ncold - min(ncold, x$RGUI_visiblecols) + 1)
        erow <- min(srow + x$RGUI_visiblerows, nrowd)
        ecol <- min(scol + x$RGUI_visiblecols, ncold)
        
        tosend[[n]] <- list(
            vdata = unname(as.list(.GlobalEnv[[n]][seq(srow, erow), seq(scol, ecol), drop = FALSE])),
            vcoords = paste(srow, scol, erow, ecol, ncold, sep = "_"),
            scrollvh = c(srow, scol) - 1
        )
    }
    
    env$RGUI_result <- c(env$RGUI_result, env$RGUI_jsonify(list(scrolldata = tosend)))
}

# TO DO: replace scrollvh as an argument with scrollvh from env
env$RGUI_infobjs <- function(objtype) {
    env <- as.environment("RGUI")
    funargs <- lapply(match.call(), deparse)
    
    visiblerows <- env$RGUI_visiblerows
    visiblecols <- env$RGUI_visiblecols

    toreturn <- list()
    
    if (any(objtype > 0)) {
        if (any(objtype == 1)) { # data frames
            toreturn$dataframe <- lapply(names(objtype[objtype == 1]), function(n) {

                dscrollvh <- c(1, 1)

                if (is.element(n, names(env$RGUI_scrollvh))) {
                    dscrollvh <- env$RGUI_scrollvh[[n]]
                }

                nrowd <- nrow(.GlobalEnv[[n]])
                ncold <- ncol(.GlobalEnv[[n]])

                srow <- min(dscrollvh[1], nrowd - min(nrowd, visiblerows) + 1)
                scol <- min(dscrollvh[2], ncold - min(ncold, visiblecols) + 1)
                erow <- min(srow + visiblerows - 1, nrowd)
                ecol <- min(scol + visiblecols - 1, ncold)

                type <- sapply(.GlobalEnv[[n]], function(x) {
                    decv <- declared::is_declared(x)
                    datv <- inherits(x, "Date")
                    numv <- env$RGUI_possibleNumeric(x) & !datv
                    chav <- is.character(x) & !numv
                    facv <- is.factor(x) & !numv
                    calv <- binv <- FALSE
                    if (numv) {
                        attributes(x) <- NULL
                        x <- na.omit(env$RGUI_asNumeric(x))
                        if (length(x) > 0) {
                            calv <- all(x >= 0 & x <= 1)
                            binv <- all(is.element(x, 0:1))
                        }
                    }
                    return(c(numv, calv, binv, chav, facv, datv, decv))
                })

                rnms <- rownames(.GlobalEnv[[n]])
                if (all(is.element(rnms, as.character(seq(length(rnms)))))) {
                    rnms <- c()
                }

                return(list(
                    nrows = nrowd,
                    ncols = ncold,
                    rownames = rnms,
                    colnames = colnames(.GlobalEnv[[n]]),
                    numeric = as.vector(type[1, ]),
                    calibrated = as.vector(type[2, ]),
                    binary = as.vector(type[3, ]),
                    character = as.vector(type[4, ]),
                    factor = as.vector(type[5, ]),
                    date = as.vector(type[6, ]),
                    declared = as.vector(type[7, ]),
                    scrollvh = c(srow, scol) - 1, # for Javascript
                    vdata = unname(as.list(.GlobalEnv[[n]][seq(srow, erow), seq(scol, ecol), drop = FALSE])),
                    vcoords = paste(srow, scol, erow, ecol, ncol(.GlobalEnv[[n]]), sep = "_")
                ))
                # scrollvh = c(srow, scol, min(visiblerows, nrow(x)), min(visiblecols, ncol(x))) - 1,
                # vcoords = paste(c(srow, scol, erow, ecol, ncol(x)) - 1, collapse="_")
            })
            names(toreturn$dataframe) <- names(objtype[objtype == 1])
        }

        if (any(objtype == 2)) {
            toreturn$list <- names(objtype[objtype == 2])
        }

        if (any(objtype == 3)) {
            toreturn$matrix <- names(objtype[objtype == 3])
        }

        if (any(objtype == 4)) {
            toreturn$vector <- names(objtype[objtype == 4])
        }

        # toreturn <- list(toreturn)
        # names(toreturn) <- funargs$objtype

        # env$RGUI_result <- c(env$RGUI_result, RGUI_jsonify(toreturn))
    }

    return(toreturn)
}

env$RGUI_ChangeLog <- function(x) {
    env <- as.environment("RGUI")
    # TODO: verify if file ChangeLog exists
    changes <- gsub("`", "'", readLines(system.file("ChangeLog", package = x)))
    env$RGUI_result <- c(env$RGUI_result, RGUI_jsonify(list(changes = changes)))
}

env$RGUI_packages <- function(x) { # x contains the packages, as known by the webpage
    env <- as.environment("RGUI")
    attached <- data()$results[, -2]
    packages <- unique(attached[, "Package"])

    if (!identical(sort(packages), sort(x))) {
        # available <- suppressWarnings(data(package = .packages(all.available = TRUE)))$results[, -2]
        
        attached <- lapply(packages, function(x) {
            x <- attached[attached[, "Package"] == x, 2:3, drop = FALSE]
            x <- x[x[, 2] != "Internal Functions", , drop = FALSE] # to eliminate internal datasets in the QCA package
            
            if (nrow(x) == 0) return(list())
            
            titles <- as.list(x[, 2])
            names(titles) <- x[, 1]
            return(titles) # [1:2]
        })
        names(attached) <- packages
        env$RGUI_result <- c(env$RGUI_result, env$RGUI_jsonify(list(packages = attached)))
    }
}

env$RGUI_dependencies <- function(x) { # x contains the packages, as known by the webpage
    env <- as.environment("RGUI")
    installed <- unlist(lapply(x, function(x) {
        if (identical(tryCatch(unlist(packageVersion(x)), error = function(e) return(0)), 0)) {
            return(FALSE)
        }
        return(TRUE)
    }))
    
    if (any(!installed)) {
        env$RGUI_result <- c(env$RGUI_result, env$RGUI_jsonify(list(missing = x[!installed])))
    }
}

env$RGUI_editorsize <- function(visiblerows, visiblecols) {
    env <- as.environment("RGUI")
    env$RGUI_visiblerows <- visiblerows
    env$RGUI_visiblecols <- visiblecols
}

env$RGUI_import <- function(objlist) {

    #---------------------------------
    # cut seems to be a unix command, not available on winows
    # however there is a windows port to many such utilities:
    # http://gnuwin32.sourceforge.net/packages/coreutils.htm
    #---------------------------------

    env <- as.environment("RGUI")
    # callist <- list(file = pipe(paste("cut -f1-8 -d','", objlist$file)))
    callist <- list(file = pipe(paste("cut -f1-8 -d','", paste0("'", objlist$file, "'"))))
    command <- objlist$command
    objlist$file <- NULL
    objlist$command <- NULL
    callist <- c(callist, objlist)
    obj <- do.call(command, callist)

    obj <- obj[seq(min(nrow(obj), 8)), seq(min(ncol(obj), 8)), drop = FALSE]

    imported <- list(
        rownames = rownames(obj),
        colnames = colnames(obj),
        vdata = unname(as.list(obj))
    )

    env$RGUI_result <- c(env$RGUI_result, RGUI_jsonify(list(imported = imported)))
}

env$RGUI_call <- function() {
    env <- as.environment("RGUI")

    toreturn <- list()
    
    objtype <- unlist(lapply(.GlobalEnv, function(x) {
        if (is.data.frame(x)) { # dataframes
            return(1)
        }
        else if (is.list(x) & !is.data.frame(x)) { # lists but not dataframes
            return(2)
        }
        else if (is.matrix(x)) { # matrices
            return(3)
        }
        else if (is.vector(x) & !is.list(x)) { # vectors
            return(4)
        }
        return(0)
    }))
    
    objtype <- objtype[order(names(objtype))]

    hashes <- unlist(lapply(.GlobalEnv, digest::digest)) # current objects
    hashes <- hashes[order(names(hashes))]

    if (length(objtype) > 0) {
        hashes <- hashes[objtype > 0]
        objtype <- objtype[objtype > 0]
    }

    deleted <- FALSE
    changed <- FALSE

    if (length(hashes) > 0) {
        # cat(paste0("hashes: ", length(env$RGUI_hashes), "\n"))
        # print(env$RGUI_hashes)
        # print(hashes)
        if (length(env$RGUI_hashes) > 0) {
            # deleted <- setdiff(names(env$RGUI_hashes), names(hashes))
            deleted <- !is.element(names(env$RGUI_hashes), names(hashes))
            common <- is.element(names(hashes), names(env$RGUI_hashes))

            # cat(paste("common:", paste(names(hashes)[common], collapse = ","), "\n"))
            
            changed <- common & !is.element(hashes[common], env$RGUI_hashes[common])
            added <- !is.element(names(hashes), names(env$RGUI_hashes))
            changed <- changed | added
        } else {
            changed <- rep(TRUE, length(hashes))
        }
    }
    else {
        if (length(env$RGUI_hashes) > 0) {
            deleted <- rep(TRUE, length(env$RGUI_hashes))
        }
    }

    if (any(changed)) {
        # cat(paste("changed:", paste(names(hashes)[changed], collapse = ","), "\n"))
        toreturn$changed <- env$RGUI_infobjs(objtype[changed])
    }

    if (any(deleted)) {
        objdel <- env$RGUI_objtype[deleted]
        deleted <- list()
        if (any(objdel == 1)) {
            deleted$dataframe <- names(objdel)[objdel == 1]
        }
        if (any(objdel == 2)) {
            deleted$list <- names(objdel)[objdel == 2]
        }
        if (any(objdel == 3)) {
            deleted$matrix <- names(objdel)[objdel == 3]
        }
        if (any(objdel == 4)) {
            deleted$vector <- names(objdel)[objdel == 4]
        }

        toreturn$deleted <- deleted
        # env$RGUI_result <- c(env$RGUI_result, RGUI_jsonify(list(deleted = deleted)))
    }

    env$RGUI_hashes <- hashes # overwrite the hash information
    env$RGUI_objtype <- objtype

    return(toreturn)
}

env$RGUI_tryCatchWEM <- function(evalparsed) {
    # modified version of http://stackoverflow.com/questions/4948361/how-do-i-save-warnings-and-errors-as-output-from-a-function
    toreturn <- list()
    
    output <- withVisible(withCallingHandlers(
        tryCatch(evalparsed, error = function(e) {
            toreturn$error <<- e$message
            NULL
        }), warning = function(w) {
            toreturn$warning <<- c(toreturn$warning, w$message)
            invokeRestart("muffleWarning")
        }, message = function(m) {
            toreturn$message <<- c(toreturn$message, m$message)
            invokeRestart("muffleMessage")
        }
    ))

    if (output$visible && !is.null(output$value)) {
        toreturn$visible <- output$value
    } else {
        toreturn$visible <- c()
    }
    
    return(toreturn)
}

env$RGUI_insideBrackets <- function(x, type = "[", invert = FALSE) {
    x <- recreate(substitute(x))
    typematrix <- matrix(c("{", "[", "(", "}", "]", ")", "{}", "[]", "()"), nrow = 3)
    
    tml <- which(typematrix == type, arr.ind = TRUE)[1]

    if (is.na(tml)) {
        tml <- 1
    }
    
    tml <- typematrix[tml, 1:2]
    result <- gsub(paste("\\", tml, sep = "", collapse = "|"), "",
        regmatches(x, gregexpr(paste("\\", tml, sep = "", collapse = "[[:alnum:]|,]*"), x), invert = invert)[[1]])
    # return(trimstr(result[result != ""]))
    result <- gsub("\\*|\\+", "", unlist(strsplit(gsub("\\s+", " ", result), split = " ")))
    return(result[result != ""])
}

env$RGUI_evalparse <- function(foo) {
    env <- as.environment("RGUI")

    evaluateit <- list()
    
    tocheck <- rep(c("\n", "@$%$@"), each = 3)
    names(tocheck) <- c("output", "view", "message", "warning", "error", "library")
    
    nextpos <- 1
    temptxt <- foo[1]
    parsem <- NULL
    
    for (i in seq_along(foo)) {
        endcom <- TRUE
        temp <- tryCatch(parse(text = temptxt), error = identity)
        
        if (inherits(temp, "error")) {
            if (any(unlist(lapply(continue, grepl, temp)))) {
                if (i < length(foo)) {
                    temptxt <- paste(foo[seq(nextpos, i + 1)], collapse = "\n")
                    endcom <- FALSE
                }
            }
        }
        
        if (endcom) {
            parsem <- c(parsem, temptxt)
            nextpos <- i + 1
            temptxt <- foo[nextpos]
        }
    }
    
    
    parsem_length <- length(parsem)
    
    evaluateit <- vector(mode = "list", length = parsem_length)
    recall <- vector(mode = "list", length = parsem_length)
    
    noerror <- TRUE
    i <- 1
    while (i <= length(parsem) & noerror) {

        evaluateit[[i]] <- list()
        
        sf <- srcfile("parsem[i]")
        temp <- tryCatch(parse(text = parsem[i], srcfile = sf), error = identity, warning = identity)
        
        if (inherits(temp, "error")) {
            gpd <- getParseData(sf)
            parsesplit <- parsem[i]
            if (any(gpd$token == "';'")) {
                pos <- c(0, gpd$col1[gpd$token == "';'"], nchar(parsem[i]) + 1)
                parsesplit <- c()
                for (p in seq(length(pos) - 1)) {
                    parsesplit <- c(parsesplit, substr(parsem[i], pos[p] + 1, pos[p + 1] - 1))
                }
            }
            
            errors <- logical(length(parsesplit))
            for (j in seq(length(parsesplit))) {
                errors[j] <- inherits(tryCatch(parse(text = parsesplit[j]), error = identity), "error")
            }
            
            # one of the commands (if more than one) surely gave an parse error, so stop there
            parsesplit <- parsesplit[seq(which(errors)[1])]
        }
        else {
            ### Incomplete, to deal with using environments and other arguments for eval()
            # pull text from eval(parse(
            ptfep <- function(x) {
                x <- unlist(strsplit(x, split = ""))
                
                what <- unlist(strsplit("eval(parse(text=", split = ""))
                counter <- length(what)
                
                while (counter > 0) {
                    if (x[1] == " ") {
                        x <- x[-1]
                    }
                    else {
                        if (x[1] == what[1]) {
                            x <- x[-1]
                            if (what[1] == "(") {
                                x <- x[-length(x)]
                            }
                            what <- what[-1]
                            counter <- counter - 1
                        }
                    }
                }
                
                x <- env$RGUI_trimstr(paste(x, collapse = ""))
                x <- gsub("^\\\"", "", x)
                x <- gsub("\\\"$", "", x)
                x <- gsub("\\\\\"", "\"", x)
                x <- env$RGUI_trimstr(x)
                
                if (grepl("^eval\\(parse\\(text=", gsub(" ", "", x))) {
                    return(Recall(x))
                }
                else {
                    x <- gsub("\\\\\"", "\"", x)
                    return(x)
                }
            }
            
            # not working because the function ptfep() above is not complete
            # if (grepl("^eval\\(parse\\(text=", gsub(" ", "", parsem[i]))) {
            #     
            #     parsem[i] <- ptfep(parsem[i]) # what happens when using environments?
            #
            #     # also, when using print(\"sdfsf\") within the text = ""
            #     # the print command is evaluated in the global environment and should be returned to the web console
            #     # so definitely not complete
            # }
            
            parsesplit <- as.character(parse(text = parsem[i]))
        }
        
        
        if (length(parsesplit) > 1) {
            # multiple commands on the same line
            recalsplit <- vector(mode = "list", length = length(parsesplit))
            
            for (j in seq(length(recalsplit))) {
                recalsplit[[j]] <- Recall(parsesplit[j])
                
                temp <- list()
                for (tc in names(tocheck)) {
                    tempcheck <- unlist(lapply(recalsplit[[j]], function(x) return(x[[tc]])))
                    if (!is.null(tempcheck)) {
                        temp[[tc]] <- paste(tempcheck, collapse = tocheck[[tc]])
                    }
                }
                
                recalsplit[[j]] <- temp
            }
            
            
            temp <- list()
            for (tc in names(tocheck)) {
                tempcheck <- unlist(lapply(recalsplit, function(x) return(x[[tc]])))
                if (!is.null(tempcheck)) {
                    temp[[tc]] <- paste(tempcheck, collapse = tocheck[[tc]])
                }
            }
            
            
            errors <- unlist(lapply(recalsplit, function(x) return("error" %in% names(x))))
            if (any(errors)) {
                temp$partial <- paste(paste(parsesplit[seq(which(errors)[1] - 1)], collapse = ";"), ";", sep="")
            }
            
            recall[[i]] <- temp
            
        } # not more than one command per line
        else {
            evaluateit[[i]][["source"]] <- grepl("^source\\(", gsub(" ", "", parsem[i]))
            if (evaluateit[[i]][["source"]]) {
                sourcefile <- gsub("\\\"", "", env$RGUI_insideBrackets(parsem[i], type = "("))
                
                if (file.exists(sourcefile)) {
                    sourcefile <- readLines(sourcefile, warn = FALSE)
                    temp <- tryCatch(parse(text = sourcefile), error = identity, warning = identity)
                    if (inherits(temp, "error")) {
                        errmsg <- temp$message
                        
                        if (grepl("<text>", errmsg)) {
                            errmsg <- unlist(strsplit(errmsg, split = "\n"))
                            errmsg[1] <- paste("in ", parsem[i], ": ", unlist(strsplit(errmsg[1], split = ": "))[2], sep = "")
                            if (!grepl("unexpected symbol", errmsg[1])) {
                                errmsg[length(errmsg)] <- substring(errmsg[length(errmsg)], 2)
                            }
                            errmsg <- paste(errmsg, collapse = "\n")
                        }
                        
                        recall[[i]] <- list(error = errmsg)
                        
                        noerror <- FALSE
                    }
                    else {
                        recall[[i]] <- Recall(sourcefile)
                        temp <- list()
                        for (tc in names(tocheck)) {
                            tempcheck <- unlist(lapply(recall[[i]], function(x) return(x[[tc]])))
                            if (!is.null(tempcheck)) {
                                temp[[tc]] <- paste(tempcheck, collapse = tocheck[[tc]])
                            }
                        }
                        recall[[i]] <- temp
                        
                        if (any(names(temp) == "error")) {
                            noerror <- FALSE
                        }
                    }
                }
                else {
                    errmsg <- paste(c("Error in file(filename, \"r\", encoding = encoding) : ",
                                        "   cannot open the connection",
                                        "In addition: Warning message:",
                                        "In file(filename, \"r\", encoding = encoding) :",
                                        paste("  cannot open file '", filename, "': No such file or directory", sep = "")),
                                    collapse = "\n")
                }
            }
            else {
                comnd <- parsem[i]
                
                object <- ""
                objerror <- FALSE
                toview <- FALSE
                lib <- FALSE
                
                if (grepl("^View\\(", gsub(" ", "", comnd))) {
                    object <- gsub("\\\"", "", env$RGUI_insideBrackets(comnd, type = "("))
                    if (object != "") {
                        if (exists(object, envir = ev)) {
                            if (is.data.frame(ev[[object]])) {
                                evaluateit[[i]][["view"]] <- object
                                toview <- TRUE
                            }
                            else {
                                objerror <- TRUE
                                evaluateit[[i]][["error"]] <- paste("The object to View (", object, ") is not a dataframe.", sep="")
                            }
                        }
                        # if the object does NOT exist, the error will be captured via eval()
                    }
                }
                
                
                if (!objerror & !toview) {
                    
                    if (length(temp <- tryCatchWEM(eval(parse(text = comnd), envir = ev))) > 0) {
                        # temp$call <- comnd
                        if (any(names(temp) == "warning")) {
                            temp$warning <- paste(paste("In", parsem[i], ":"), temp$warning, sep = "\n  ")
                        }
                        
                        if (any(names(temp) == "error")) {
                            temp$error <- paste("Error in", comnd, ":\n ", temp$error)
                        }
                        
                        evaluateit[[i]] <- temp
                    }
                }
                
                if (grepl("^library\\(", gsub(" ", "", comnd))) {
                    object <- gsub("\\\"", "", env$RGUI_insideBrackets(comnd, type = "("))
                    if (object != "") {
                        evaluateit[[i]][["library"]] <- object
                    }
                }
            }
        }
        
        if (!is.null(evaluateit[[i]][["error"]])) {
            noerror <- FALSE
        }
    
        
        if (length(recall[[i]]) > 0) {
            for (tc in names(tocheck)) {
                if (tc %in% names(recall[[i]])) {
                    if (any(tc %in% names(evaluateit[[i]]))) {
                        evaluateit[[i]][[tc]] <- paste(c(evaluateit[[i]][[tc]], recall[[i]][[tc]]), collapse = tocheck[[tc]])
                    }
                    else {
                        evaluateit[[i]][[tc]] <- paste(recall[[i]][[tc]], collapse = tocheck[[tc]])
                    }
                }
            }
            
            if ("partial" %in% names(recall[[i]])) {
                evaluateit[[i]][["partial"]] <- recall[[i]][["partial"]]
            }
            
            if ("library" %in% names(recall[[i]])) {
                evaluateit[[i]][["library"]] <- recall[[i]][["library"]]
            }
        }
        
            
        evaluateit[[i]][["continue"]] <- FALSE
        errmsg <- evaluateit[[i]][["error"]]
        if (!is.null(errmsg)) {
            if (any(unlist(lapply(continue, grepl, errmsg)))) {
                
                # this is necessary because parsem[i] can be a text that contains a parsing command
                # such as "parse(text = '1+')"
                # the command itself IS syntactically correct, even though it returns an error
                # as the result of the parsing of the text "1+"
                sf <- srcfile("parsem[i]")
                temp <- tryCatch(parse(text = parsem[i], srcfile = sf), error = identity, warning = identity)
                
                if (inherits(temp, "error")) {
                    # trigger continuation if and only if the command itself in parsem[i] is not complete
                    evaluateit[[i]][["continue"]] <- TRUE
                }
            }
            
            
            if (grepl("<text>", errmsg)) {
                errmsg <- unlist(strsplit(errmsg, split = "\n"))
                errmsg[1] <- paste("Error:", unlist(strsplit(errmsg[1], split = ": "))[2], "in:")
                if (!grepl("unexpected symbol", errmsg[1])) {
                    errmsg[length(errmsg)] <- substring(errmsg[length(errmsg)], 2)
                }
                errmsg <- paste(errmsg, collapse = "\n")
            }
            # else {
            #     if (!grepl("Error:", errmsg)) {
            #         errmsg <- paste("Error:", errmsg)
            #     }
            # }
            
            evaluateit[[i]][["error"]] <- errmsg
            
        }
        
        if (length(evaluateit[[i]][["output"]]) == 0) {
            evaluateit[[i]][["output"]] <- NULL
        }
        else {
            evaluateit[[i]][["output"]] <- paste(evaluateit[[i]][["output"]], collapse = "\n")
        }
        
        if (is.element("view", names(evaluateit[[i]]))) {
            views <- unlist(strsplit(evaluateit[[i]][["view"]], split = "\n"))
            evaluateit[[i]][["view"]] <- views[length(views)]
        }
        
        if (is.element("source", names(evaluateit[[i]]))) {
            if (evaluateit[[i]][["source"]]) {
                evaluateit[[i]][["continue"]] <- FALSE
            }
        }
    
        
        i <- i + 1
    }
    
    return(evaluateit)
}

rm(env, packages, installed, i)
