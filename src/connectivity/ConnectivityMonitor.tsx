import { useEffect, useRef } from "react";
import { useToast } from "../toast/useToast";
import { useLanguage } from "../i18n/useLanguage";
import { connectivityTranslations } from "../i18n/translations";
import { MyConstants } from "../dbmanger/MyConstants";
import { SERVER_UNREACHABLE_TOAST_GROUP } from "../toast/toastGroups";

// Timeout kept comfortably under the interval so a slow-but-alive check never overlaps the next
// tick's fetch. Generous enough to survive a heavy screen's own burst of concurrent requests (e.g.
// the report card screen's whole-section TH/RC export loops) queuing up ahead of this lightweight
// health-check on the local XAMPP backend - a short timeout here was flipping this to "offline"
// mid-export even though the export itself was succeeding, since it competes for the same limited
// backend for its own duration (a real outage still gets caught every tick, just with a slightly
// longer window before it's reported).
const CHECK_INTERVAL_MS = 25_000;
const CHECK_TIMEOUT_MS = 15_000;

// A single failed probe is not proof the server is down - a dropped packet, a momentary Wi-Fi
// hiccup, a browser throttling a background tab or a backend saturated by a burst of the app's own
// requests all produce one. The "unavailable" toast only fires after every probe attempt of a check
// failed (PROBE_ATTEMPTS, spaced PROBE_RETRY_DELAY_MS apart) on FAILED_CHECKS_BEFORE_ALERT
// consecutive checks, so only a sustained outage is reported.
const PROBE_ATTEMPTS = 3;
const PROBE_RETRY_DELAY_MS = 2_000;
const FAILED_CHECKS_BEFORE_ALERT = 2;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Any HTTP answer (even an error status) proves the server is reachable; only a thrown/aborted
// fetch counts as a failed attempt.
const probeServer = async (): Promise<boolean> => {
  for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      await fetch(`${MyConstants.getBaseUrl()}api/configs/allSchools`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      return true;
    } catch {
      if (attempt < PROBE_ATTEMPTS - 1) await sleep(PROBE_RETRY_DELAY_MS);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return false;
};

// Renders nothing - just runs a background heartbeat and reports outages/recovery via toast.
const ConnectivityMonitor = () => {
  const showToast = useToast();
  const [language] = useLanguage();
  const t = connectivityTranslations[language];
  const isReachableRef = useRef(true);
  const failedChecksRef = useRef(0);

  useEffect(() => {
    const checkServer = async () => {
      if (!navigator.onLine) {
        if (isReachableRef.current) {
          isReachableRef.current = false;
          showToast(t.offline, { type: "danger" });
        }
        return;
      }

      // Background tabs get their timers/network throttled, which looks like an outage.
      if (document.hidden) return;

      if (await probeServer()) {
        failedChecksRef.current = 0;
        if (!isReachableRef.current) {
          isReachableRef.current = true;
          showToast(t.backOnline, { type: "info" });
        }
        return;
      }

      failedChecksRef.current += 1;
      if (isReachableRef.current && failedChecksRef.current >= FAILED_CHECKS_BEFORE_ALERT) {
        isReachableRef.current = false;
        showToast(t.serverUnavailable, { type: "danger", group: SERVER_UNREACHABLE_TOAST_GROUP });
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
    // Network came back: re-check right away instead of waiting for the next tick.
    const handleOnline = () => void checkServer();
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default ConnectivityMonitor;
