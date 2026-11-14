import React from "react";
import { createRoot } from "react-dom/client";
import GameShell from "./opening/GameShell";
import {PhoneCompanionScreen} from "./companion";
import OfflineStatus from "./ui/OfflineStatus";
import { registerOfflineSupport } from "./services/offline";
void registerOfflineSupport();
import "./ui/styles.css";
import "./ui/immersive.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has('cameraCompanion')?<PhoneCompanionScreen/>:<GameShell />}
    <OfflineStatus />
  </React.StrictMode>,
);
