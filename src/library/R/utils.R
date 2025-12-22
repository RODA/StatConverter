# Attach a dedicated helper environment to keep functions off .GlobalEnv
if (!is.element("StatConverter", search())) {
    attach(NULL, name = "StatConverter")
}

env <- as.environment("StatConverter")

env$run_cmd <- function(cmd, return = TRUE) {
    env <- as.environment("StatConverter")
    jsonlite::toJSON(
        tryCatch({
            ex <- parse(text = cmd)
            for (i in seq_along(ex)) {
                eval(ex[[i]], envir = env)
            }
            list(ok = TRUE, result = NULL)
        }, error = function(e) {
            list(ok = FALSE, error = conditionMessage(e))
        }),
        auto_unbox = TRUE,
        null = "null"
    )
}

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
