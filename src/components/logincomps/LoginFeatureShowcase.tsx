import { useEffect, useState } from "react";
import { MousePointer2, Check } from "lucide-react";
import iconFilieres from "../../assets/menu/Filières.svg";
import iconSpecialities from "../../assets/menu/Spécialités.svg";
import iconClasses from "../../assets/menu/Gestion des classes.svg";
import iconSubjects from "../../assets/menu/Matières.svg";
import iconStudents from "../../assets/menu/Gestion des élèves.svg";
import iconStaff from "../../assets/menu/Gestion du personnel.svg";
import iconMarks from "../../assets/menu/Saisie des notes.svg";
import iconFillRate from "../../assets/menu/Taux_de_remplissage.svg";
import iconReportCards from "../../assets/menu/Imprimer les bulletins.svg";
import iconBilan from "../../assets/menu/Bilan.svg";
import iconSettings from "../../assets/menu/Settings.svg";
import iconAssistant from "../../assets/menu/Gestion des messages.svg";

// Real product screenshots (src/assets/screnshots) cycling through the app's key modules,
// replacing the old fully-synthetic CSS mockups. Each file is resolved via import.meta.glob
// (lazy, not { eager: true }) so the actual image bytes are only fetched in the background
// after mount (see the preload effect below) instead of being bundled/blocking the initial
// paint of the login form.
const screenshotModules = import.meta.glob<{ default: string }>(
  "../../assets/screnshots/*.png",
);

type AccentKey = "primary" | "secondary" | "accent" | "info";

const ACCENTS: Record<AccentKey, { badge: string; ring: string }> = {
  primary: { badge: "bg-primary/15", ring: "ring-primary/40" },
  secondary: { badge: "bg-secondary/15", ring: "ring-secondary/40" },
  accent: { badge: "bg-accent/15", ring: "ring-accent/40" },
  info: { badge: "bg-info/15", ring: "ring-info/40" },
};

// Rotated per slide so consecutive screens never reuse the same enter/exit motion.
const EFFECTS = ["fade-up", "slide-right", "zoom-in", "slide-left", "fade-scale", "flip"] as const;
type Effect = (typeof EFFECTS)[number];

// Alternates two lightweight decorative overlays per slide: a simulated pointer click, and a
// simulated "typing into a field" fill animation - purely cosmetic, layered on top of the real
// screenshot underneath.
type Artifact = "cursor" | "formFill";

interface Screen {
  key: string;
  file: string;
  title: string;
  accent: AccentKey;
  icon: string;
  artifact: Artifact;
}

const SCREENS: Screen[] = [
  { key: "filieres", file: "filieres.png", title: "Filières", accent: "primary", icon: iconFilieres, artifact: "cursor" },
  { key: "specialities", file: "specialites.png", title: "Spécialités", accent: "secondary", icon: iconSpecialities, artifact: "formFill" },
  { key: "classes", file: "Ajout-suppression-Modification des classes.png", title: "Gestion des Classes", accent: "accent", icon: iconClasses, artifact: "cursor" },
  { key: "subjects", file: "Ajout-suppression-Modification des matieres.png", title: "Gestion des Matières", accent: "info", icon: iconSubjects, artifact: "formFill" },
  { key: "students", file: "gestion des eleves.png", title: "Gestion des Élèves", accent: "primary", icon: iconStudents, artifact: "cursor" },
  { key: "staff", file: "Ajout-suppression-Modification du personnel.png", title: "Gestion du Personnel", accent: "secondary", icon: iconStaff, artifact: "formFill" },
  { key: "marks", file: "Saisie des notes.png", title: "Saisie des Notes", accent: "accent", icon: iconMarks, artifact: "formFill" },
  { key: "fillRate", file: "Taux de remplissage.png", title: "Taux de Remplissage", accent: "info", icon: iconFillRate, artifact: "cursor" },
  { key: "reportCards", file: "Bulletins de notes.png", title: "Bulletins de Notes", accent: "primary", icon: iconReportCards, artifact: "cursor" },
  { key: "bilan", file: "Effectifs par classe.png", title: "Bilan / Effectifs", accent: "secondary", icon: iconBilan, artifact: "formFill" },
  { key: "settings", file: "Configurations.png", title: "Configurations", accent: "accent", icon: iconSettings, artifact: "cursor" },
  { key: "assistant", file: "Assitant AI - Lynday.png", title: "Lindsay - Assistante IA", accent: "info", icon: iconAssistant, artifact: "formFill" },
];

const SLIDE_SECONDS = 5;

const CursorArtifact = ({ dx, dy }: { dx: number; dy: number }) => (
  <div
    className="cursor-artifact pointer-events-none absolute left-[15%] top-[20%] z-10"
    style={{ "--cursor-dx": `${dx}px`, "--cursor-dy": `${dy}px` } as React.CSSProperties}
  >
    <span className="cursor-ripple absolute -inset-3 rounded-full bg-primary/50" />
    <MousePointer2 className="relative h-5 w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" fill="currentColor" />
  </div>
);

const FormFillArtifact = ({ accent }: { accent: AccentKey }) => (
  <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 rounded-lg border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-sm">
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="form-caret inline-block h-2.5 w-0.5 bg-white/80" />
      <span className="text-[10px] leading-none text-white/70">Saisie en cours…</span>
      <span className={`form-badge ml-auto flex h-4 w-4 items-center justify-center rounded-full ${ACCENTS[accent].badge}`}>
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
      </span>
    </div>
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
      <div className={`form-fill-bar h-full rounded-full ${ACCENTS[accent].badge.replace("/15", "/80")}`} />
    </div>
  </div>
);

const LoginFeatureShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedSrcs, setLoadedSrcs] = useState<Record<string, string>>({});
  const [reducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // Preload every screenshot in the background via the same fetch-as-Blob-then-Image()
  // pattern the rest of the app uses for async images (StudentPhotoCell, SchoolInfoReader's
  // logo probe) - each panel shows a shimmer skeleton until its own image resolves, so a slow
  // or large screenshot never blocks the others or the login form itself.
  useEffect(() => {
    let cancelled = false;
    SCREENS.forEach((screen) => {
      const loader = screenshotModules[`../../assets/screnshots/${screen.file}`];
      if (!loader) return;
      loader()
        .then((mod) => {
          const img = new Image();
          img.onload = () => {
            if (!cancelled) setLoadedSrcs((prev) => ({ ...prev, [screen.key]: mod.default }));
          };
          img.src = mod.default;
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % SCREENS.length);
    }, SLIDE_SECONDS * 1000);
    return () => clearInterval(id);
  }, [reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className="relative h-full w-full overflow-hidden rounded-l-2xl shadow-2xl border border-r-base-content/10 border-b-base-content/10 border-t-[#4c1d95] border-l-[#4c1d95] bg-[linear-gradient(135deg,#4c1d95_0%,#2563eb_38%,#f8fafc_68%,#9ca3af_100%)]"
      style={{ "--slide-seconds": SLIDE_SECONDS } as React.CSSProperties}
    >
      {SCREENS.map((screen, index) => {
        const isActive = index === activeIndex;
        const src = loadedSrcs[screen.key];
        const effect: Effect = EFFECTS[index % EFFECTS.length];
        // Small per-slide variation so the cursor artifact doesn't land on the exact same spot every time.
        const cursorDx = 60 + ((index * 37) % 90);
        const cursorDy = 40 + ((index * 53) % 70);

        return (
          <div
            key={screen.key}
            data-effect={effect}
            className={`feature-slide absolute inset-0 flex flex-col p-6 ${isActive ? "is-active" : ""}`}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 rounded-xl ${ACCENTS[screen.accent].badge} flex items-center justify-center p-2`}>
                <img src={screen.icon} alt="" className="w-full h-full object-contain" />
              </div>
              <span className="text-base-content/80 font-semibold">{screen.title}</span>
            </div>

            <div className="relative flex-1 flex items-center justify-center rounded-xl bg-base-100/60 border border-base-content/10 p-3 overflow-hidden">
              {src ? (
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className={`max-h-full max-w-full object-contain rounded-lg shadow-xl ring-1 ${ACCENTS[screen.accent].ring}`}
                />
              ) : (
                <div className="h-[85%] w-[80%] animate-pulse rounded-lg bg-base-content/10" />
              )}

              {src && isActive && !reducedMotion && (
                <div key={activeIndex}>
                  {screen.artifact === "cursor" ? (
                    <CursorArtifact dx={cursorDx} dy={cursorDy} />
                  ) : (
                    <FormFillArtifact accent={screen.accent} />
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LoginFeatureShowcase;
