/**
 * Vendored from github/codeql `js/file-access-to-http`
 * (javascript/ql/src/Security/CWE-200/FileAccessToHttp.ql) with one
 * project-specific barrier, per issue #79 ("vendor the ~15-line standard
 * query ... with a project-specific barrier on the confined upload
 * transport, making the exemption function-scoped (semantic) rather than
 * identity-scoped").
 *
 * The barrier: any taint that flows through a call to `readUploadFile`
 * (src/server.ts) is sanitized. That function is the confinement choke
 * point hardened in #76 — realpath upload-root confinement,
 * sensitive-location deny-list, extension allow-list, size cap — so data
 * emerging from it is by design allowed to reach the attachment-upload
 * fetch sink. Every OTHER file → HTTP flow still alerts, including a new
 * flow that reads files directly, and including the designed flow itself
 * if `readUploadFile` is ever renamed or bypassed (the barrier stops
 * matching → the alert returns). The exemption therefore travels with the
 * function, not with a line number or a dismissed alert identity.
 *
 * The stock query keeps running unchanged for the rest of the codebase
 * (its attachment-flow alert is dismissed once with a recorded reason);
 * this vendored copy runs alongside it under its own rule id.
 *
 * @name File data in outbound network request (confined uploads exempted)
 * @description Directly sending file data in an outbound network request can indicate unauthorized information disclosure, unless it passed through the confined upload reader.
 * @kind path-problem
 * @problem.severity warning
 * @security-severity 6.5
 * @precision medium
 * @id js/file-access-to-http-unconfined
 * @tags security
 * external/cwe/cwe-200
 */

import javascript
import semmle.javascript.security.dataflow.FileAccessToHttpQuery
import FileAccessToHttpFlow::PathGraph
import FileAccessToHttpCustomizations::FileAccessToHttp

/**
 * Project barrier: the RESULT of a `readUploadFile(...)` call. Extending
 * the library's `Sanitizer` extension point means taint leaving the
 * confined reader never reaches the sink classification as file data —
 * the confinement inside the function is treated as the sanitizer.
 */
private class ConfinedUploadReaderResult extends Sanitizer {
  ConfinedUploadReaderResult() {
    exists(DataFlow::CallNode call |
      call.getACalleeName() = "readUploadFile" and
      this = call.getResult()
    )
  }
}

from FileAccessToHttpFlow::PathNode source, FileAccessToHttpFlow::PathNode sink
where FileAccessToHttpFlow::flowPath(source, sink)
select sink.getNode(), source, sink, "Outbound network request depends on $@.", source.getNode(),
  "file data"
