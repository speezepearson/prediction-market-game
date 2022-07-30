import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { LocalServer } from "./local_server";

const ownName = "Alice";
const conn = new LocalServer(ownName, {
  balances: { Alice: 10, Bob: 10 },
  phase: "lobby",
});

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <App ownName={ownName} conn={conn} />
  </React.StrictMode>
);
