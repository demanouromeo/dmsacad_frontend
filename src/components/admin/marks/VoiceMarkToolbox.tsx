import { useEffect, useRef, useState } from "react";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { Mic, MicOff, RotateCcw, SkipForward, Check, ChevronLeft } from "lucide-react";
import type { Student } from "../../../interfaces/Student";
import type { markEntryManagerTranslations, Language } from "../../../i18n/translations";
import {
  parseVoiceMarkCandidates,
  type VoiceLanguage,
} from "../../../utils/voiceMarkParser";

type Translations = (typeof markEntryManagerTranslations)["fr"];
type Status = "idle" | "listening" | "processing" | "error";

interface VoiceMarkToolboxProps {
  t: Translations;
  language: Language;
  roster: Student[];
  getMarkValue: (studId: number) => string;
  isLocked: boolean;
  onConfirm: (studId: number, value: number) => void;
}

// Sequential "one student at a time" voice capture for the mark-entry grid. Deliberately a single
// blocking SpeechRecognition.start() call per utterance (no partialResults/listener plumbing) - the
// promise resolves once the plugin detects end-of-speech, which maps naturally onto "press mic,
// speak one mark, get a result" without extra state machinery. A recognized value is only a
// *candidate* until Confirm is pressed - it's never written into the shared marks state directly,
// so a misheard value can be discarded (Redo) without touching anything Save would submit.
const VoiceMarkToolbox = ({
  t,
  language,
  roster,
  getMarkValue,
  isLocked,
  onConfirm,
}: VoiceMarkToolboxProps) => {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>(
    language === "en" ? "en" : "fr",
  );
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [parsedValue, setParsedValue] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const captureTokenRef = useRef(0);

  useEffect(() => {
    SpeechRecognition.available()
      .then((r) => setAvailable(r.available))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    return () => {
      SpeechRecognition.stop().catch(() => {});
    };
  }, []);

  // The displayed roster can shrink (search filter) while voice mode is open - keep the cursor in
  // bounds rather than pointing at a student no longer shown.
  useEffect(() => {
    setIndex((prev) => Math.min(prev, Math.max(roster.length - 1, 0)));
  }, [roster.length]);

  const resetCapture = () => {
    setTranscript("");
    setParsedValue(null);
    setErrorMessage(null);
    setStatus("idle");
  };

  const goTo = (nextIndex: number) => {
    resetCapture();
    setIndex(Math.min(Math.max(nextIndex, 0), Math.max(roster.length - 1, 0)));
  };

  const startListening = async () => {
    resetCapture();
    const token = ++captureTokenRef.current;
    try {
      const perm = await SpeechRecognition.checkPermissions();
      if (perm.speechRecognition !== "granted") {
        const requested = await SpeechRecognition.requestPermissions();
        if (requested.speechRecognition !== "granted") {
          setErrorMessage(t.voicePermissionDenied);
          setStatus("error");
          return;
        }
      }
      setStatus("listening");
      const result = await SpeechRecognition.start({
        language: voiceLanguage === "fr" ? "fr-FR" : "en-US",
        maxResults: 5,
        popup: false,
        partialResults: false,
      });
      if (token !== captureTokenRef.current) {
        // Cancelled (stopListening/Redo/navigation) while awaiting - ignore this stale result.
        return;
      }
      setStatus("processing");
      const matches = result.matches ?? [];
      const parsed = parseVoiceMarkCandidates(matches, voiceLanguage);
      setTranscript(matches[0] ?? "");
      if (parsed === null) {
        setErrorMessage(t.voiceUnrecognized);
        setStatus("error");
        return;
      }
      setParsedValue(parsed);
      setStatus("idle");
    } catch {
      if (token !== captureTokenRef.current) {
        return;
      }
      setErrorMessage(t.voiceCaptureFailed);
      setStatus("error");
    }
  };

  const stopListening = async () => {
    captureTokenRef.current += 1;
    try {
      await SpeechRecognition.stop();
    } catch {
      // ignore - nothing to reconcile, the token bump already discards any in-flight result
    }
    setStatus("idle");
  };

  const handleConfirm = () => {
    const student = roster[index];
    if (!student || parsedValue === null) {
      return;
    }
    onConfirm(student.stud_id, parsedValue);
    goTo(index + 1);
  };

  if (available === false) {
    return (
      <div className="surface-card p-4 mb-6">
        <p className="text-warning">{t.entryModeVoiceUnavailable}</p>
      </div>
    );
  }

  if (roster.length === 0) {
    return (
      <div className="surface-card p-4 mb-6">
        <p className="empty-state">{t.voiceNoStudents}</p>
      </div>
    );
  }

  const student = roster[index];
  const currentValue = getMarkValue(student.stud_id);

  return (
    <div className="surface-card p-4 md:p-6 mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">{t.voiceToolboxTitle}</h2>
        <div className="flex items-center gap-2">
          <label className="font-medium text-sm">{t.voiceLanguageLabel}</label>
          <select
            className="select select-sm w-32"
            value={voiceLanguage}
            disabled={status === "listening"}
            onChange={(e) => setVoiceLanguage(e.target.value as VoiceLanguage)}
          >
            <option value="fr">{t.voiceLanguageFr}</option>
            <option value="en">{t.voiceLanguageEn}</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-base-200/50 rounded-xl px-4 py-3">
        <div>
          <p className="font-medium">{t.voiceStudentProgress(index + 1, roster.length)}</p>
          <p>
            {student.name} {student.surname ?? ""}
          </p>
        </div>
        <p>
          {t.voiceCurrentValueLabel} <strong>{currentValue || "—"}</strong>
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <button
          type="button"
          className={`btn btn-circle btn-lg ${
            status === "listening" ? "btn-error animate-pulse" : "btn-primary"
          }`}
          disabled={isLocked || status === "processing"}
          onClick={status === "listening" ? stopListening : startListening}
        >
          {status === "listening" ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {status === "listening" && <p>{t.voiceListening}</p>}
        {status === "processing" && <p>{t.voiceProcessing}</p>}
        {errorMessage && <p className="text-error">{errorMessage}</p>}

        {transcript && (
          <p className="text-sm opacity-70">
            {t.voiceRecognizedLabel} « {transcript} »
          </p>
        )}
        {parsedValue !== null && (
          <p className="text-lg">
            {t.voiceParsedLabel} <strong>{parsedValue.toFixed(2)}/20</strong>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className="btn btn-neutral btn-sm gap-2"
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
          {t.voicePreviousBtn}
        </button>
        {(parsedValue !== null || errorMessage) && (
          <button type="button" className="btn btn-neutral btn-sm gap-2" onClick={resetCapture}>
            <RotateCcw className="w-4 h-4" />
            {t.voiceRedoBtn}
          </button>
        )}
        <button
          type="button"
          className="btn btn-neutral btn-sm gap-2"
          disabled={index >= roster.length - 1}
          onClick={() => goTo(index + 1)}
        >
          <SkipForward className="w-4 h-4" />
          {t.voiceSkipBtn}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm gap-2"
          disabled={parsedValue === null || isLocked}
          onClick={handleConfirm}
        >
          <Check className="w-4 h-4" />
          {t.voiceConfirmBtn}
        </button>
      </div>
    </div>
  );
};

export default VoiceMarkToolbox;
