import { register } from "node:module"; import { pathToFileURL } from "node:url";
register("./stub.mjs", pathToFileURL("./app/"));
