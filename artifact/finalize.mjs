// Turns Vite's single-file build into an Artifact page body: the publish step
// supplies <!doctype>/<html>/<head>/<body>, so we emit only the content, title first.
import fs from "node:fs";

const src = fs.readFileSync(new URL("./dist/index.html", import.meta.url), "utf8");
const head = src.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
const body = src.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? "";

const title = head.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? "<title>CRAVE</title>";
const links = head.match(/<link[^>]*>/g) ?? [];
const styles = head.match(/<style[^>]*>[\s\S]*?<\/style>/g) ?? [];
const scripts = head.match(/<script[\s\S]*?<\/script>/g) ?? [];
const classic = scripts.filter((s) => !/type="module"/.test(s));
const modules = [...scripts.filter((s) => /type="module"/.test(s)), ...(body.match(/<script[\s\S]*?<\/script>/g) ?? [])];
const markup = body.replace(/<script[\s\S]*?<\/script>/g, "").trim();

const out = [title, ...links, ...styles, markup, ...classic, ...modules].join("\n");
fs.writeFileSync(new URL("./dist/crave.html", import.meta.url), out);
console.log(`artifact/dist/crave.html: ${(out.length / 1024).toFixed(0)} KB`);
