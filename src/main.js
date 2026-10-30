import { render } from "preact";
import { html } from "htm/preact";
import { App } from "./app.js";

const root = document.getElementById("app");
if (!root) {
  throw new Error("#app not found");
}
render(html`<${App} />`, root);
