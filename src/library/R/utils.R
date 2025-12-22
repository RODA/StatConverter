# Attach a dedicated helper environment to keep functions off .GlobalEnv
if (!is.element("StatConverter", search())) {
    attach(NULL, name = "StatConverter")
}

env <- as.environment("StatConverter")

## Debug logging to the user's home directory
# .sc_log_file <- file.path(path.expand("~"), "statconverter-debug.log")
# .sc_log <- function(...) {
#     ts <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
#     cat(ts, "|", ..., "\n", file = .sc_log_file, append = TRUE, sep = "")
# }

env$run_cmd <- local({
    mp_env <- as.environment("StatConverter")
    function(cmd, return = TRUE) {
        # .sc_log("run_cmd input: ", cmd)
        tc <- tryCatch({
            ex <- parse(text = cmd)
            # .sc_log("parsed expressions: ", length(ex))

            # Evaluate all expressions; keep the value of the last one
            val <- NULL
            if (isTRUE(return)) {
                for (i in seq_along(ex)) {
                    # .sc_log("eval expr ", i, ": ", deparse(ex[[i]]))
                    val <- eval(ex[[i]], envir = mp_env)
                }

                # Heuristic: if the last top-level expression is an assignment, suppress result
                last <- ex[[length(ex)]]
                if (is.call(last) && identical(as.character(last[[1]]), "<-")) {
                    val <- NULL
                }
                # also handle "=" assignment at top-level (rare, but possible)
                if (is.call(last) && identical(as.character(last[[1]]), "=")) {
                    val <- NULL
                }
            } else {
                for (i in seq_along(ex)) {
                    # .sc_log("eval expr (no return) ", i, ": ", deparse(ex[[i]]))
                    eval(ex[[i]], envir = mp_env)
                }
            }

            # .sc_log("run_cmd ok")
            list(ok = TRUE, result = val)
        }, error = function(e) {
            # .sc_log("run_cmd error: ", conditionMessage(e))
            list(ok = FALSE, error = conditionMessage(e))
        })

        jsonlite::toJSON(
            tc,
            auto_unbox = TRUE,
            null = "null"
        )
    }
})

env$dataset_metadata <- function() {
    return(lapply(
        collectRMetadata(dataset),
        function(x) {
            values <- names(x$labels)
            names(values) <- x$labels
            x$values <- as.list(values)
            return(x)
        }
    ))
}

# Hide the helper reference symbol to avoid polluting the workspace
rm(env)
