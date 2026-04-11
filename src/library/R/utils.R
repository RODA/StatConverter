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
    extract_values <- function(x) {
        labels_attr <- attr(x, "labels", exact = TRUE)
        labels_fun <- tryCatch(labels(x), error = function(e) NULL)
        labels <- labels_attr

        if (is.null(labels) || length(labels) == 0) {
            labels <- labels_fun
        }

        if (is.null(labels) || length(labels) == 0) {
            return(list())
        }

        if (is.data.frame(labels)) {
            nms <- tolower(names(labels))
            vals_col <- NULL
            labs_col <- NULL

            if (is.element("value", nms)) vals_col <- labels[[which(nms == "value")[1]]]
            if (is.element("values", nms)) vals_col <- labels[[which(nms == "values")[1]]]
            if (is.element("label", nms)) labs_col <- labels[[which(nms == "label")[1]]]
            if (is.element("labels", nms)) labs_col <- labels[[which(nms == "labels")[1]]]
            if (is.null(vals_col) && ncol(labels) >= 1) vals_col <- labels[[1]]
            if (is.null(labs_col) && ncol(labels) >= 2) labs_col <- labels[[2]]

            values <- as.character(unname(vals_col))
            names(values) <- as.character(unname(labs_col))
        } else {
            values <- as.character(unname(labels))
            names(values) <- as.character(names(labels))
        }

        named_values <- as.list(names(values))
        names(named_values) <- unname(values)
        return(named_values)
    }

    # Preview only needs labels, formats, and variable annotations; type inference
    # is expensive on wide files and is not consumed by the UI.
    meta <- collectRMetadata(dataset, infer_type = FALSE)
    return(lapply(
        names(meta),
        function(varname) {
            x <- meta[[varname]]
            variable <- dataset[[varname]]

            x$values <- extract_values(variable)
            x$selected <- list(TRUE)

            if (is.null(x$label)) {
                x$label <- attr(variable, "label", exact = TRUE)
            }

            return(x)
        }
    ) |> stats::setNames(names(meta)))
}

# Hide the helper reference symbol to avoid polluting the workspace
rm(env)
