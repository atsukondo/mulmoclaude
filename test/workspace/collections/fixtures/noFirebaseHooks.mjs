// Module-resolution hooks that make `firebase` unresolvable, so an entry point
// can be loaded the way a consumer WITHOUT the optional peer sees it.
//
// A hook rather than a fixture node_modules tree: Node resolves a package from
// the importer's REAL path, so a temp directory that omits firebase still finds
// the copy this repository installed. Refusing the specifier is the only way to
// reproduce "firebase is not installed" from inside a checkout that has it.
//
// The message and `code` mirror Node's own, so a failure here reads the way the
// reported one does.

export function resolve(specifier, context, nextResolve) {
  if (specifier === "firebase" || specifier.startsWith("firebase/")) {
    const error = new Error(`Cannot find package 'firebase' imported from ${context.parentURL}`);
    error.code = "ERR_MODULE_NOT_FOUND";
    throw error;
  }
  return nextResolve(specifier, context);
}
