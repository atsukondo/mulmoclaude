// `--import` entry that installs the hooks next door. A separate file because
// `register()` loads its hooks module on another thread: pointing it at this
// file would run the registration again there.

import { register } from "node:module";

register(new URL("./noFirebaseHooks.mjs", import.meta.url));
