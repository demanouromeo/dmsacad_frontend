import { useEffect, useRef } from "react";
import { useToast } from "../toast/useToast";
import { useLanguage } from "../i18n/useLanguage";
import { connectivityTranslations } from "../i18n/translations";
import { MyConstants } from "../dbmanger/MyConstants";

const CHECK_INTERVAL_MS = 15_000;
const CHECK_TIMEOUT_MS = 5_000;

// Renders nothing - just runs a background heartbeat and reports outages/recovery via toast.
const ConnectivityMonitor = () => {
  const showToast = useToast();
  const [language] = useLanguage();
  const t = connectivityTranslations[language];
  const isReachableRef = useRef(true);

  useEffect(() => {
    const checkServer = async () => {
      if (!navigator.onLine) {
        if (isReachableRef.current) {
          isReachableRef.current = false;
          showToast(t.offline, { type: "danger" });
        }
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
      try {
        await fetch(`${MyConstants.getBaseUrl()}api/configs/allSchools`, {
          method: "GET",
          signal: controller.signal,
        });
        if (!isReachableRef.current) {
          isReachableRef.current = true;
          showToast(t.backOnline, { type: "info" });
        }
      } catch {
        if (isReachableRef.current) {
          isReachableRef.current = false;
          showToast(t.serverUnavailable, { type: "danger" });
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    checkServer();
    const intervalId = setInterval(checkServer, CHECK_INTERVAL_MS);

    const handleOffline = () => {
      if (isReachableRef.current) {
        isReachableRef.current = false;
        showToast(t.offline, { type: "danger" });
      }
    };
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default ConnectivityMonitor;
