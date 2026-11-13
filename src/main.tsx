import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import OfflineStatus from "./ui/OfflineStatus";
import { registerOfflineSupport } from "./services/offline";
void registerOfflineSupport();
import "./ui/styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <OfflineStatus />
  </React.StrictMode>,
);
