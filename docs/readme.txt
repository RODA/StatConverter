CHANGES IN R VERSION 2.15.1:

  NEW FEATURES:

    o source() now uses withVisible() rather than
      .Internal(eval.with.vis).  This sometimes alters tracebacks
      slightly.

    o install.packages("pkg_version.tgz") on Mac OS X now has sanity
      checks that this is actually a binary package (as people have
      tried it with incorrectly named source packages).

    o splineDesign() and spline.des() in package splines have a new
      option sparse which can be used for efficient construction of a
      sparse B-spline design matrix (_via_ Matrix).

    o norm() now allows type = "2" (the 'spectral' or 2-norm) as well,
      mainly for didactical completeness.

    o pmin() and pmax()) now also work when one of the inputs is of
      length zero and others are not, returning a zero-length vector,
      analogously to, say, +.

    o colorRamp() (and hence colorRampPalette()) now also works for the
      boundary case of just one color when the ramp is flat.

    o qqline() has new optional arguments distribution, probs and
      qtype, following the example of lattice's panel.qqmathline().

    o .C() gains some protection against the misuse of character vector
      arguments.  (An all too common error is to pass character(N),
      which initializes the elements to "", and then attempt to edit
      the strings in-place, sometimes forgetting to terminate them.)

    o Calls to the new function globalVariables() in package utils
      declare that functions and other objects in a package should be
      treated as globally defined, so that CMD check will not note
      them.

    o print(packageDescription(*)) trims the Collate field by default.

    o The included copy of zlib has been updated to version 1.2.7.

    o A new option "show.error.locations" has been added.  When set to
      TRUE, error messages will contain the location of the most recent
      call containing source reference information. (Other values are
      supported as well; see ?options.)

    o The NA warning messages from e.g. pchisq() now report the call to
      the closure and not that of the .Internal.

    o Added Polish translations by <c5><81>ukasz Daniel.

  PERFORMANCE IMPROVEMENTS:

    o In package parallel, makeForkCluster() and the multicore-based
      functions use native byte-order for serialization (deferred from
      2.15.0).

    o lm.fit(), lm.wfit(), glm.fit() and lsfit() do less copying of
      objects, mainly by using .Call() rather than .Fortran().

    o .C() and .Fortran() do less copying: arguments which are raw,
      logical, integer, real or complex vectors and are unnamed are not
      copied before the call, and (named or not) are not copied after
      the call.  Lists are no longer copied (they are supposed to be
      used read-only in the C code).

    o tabulate() makes use of .C(DUP = FALSE) and hence does not copy
      bin.  (Suggested by Tim Hesterberg.)  It also avoids making a
      copy of a factor argument bin.

    o Other functions (often or always) doing less copying include
      cut(), dist(), the complex case of eigen(), hclust(), image(),
      kmeans(), loess(), stl() and svd(LINPACK = TRUE).

    o There is less copying when using primitive replacement functions
      such as names(), attr() and attributes().

  DEPRECATED AND DEFUNCT:

    o The converters for use with .C() (see ?getCConverterDescriptions)
      are deprecated: use the .Call() interface instead.  There are no
      known examples (they were never fully documented).

  UTILITIES:

    o For R CMD check, a few people have reported problems with
      junctions on Windows (although they were tested on Windows 7, XP
      and Server 2008 machines and it is unknown under what
      circumstances the problems occur).  Setting the environment
      variable R_WIN_NO_JUNCTIONS to a non-empty value (e.g. in
      ~/.R/check.Renviron) will force copies to be used instead.

  INSTALLATION:

    o R CMD INSTALL with _R_CHECK_INSTALL_DEPENDS_ set to a true value
      (as done by R CMD check --as-cran) now restricts the packages
      available when lazy-loading as well as when test-loading (since
      packages such as ETLUtils and agsemisc had top-level calls to
      library() for undeclared packages).

      This check is now also available on Windows.

  C-LEVEL FACILITIES:

    o C entry points mkChar and mkCharCE now check that the length of
      the string they are passed does not exceed 2^31-1 bytes: they
      used to overflow with unpredictable consequences.

    o C entry points R_GetCurrentSrcref and R_GetSrcFilename have been
      added to the API to allow debuggers access to the source
      references on the stack.

  WINDOWS-SPECIFIC CHANGES:

    o Windows-specific changes will now be announced in this file
      (NEWS).  Changes up and including R 2.15.0 remain in the CHANGES
      file.

    o There are two new environment variables which control the
      defaults for command-line options.

      If R_WIN_INTERNET2 is set to a non-empty value, it is as if
      --internet2 was used.

      If R_MAX_MEM_SIZE is set, it gives the default memory limit if
      --max-mem-size is not specified: invalid values being ignored.

  BUG FIXES:

    o lsfit() lost the names from the residuals.

    o More cases in which merge() could create a data frame with
      duplicate column names now give warnings.  Cases where names
      specified in by match multiple columns are errors.

    o Nonsense uses such as seq(1:50, by = 5) (from package plotrix)
      and seq.int(1:50, by = 5) are now errors.

    o The residuals in the 5-number summary printed by summary() on an
      "lm" object are now explicitly labelled as weighted residuals
      when non-constant weights are present.  (Wish of PR#14840.)

    o tracemem() reported that all objects were copied by .C() or
      .Fortran() whereas only some object types were ever copied.

      It also reported and marked as copies _some_ transformations such
      as rexp(n, x): it no longer does so.

    o The plot() method for class "stepfun" only used the optional xval
      argument to compute xlim and not the points at which to plot (as
      documented).  (PR#14864)

    o Names containing characters which need to be escaped were not
      deparsed properly.  (PR#14846)

    o Trying to update (recommended) packages in R_HOME/library without
      write access is now dealt with more gracefully.  Further, such
      package updates may be skipped (with a warning), when a newer
      installed version is already going to be used from .libPaths().
      (PR#14866)

    o hclust() is now fast again (as up to end of 2003), with a
      different fix for the "median"/"centroid" problem.  (PR#4195).

    o get_all_vars() failed when the data came entirely from vectors in
      the global environment. (PR#14847)

    o R CMD check with _R_CHECK_NO_RECOMMENDED_ set to a true value (as
      done by the --as-cran option) could issue false errors if there
      was an indirect dependency on a recommended package.

    o formatC() uses the C entry point str_signif which could write
      beyond the length allocated for the output string.

    o Missing default argument added to implicit S4 generic for
      backsolve(). (PR#14883)

    o Some bugs have been fixed in handling load actions that could
      fail to export assigned items or generate spurious warnings in
      CMD check on loading.

    o For tiff(type = "windows"), the numbering of per-page files
      except the last was off by one.

    o On Windows, loading package stats (which is done for a default
      session) would switch line endings on stdout and stderr from CRLF
      to LF.  This affected Rterm and R CMD BATCH.

    o On Windows, the compatibility function x11() had not kept up with
      changes to windows(), and issued warnings about bad parameters.
      (PR#14880)

    o On Windows, the Sys.glob() function did not handle UNC paths as
      it was designed to try to do. (PR#14884)

    o In package parallel, clusterApply() and similar failed to handle
      a (pretty pointless) length-1 argument. (PR#14898)

    o Quartz Cocoa display reacted asynchronously to dev.flush() which
      means that the redraw could be performed after the plot has been
      already modified by subsequent code. The redraw is now done
      synchronously in dev.flush() to allow animations without sleep
      cycles.

    o Source locations reported in traceback() were incorrect when
      byte-compiled code was on the stack.

    o plogis(x, lower = FALSE, log.p = TRUE) no longer underflows early
      for large x (e.g. 800).

    o ?Arithmetic's "1 ^ y and y ^ 0 are 1, _always_" now also applies
      for integer vectors y.

    o X11-based pixmap devices like png(type = "Xlib") were trying to
      set the cursor style, which triggered some warnings and hangs.

    o Code executed by the built-in HTTP server no longer allows other
      HTTP clients to re-enter R until the current worker evaluation
      finishes, to prevent cascades.

    o The plot() and Axis() methods for class "table" now respect
      graphical parameters such as cex.axis.  (Reported by Martin
      Becker.)

    o Under some circumstances package.skeleton() would give out
      progress reports that could not be translated and so were
      displayed by question marks.  Now they are always in English.
      (This was seen for CJK locales on Windows, but may have occurred
      elsewhere.)

    o The evaluator now keeps track of source references outside of
      functions, e.g. when source() executes a script.

    o The replacement method for window() now works correctly for
      multiple time series of class "mts".  (PR#14925)

    o is.unsorted() gave incorrect results on non-atomic objects such
      as data frames.  (Reported by Matthew Dowle.)

    o The value returned by tools::psnice() for invalid pid values was
      not always NA as documented.

    o Closing an X11() window while locator() was active could abort
      the R process.

    o getMethod(f, sig) produced an incorrect error message in some
      cases when f was not a string).

    o Using a string as a "call" in an error condition with
      options(showErrorCalls=TRUE) could cause a segfault.  (PR#14931)

    o The string "infinity" allowed by C99 was not accepted as a
      numerical string value by e.g. scan() and as.character().
      (PR#14933)

    o In legend(), setting some entries of lwd to NA was inconsistent
      (depending on the graphics device) in whether it would suppress
      those lines; now it consistently does so.  (PR#14926)

    o by() failed for a zero-row data frame.  (Reported by Weiqiang
      Qian)

    o Yates correction in chisq.test() could be bigger than the terms
      it corrected, previously leading to an infinite test statistic in
      some corner cases which are now reported as NaN.

    o xgettext() and related functions sometimes returned items that
      were not strings for translation. (PR#14935)

    o plot(<lm>, which=5) now correctly labels the factor level
      combinations for the special case where all h[i,i] are the same.
      (PR#14837)
