
attach(NULL, name = "RGUI") 
env <- as.environment("RGUI")

env$RGUI_dependencies <- function() {
    packages <- c("admisc", "DDIwR", "jsonlite")
    installed <- logical(length(packages))
    for (i in seq(length(packages))) {
        installed[i] <- requireNamespace(packages[i], quietly = TRUE)
        if (installed[i]) {
            library(packages[i], character.only = TRUE)
        }
    }

    toreturn <- list(
        error = ""
    )

    if (sum(installed) < length(packages)) {
        toreturn$error <- paste(
            "Unable to load packages:",
            paste(packages[!installed], collapse = ", ")
        )
    }

    toreturn$variables = c();

    cat(paste(
        jsonlite::toJSON(toreturn), "\n",
        collapse = "", sep = ""
    ))

}

env$RGUI_parseCommand <- function(command) {
    toreturn <- admisc::tryCatchWEM(
        eval(
            parse(text = command),
            envir = .GlobalEnv
        )
    )

    # cat(paste0(paste(unlist(toreturn), collapse = "\n", "\n")))

    if (length(toreturn) == 0) {
        toreturn <- list(error = "")
    }
    
    if (is.null(toreturn$error)) {
        toreturn$error <- ""
    }

    objects <- ls(envir = .GlobalEnv)

    if (length(objects) > 0 & grepl("n_max", command)) {
        toreturn$variables <- admisc::tryCatchWEM(
            RGUI_variables(),
            capture = TRUE
        )$value

        # cat(paste(jsonlite::toJSON(list(start_vars = TRUE)), "\n", sep = ""))

        # for (i in seq(length(toreturn$variables))) {
        #     cat(paste(
        #         jsonlite::toJSON(toreturn$variables[i]), "\n",
        #         collapse = "", sep = ""
        #     ))
        # }

        # cat(paste(jsonlite::toJSON(list(end_vars = TRUE)), "\n", sep = ""))
    }
    

    cat(paste(
        jsonlite::toJSON(toreturn), "\n",
        collapse = "", sep = ""
    ))
    
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


env$RGUI_replaceTicks <- function(x) {
    # weird A character sometimes from SPSS encoding a single tick quote
    achar <- rawToChar(as.raw(c(195, 130)))
    # forward and back ticks
    irv <- c(194, 180, 96)
    tick <- unlist(strsplit(rawToChar(as.raw(irv)), split = ""))
    tick <- c(paste0(achar, "'"), paste0(achar, tick), tick)
    x <- gsub(paste(tick, collapse = "|"), "'", x)
    return(x)
}

env$RGUI_variables <- function() {
    return(lapply(.GlobalEnv[["dataset"]], function(x) {
        values <- attr(x, "labels", exact = TRUE)
        
        na_values <- declared::missing_values(x)
        if (is.null(na_values)) {
            na_range <- declared::missing_range(x)
            if (!is.null(na_range)) {
                na_values <- as.numeric(values[values >= na_range[1] & values <= na_range[2]])
            }
        }

        nms <- RGUI_replaceTicks(names(values))
        names(nms) <- values

        return(list(
            label = RGUI_replaceTicks(attr(x, "label", exact = TRUE)),
            values = as.list(nms),
            missing = as.character(na_values),
            selected = TRUE
        ))
    }))
}

rm(env)
