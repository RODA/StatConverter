
attach(NULL, name = "RGUI")
env <- as.environment("RGUI")

env$RGUI_tryCatchWEM <- function(expr, capture = FALSE) {
    #' modified version of http://stackoverflow.com/questions/4948361/how-do-i-save-warnings-and-errors-as-output-from-a-function
    
    toreturn <- list()
    output <- withVisible(withCallingHandlers(
        tryCatch(expr, error = function(e) {
            toreturn$error <<- e$message
            NULL
        }),
        warning = function(w) {
            toreturn$warning <<- c(toreturn$warning, w$message)
            invokeRestart("muffleWarning")
        },
        message = function(m) {
            toreturn$message <<- paste(toreturn$message, m$message, sep = "")
            invokeRestart("muffleMessage")
        }
    ))
    
    if (capture && output$visible && !is.null(output$value)) {
        toreturn$output <- capture.output(output$value)
        toreturn$value <- output$value
    }
    
    if (length(toreturn) > 0) {
        return(toreturn)
    }
}

env$RGUI_dependencies <- function() {
    packages <- c("jsonlite", "admisc", "declared", "DDIwR")
    installed <- logical(length(packages))

    for (i in seq(length(packages))) {
        toreturn <- RGUI_tryCatchWEM(loadNamespace(packages[i]))
        installed[i] <- is.null(toreturn$error)

        # cat(paste(packages[i], "installed:", ifelse(installed[i], TRUE, FALSE), "\n"))
        if (installed[i]) {
            toreturn <- RGUI_tryCatchWEM(
                library(packages[i], character.only = TRUE)
            )
        }
        else {
            error <- unlist(strsplit(toreturn$error, split = "R_Portable"))
            if (grepl("unable to load shared object ", error[1])) {
                path <- gsub("unable to load shared object '", "", error[1])
                toreturn$error <- gsub(path, "", toreturn$error)
            }
            
            break;
        }
    }
    

    if (is.null(toreturn)) {
        toreturn <- list(
            error = ""
        )
        
        if (sum(installed) < length(packages)) {
            toreturn$error <- paste(
                "Unable to load packages:",
                paste(packages[!installed], collapse = ", ")
            )
        }
        else {
            cat("_dependencies_ok_\n")
        }
    }

    toreturn$variables = c();

    cat("RGUIstartJSON\n")
    if (installed[1]) {
        cat(paste(
            jsonlite::toJSON(toreturn), "\n",
            collapse = "", sep = ""
        ))
    }
    else {
        cat("{\"error\":[\"Unable to load package jsonlite.\"]}\n")
    }
    cat("RGUIendJSON\n")

}

env$RGUI_parseCommand <- function(command) {
    # cat(command, "\n")
    toreturn <- RGUI_tryCatchWEM(
        eval(
            parse(text = command),
            envir = .GlobalEnv
        )
    )


    if (length(toreturn) == 0) {
        toreturn <- list(error = "")
    }

    if (is.null(toreturn$error)) {
        toreturn$error <- ""
    }
    # cat(paste0(paste(unlist(toreturn), collapse = "\n", "\n")))

    objects <- ls(envir = .GlobalEnv)
    # cat(paste(objects, collapse = "\n"), "\n")

    if (is.element("dataset", objects) & grepl("n_max", command)) {
        toreturn$variables <- RGUI_variables()
    }

    # print(toreturn)

    cat("RGUIstartJSON\n")
    cat(paste(
        jsonlite::toJSON(toreturn), "\n",
        collapse = "", sep = ""
    ))
    cat("RGUIendJSON\n")

}

env$RGUI_ChangeLog <- function(x) {
    env <- as.environment("RGUI")
    # TODO: verify if file ChangeLog exists
    changes <- gsub("`", "'", readLines(system.file("ChangeLog", package = x)))
    env$RGUI_result <- c(env$RGUI_result, RGUI_jsonify(list(changes = changes)))
}

env$RGUI_formatted <- FALSE
env$RGUI_hashes <- list()
env$RGUI_result <- c()

env$RGUI_variables <- function() {
    return(lapply(.GlobalEnv[["dataset"]], function(x) {
        values <- attr(x, "labels", exact = TRUE)
        tagged_na <- admisc::hasTag(values)

        if (any(tagged_na)) {
            values[tagged_na] <- paste0(".", admisc::getTag(values[tagged_na]))
        }

        na_values <- declared::missing_values(x)
        if (declared::is.declared(x) || is.element("haven_labelled_spss", class(x))) {
            if (is.null(na_values)) {
                na_range <- declared::missing_range(x)
                if (!is.null(na_range)) {
                    na_values <- as.numeric(values[values >= na_range[1] & values <= na_range[2]])
                }
            }
        }
        else if (is.element("haven_labelled", class(x))) {
            if (admisc::anyTagged(x)) {
                tagged_na <- admisc::getTag(x)
                na_values <- sort(unique(na.omit(tagged_na)))
            }
        }

        nms <- names(values)
        names(nms) <- values

        # print(values)

        return(list(
            label = attr(x, "label", exact = TRUE),
            values = as.list(nms),
            missing = as.character(na_values),
            selected = TRUE
        ))
    }))
}

rm(env)

cat("_server_started_\n")
