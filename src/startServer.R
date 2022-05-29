
attach(NULL, name = "RGUI") 
env <- as.environment("RGUI")

env$RGUI_dependencies <- function() {
    packages <- c("admisc", "DDIwR", "jsonlite", "httpuv")
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
    else {
        cat("_dependencies_ok_\n")
    }

    toreturn$variables = c();

    cat(paste(
        jsonlite::toJSON(toreturn), "\n",
        collapse = "", sep = ""
    ))

}

env$RGUI_parseCommand <- function(command) {
    # cat(command, "\n")
    toreturn <- admisc::tryCatchWEM(
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
