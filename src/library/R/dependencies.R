packages <- c(
    "jsonlite",
    "DDIwR",
    "admisc",
    "declared"
)

missing <- vapply(
    packages,
    function(x) {
        !isTRUE(tryCatch(requireNamespace(x, quietly = TRUE), error = function(e) FALSE))
    },
    logical(1)
)

if (any(missing)) {
    miss <- as.list(names(missing)[missing])

    if (!isTRUE(missing[["jsonlite"]])) {
        cat(
            jsonlite::toJSON(
                list(
                    type = "init",
                    status = "error",
                    missing = miss
                ),
                auto_unbox = TRUE
            ),
            "\n",
            sep = ""
        )
    } else {
        cat("{\"type\":\"init\",\"status\":\"error\",\"missing\":[\"jsonlite\"]}\n", sep = "")
    }
} else {
    suppressPackageStartupMessages({
        library(jsonlite)
        library(DDIwR)
    })

    appdirname <- tryCatch(
        dirname(normalizePath(sys.frames()[[1]]$ofile)),
        error = function(e) ""
    )

    if (
        is.null(appdirname) ||
        !nzchar(trimws(appdirname)) ||
        !file.exists(file.path(appdirname, "utils.R"))
    ) {
        wd <- getwd()
        candidates <- c(
            file.path(wd, "src", "library", "R"),
            wd
        )

        for (d in candidates) {
            if (file.exists(file.path(d, "utils.R"))) {
                appdirname <- d
                break
            }
        }
    }

    src_error <- NULL
    tryCatch(
        source(file.path(appdirname, "utils.R")),
        error = function(e) {
            src_error <<- e
        }
    )

    if (!is.null(src_error)) {
        cat(
            jsonlite::toJSON(
                list(
                    type = "init",
                    status = "error",
                    message = paste(
                        "Failed to source utils.R:",
                        conditionMessage(src_error)
                    )
                ),
                auto_unbox = TRUE
            ),
            "\n",
            sep = ""
        )
    } else {
        cat(
            jsonlite::toJSON(
                list(
                    type = "init",
                    status = "ok"
                ),
                auto_unbox = TRUE
            ),
            "\n",
            sep = ""
        )
    }
}

rm(packages, missing)

flush(stdout())
invisible(NULL)
