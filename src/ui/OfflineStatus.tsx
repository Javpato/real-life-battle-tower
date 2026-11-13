import { useEffect, useState } from "react";
import { getOfflineStatus, subscribeOfflineStatus } from "../services/offline";
export default function OfflineStatus() {
  const [status, setStatus] = useState(getOfflineStatus);
  useEffect(() => subscribeOfflineStatus(setStatus), []);
  return !status.online ? (
    <div className="offline-banner" role="status">
      {status.message}
    </div>
  ) : null;
}
