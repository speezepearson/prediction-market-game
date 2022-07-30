import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { LocalServer } from "./local_server";

import "./index.css";

const ownName = "Alice";
const conn = new LocalServer(ownName, {
  balances: { Alice: 100, Bob: 100 },
  phase: {
    t: "lobby",
    lastRoundWinnings: null,
  },
});

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <App ownName={ownName} conn={conn} />
  </React.StrictMode>
);
