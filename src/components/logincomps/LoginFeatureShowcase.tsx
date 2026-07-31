import type { ReactElement } from "react";
import iconStudents from "../../assets/menu/Gestion des élèves.svg";
import iconSubjects from "../../assets/menu/Matières.svg";
import iconReportCards from "../../assets/menu/Imprimer les bulletins.svg";
import iconStaff from "../../assets/menu/Gestion du personnel.svg";

// Purely decorative stylized mockups (no real data/screenshots - see login CSS-carousel
// discussion) cycling through the product's key functionalities, replacing the old static
// login_img1.png. Each "screen" fades in/out via feature-cycle (src/index.css) with its
// animation-delay staggered by SLIDE_SECONDS so they play in sequence, looping forever.
const SLIDE_SECONDS = 4;

const ACCENTS = {
  primary: { badge: "bg-primary/15", bar: "bg-primary/60", pill: "bg-primary/20 text-primary" },
  secondary: {
    badge: "bg-secondary/15",
    bar: "bg-secondary/60",
    pill: "bg-secondary/20 text-secondary",
  },
  accent: { badge: "bg-accent/15", bar: "bg-accent/60", pill: "bg-accent/20 text-accent" },
  info: { badge: "bg-info/15", bar: "bg-info/60", pill: "bg-info/20 text-info" },
} as const;

type AccentKey = keyof typeof ACCENTS;

const SkeletonBar = ({ className = "", width }: { className?: string; width: string }) => (
  <div className={`h-2 rounded-full bg-base-content/10 ${className}`} style={{ width }} />
);

const StudentMock = ({ accent }: { accent: AccentKey }) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-full ${ACCENTS[accent].badge} shrink-0`} />
      <div className="flex-1 flex flex-col gap-1.5">
        <SkeletonBar width="55%" />
        <SkeletonBar width="35%" className="opacity-60" />
      </div>
    </div>
    <div className="flex items-end gap-2 h-14">
      {[40, 70, 55, 90, 65, 30].map((h, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t-sm ${ACCENTS[accent].bar}`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  </div>
);

const SubjectsMock = ({ accent }: { accent: AccentKey }) => (
  <div className="flex flex-col gap-3">
    {[70, 45, 60, 38].map((w, i) => (
      <div key={i} className="flex items-center gap-2">
        <div className={`w-3.5 h-3.5 rounded-sm ${ACCENTS[accent].badge} shrink-0`} />
        <SkeletonBar width={`${w}%`} />
        <span
          className={`ml-auto text-[9px] leading-none px-1.5 py-1 rounded ${ACCENTS[accent].pill}`}
        >
          {2 + (i % 3)}h
        </span>
      </div>
    ))}
  </div>
);

const ReportCardMock = ({ accent }: { accent: AccentKey }) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <SkeletonBar width="45%" />
      <span
        className={`ml-auto text-[9px] leading-none px-1.5 py-1 rounded ${ACCENTS[accent].pill}`}
      >
        16.5/20
      </span>
    </div>
    <div className="flex items-center gap-2">
      <SkeletonBar width="38%" />
      <span
        className={`ml-auto text-[9px] leading-none px-1.5 py-1 rounded ${ACCENTS[accent].pill}`}
      >
        14/20
      </span>
    </div>
    <div className="flex items-end gap-1.5 h-12 mt-1">
      {[30, 55, 45, 80, 60, 95, 50].map((h, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t-sm ${ACCENTS[accent].bar}`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  </div>
);

const StaffMock = ({ accent }: { accent: AccentKey }) => (
  <div className="flex flex-col gap-3">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-full ${ACCENTS[accent].badge} shrink-0`} />
        <div className="flex-1 flex flex-col gap-1">
          <SkeletonBar width={`${60 - i * 8}%`} />
          <SkeletonBar width="30%" className="opacity-60" />
        </div>
      </div>
    ))}
    <div className="grid grid-cols-7 gap-1 mt-1">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className={`aspect-square rounded-sm ${
            i % 5 === 0 ? ACCENTS[accent].bar : "bg-base-content/10"
          }`}
        />
      ))}
    </div>
  </div>
);

const SCREENS: {
  key: string;
  icon: string;
  title: string;
  accent: AccentKey;
  Mock: (props: { accent: AccentKey }) => ReactElement;
}[] = [
  { key: "students", icon: iconStudents, title: "Dossier Élève", accent: "primary", Mock: StudentMock },
  {
    key: "subjects",
    icon: iconSubjects,
    title: "Gestion des Matières",
    accent: "secondary",
    Mock: SubjectsMock,
  },
  {
    key: "reportCards",
    icon: iconReportCards,
    title: "Bulletin de Notes",
    accent: "accent",
    Mock: ReportCardMock,
  },
  { key: "staff", icon: iconStaff, title: "Gestion du Personnel", accent: "info", Mock: StaffMock },
];

const LoginFeatureShowcase = () => (
  <div
    aria-hidden="true"
    className="relative h-full w-full overflow-hidden rounded-l-2xl shadow-2xl border border-base-content/10 bg-linear-to-br from-base-200 to-base-300"
  >
    {SCREENS.map(({ key, icon, title, accent, Mock }, index) => (
      <div
        key={key}
        className="feature-slide absolute inset-0 flex flex-col p-6"
        style={{ animationDelay: `${index * SLIDE_SECONDS}s` }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className={`w-10 h-10 rounded-xl ${ACCENTS[accent].badge} flex items-center justify-center p-2`}
          >
            <img src={icon} alt="" className="w-full h-full object-contain" />
          </div>
          <span className="text-base-content/80 font-semibold">{title}</span>
        </div>
        <div className="flex-1 rounded-xl bg-base-100/60 border border-base-content/10 p-4">
          <div className="flex gap-1.5 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-error/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-warning/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-success/50" />
          </div>
          <Mock accent={accent} />
        </div>
      </div>
    ))}
  </div>
);

export default LoginFeatureShowcase;
