import React from "react";
import { createRoot } from "react-dom/client";
import TowerRoot from "./tower/TowerRoot";
import {PhoneCompanionScreen} from "./companion";
import OfflineStatus from "./ui/OfflineStatus";
import { registerOfflineSupport } from "./services/offline";
void registerOfflineSupport();
import "./ui/styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has('cameraCompanion')?<PhoneCompanionScreen/>:<TowerRoot />}
    <OfflineStatus />
  </React.StrictMode>,
);
