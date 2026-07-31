import type { NavigateFunction } from "react-router-dom";
import type { Language, magicAssistantTranslations } from "../i18n/translations";
import type { ConfirmOptions } from "../confirm/confirmContext";
import type { Classe } from "../interfaces/Classe";
import type { Staff } from "../interfaces/Staff";
import type { Filiere } from "../interfaces/Filiere";
import type { Speciality } from "../interfaces/Speciality";
import type { Subject } from "../interfaces/Subject";
import type { Student } from "../interfaces/Student";
import type { SchoolHeader } from "../utils/exportHeader";
import { normalize } from "./assistantEngine";
import { type Role } from "./knowledgeBase";
import { findClasseByName } from "../utils/classeMatch";
import { ClasseReader } from "../dbmanger/ClasseReader";
import { StaffReader } from "../dbmanger/StaffReader";
import { FiliereReader } from "../dbmanger/FiliereReader";
import { SpecialityReader } from "../dbmanger/SpecialityReader";
import { SubjectReader } from "../dbmanger/SubjectReader";
import { StudentReader } from "../dbmanger/StudentReader";
import { MarkReader } from "../dbmanger/MarkReader";
import { buildTimestampedFilename, exportRowsToPdf, type ExportColumn } from "../utils/exportData";

// Lindsay's task-execution layer, sitting in front of the existing FAQ knowledge base
// (assistantEngine.ts / knowledgeBase.ts): a small registry of executable commands, matched by
// keyword (same offline, no-LLM approach as the FAQ engine - see that module's own comment for
// why) rather than free-form NLU. Each command requires BOTH an action-keyword hit ("imprime",
// "affiche", "supprime"...) AND a module-keyword hit ("personnel", "eleves", "competences sans
// notes"...) to match, which keeps this from colliding with the FAQ knowledge base's similarly-
// worded how-to entries. No match here falls through to that FAQ engine unchanged.

export type CommandTranslations = (typeof magicAssistantTranslations)["fr"];

export interface AssistantCommandContext {
  accessToken: string | null;
  connection: string;
  schoolYear: string;
  section: string;
  role: string;
  userId: number | null;
  language: Language;
  schoolHeader: SchoolHeader;
  navigate: NavigateFunction;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  t: CommandTranslations;
}

export interface AssistantCommandResult {
  text: string;
}

export interface AssistantCommand {
  id: string;
  roles: Role[];
  mutating: boolean;
  needsClasse?: boolean;
  actionKeywords: { fr: string[]; en: string[] };
  moduleKeywords: { fr: string[]; en: string[] };
  run: (ctx: AssistantCommandContext, classe?: Classe) => Promise<AssistantCommandResult>;
}

const ACTIONS = {
  print: {
    fr: ["imprime", "imprimer", "exporte", "exporter", "télécharge", "telecharge"],
    en: ["print", "export", "download"],
  },
  navigate: {
    fr: ["affiche", "afficher", "montre", "montrer", "ouvre", "ouvrir", "va à", "va a"],
    en: ["show", "display", "open", "go to", "navigate"],
  },
  deleteAction: {
    fr: ["supprime", "supprimer", "efface", "effacer", "retire", "retirer"],
    en: ["delete", "remove"],
  },
};

const withIndexColumn = <T>(columns: ExportColumn<T>[]): ExportColumn<T>[] => [
  { header: "N°", accessor: (_row: T, index: number) => index + 1 },
  ...columns,
];

export const COMMANDS: AssistantCommand[] = [
  {
    id: "print_staff",
    roles: ["ADMIN"],
    mutating: false,
    actionKeywords: ACTIONS.print,
    moduleKeywords: { fr: ["personnel", "employe", "employés"], en: ["staff", "personnel", "employees"] },
    run: async (ctx) => {
      const rows = await StaffReader.fetchStaff(ctx.accessToken, ctx.connection, ctx.schoolYear);
      if (rows.length === 0) return { text: ctx.t.nothingToExport };
      const title = "Liste du personnel";
      const columns: ExportColumn<Staff>[] = [
        { header: "Nom", accessor: (s) => s.name },
        { header: "Prénom", accessor: (s) => s.surname ?? "" },
        { header: "Téléphone", accessor: (s) => s.phone1 ?? "" },
        { header: "Sexe", accessor: (s) => s.sexe },
        { header: "Login", accessor: (s) => s.login },
      ];
      await exportRowsToPdf(
        title,
        buildTimestampedFilename(title, [], "pdf"),
        withIndexColumn(columns),
        rows,
        ctx.schoolHeader,
      );
      return { text: ctx.t.printSuccess(title, rows.length) };
    },
  },
  {
    id: "print_filieres",
    roles: ["ADMIN"],
    mutating: false,
    actionKeywords: ACTIONS.print,
    moduleKeywords: { fr: ["filiere", "filieres"], en: ["filiere", "filieres", "stream"] },
    run: async (ctx) => {
      const rows = await FiliereReader.fetchFilieres(ctx.accessToken, ctx.connection, ctx.schoolYear, ctx.section);
      if (rows.length === 0) return { text: ctx.t.nothingToExport };
      const title = "Liste des filière";
      const columns: ExportColumn<Filiere>[] = [
        { header: "Nom de la filière", accessor: (f) => f.nom_filiere },
      ];
      await exportRowsToPdf(
        title,
        buildTimestampedFilename(title, [], "pdf"),
        withIndexColumn(columns),
        rows,
        ctx.schoolHeader,
      );
      return { text: ctx.t.printSuccess(title, rows.length) };
    },
  },
  {
    id: "print_specialities",
    roles: ["ADMIN"],
    mutating: false,
    actionKeywords: ACTIONS.print,
    moduleKeywords: { fr: ["specialite", "specialites"], en: ["speciality", "specialities", "specialization"] },
    run: async (ctx) => {
      const rows = await SpecialityReader.fetchSpecialities(ctx.accessToken, ctx.connection, ctx.schoolYear, ctx.section);
      if (rows.length === 0) return { text: ctx.t.nothingToExport };
      const title = "Liste des specialités";
      const columns: ExportColumn<Speciality>[] = [
        { header: "Nom de la spécialité", accessor: (s) => s.speciality_name },
        { header: "Filière", accessor: (s) => s.nom_filiere },
      ];
      await exportRowsToPdf(
        title,
        buildTimestampedFilename(title, [], "pdf"),
        withIndexColumn(columns),
        rows,
        ctx.schoolHeader,
      );
      return { text: ctx.t.printSuccess(title, rows.length) };
    },
  },
  {
    id: "print_classes",
    roles: ["ADMIN", "CENSEUR"],
    mutating: false,
    actionKeywords: ACTIONS.print,
    moduleKeywords: { fr: ["classe", "classes"], en: ["class", "classes"] },
    run: async (ctx) => {
      const rows = await ClasseReader.fetchClasses(ctx.accessToken, ctx.connection, ctx.schoolYear, ctx.section);
      const visible = ctx.role === "CENSEUR" ? rows.filter((c) => c.vp_id === ctx.userId) : rows;
      if (visible.length === 0) return { text: ctx.t.nothingToExport };
      const title = "Liste de classes";
      const columns: ExportColumn<Classe>[] = [
        { header: "Nom de la classe", accessor: (c) => c.classe_name },
        { header: "Niveau", accessor: (c) => c.level },
        { header: "Spécialité", accessor: (c) => c.speciality_name ?? "" },
      ];
      await exportRowsToPdf(
        title,
        buildTimestampedFilename(title, [], "pdf"),
        withIndexColumn(columns),
        visible,
        ctx.schoolHeader,
      );
      return { text: ctx.t.printSuccess(title, visible.length) };
    },
  },
  {
    id: "print_subjects",
    roles: ["ADMIN"],
    mutating: false,
    actionKeywords: ACTIONS.print,
    moduleKeywords: { fr: ["matiere", "matieres"], en: ["subject", "subjects"] },
    run: async (ctx) => {
      const rows = await SubjectReader.fetchSubjects(ctx.accessToken, ctx.connection, ctx.schoolYear, ctx.section);
      if (rows.length === 0) return { text: ctx.t.nothingToExport };
      const title = "Liste des matières";
      const columns: ExportColumn<Subject>[] = [
        { header: "Matière", accessor: (s) => s.subject_title },
      ];
      await exportRowsToPdf(
        title,
        buildTimestampedFilename(title, [], "pdf"),
        withIndexColumn(columns),
        rows,
        ctx.schoolHeader,
      );
      return { text: ctx.t.printSuccess(title, rows.length) };
    },
  },
  {
    id: "print_students_of_classe",
    roles: ["ADMIN", "CENSEUR"],
    mutating: false,
    needsClasse: true,
    actionKeywords: ACTIONS.print,
    moduleKeywords: { fr: ["eleve", "eleves", "etudiant", "etudiants"], en: ["student", "students"] },
    run: async (ctx, classe) => {
      if (!classe) return { text: ctx.t.classeNotFound("") };
      const rows = await StudentReader.fetchStudentsOfClasse(
        ctx.accessToken, ctx.connection, ctx.schoolYear, classe.classe_id,
      );
      if (rows.length === 0) return { text: ctx.t.nothingToExport };
      const title = "Liste des élèves";
      const columns: ExportColumn<Student>[] = [
        { header: "Matricule", accessor: (s) => s.matricule ?? "" },
        { header: "Nom", accessor: (s) => s.name },
        { header: "Prénom", accessor: (s) => s.surname ?? "" },
        { header: "Sexe", accessor: (s) => s.sexe },
      ];
      await exportRowsToPdf(
        title,
        buildTimestampedFilename(title, [`Classe ${classe.classe_name}`], "pdf"),
        withIndexColumn(columns),
        rows,
        ctx.schoolHeader,
      );
      return { text: ctx.t.printSuccess(`${title} - ${classe.classe_name}`, rows.length) };
    },
  },
  {
    id: "show_students_of_classe",
    roles: ["ADMIN", "CENSEUR"],
    mutating: false,
    needsClasse: true,
    actionKeywords: ACTIONS.navigate,
    moduleKeywords: { fr: ["eleve", "eleves", "etudiant", "etudiants"], en: ["student", "students"] },
    run: async (ctx, classe) => {
      if (!classe) return { text: ctx.t.classeNotFound("") };
      ctx.navigate("/admin/students", { state: { initialClasseName: classe.classe_name } });
      return { text: ctx.t.navigateToStudents(classe.classe_name) };
    },
  },
  {
    id: "delete_competences_no_marks_of_classe",
    roles: ["ADMIN"],
    mutating: true,
    needsClasse: true,
    actionKeywords: ACTIONS.deleteAction,
    moduleKeywords: {
      fr: ["competences sans notes", "competence sans notes", "sans notes"],
      en: ["competencies without marks", "competency without marks", "without marks", "no marks"],
    },
    run: async (ctx, classe) => {
      if (!classe) return { text: ctx.t.classeNotFound("") };

      const apcLevels = await ClasseReader.fetchApcLevels(
        ctx.accessToken, ctx.connection, ctx.schoolYear, ctx.section,
      );
      const isApc = apcLevels.find((l) => l.level === classe.level)?.activated === true;
      if (!isApc) return { text: ctx.t.notApcClasse(classe.classe_name) };

      const subjects = await SubjectReader.fetchSubjectsOfClasse(
        ctx.accessToken, ctx.connection, ctx.schoolYear, ctx.section, classe.classe_id,
      );

      const idsToDelete: number[] = [];
      for (const subject of subjects) {
        for (const term of [1, 2, 3]) {
          const competences = await SubjectReader.fetchCompetences(
            ctx.accessToken, ctx.connection, ctx.schoolYear, ctx.section, classe.classe_id,
            subject.subject_id, term,
          );
          if (competences.length === 0) continue;
          const results = await Promise.all(
            competences.map(async (comp) => {
              const rows = await MarkReader.fetchCompMarks(
                ctx.accessToken, ctx.connection, ctx.schoolYear, classe.classe_id,
                subject.subject_id, term, comp.subject_competence_id,
              );
              const hasAnyMark = rows.some((r) => r.isEmpty !== 1);
              return { id: comp.subject_competence_id, hasAnyMark };
            }),
          );
          idsToDelete.push(...results.filter((r) => !r.hasAnyMark).map((r) => r.id));
        }
      }

      if (idsToDelete.length === 0) {
        return { text: ctx.t.noCompetencesWithoutMarks(classe.classe_name) };
      }

      const confirmed = await ctx.confirm(
        ctx.t.confirmDeleteCompetences(idsToDelete.length, classe.classe_name),
        { danger: true },
      );
      if (!confirmed) return { text: ctx.t.deleteCancelled };

      const result = await SubjectReader.deleteCompetencesWithNoMarks(
        ctx.accessToken, ctx.connection, ctx.schoolYear, idsToDelete,
      );
      return {
        text: result.status
          ? ctx.t.deleteCompetencesSuccess(idsToDelete.length, classe.classe_name)
          : ctx.t.deleteCompetencesFailure,
      };
    },
  },
];

export function matchCommand(rawInput: string): AssistantCommand | null {
  const normalizedInput = normalize(rawInput);
  if (!normalizedInput) return null;

  let best: { command: AssistantCommand; score: number } | null = null;
  for (const command of COMMANDS) {
    const actionKeywords = [...command.actionKeywords.fr, ...command.actionKeywords.en].map(normalize);
    const moduleKeywords = [...command.moduleKeywords.fr, ...command.moduleKeywords.en].map(normalize);
    const actionHit = actionKeywords.find((k) => k.length > 0 && normalizedInput.includes(k));
    const moduleHit = moduleKeywords.find((k) => k.length > 0 && normalizedInput.includes(k));
    if (!actionHit || !moduleHit) continue;
    const score = actionHit.length + moduleHit.length;
    if (!best || score > best.score) {
      best = { command, score };
    }
  }
  return best?.command ?? null;
}

// Resolves a command's target classe from the same raw text the command itself was matched
// against - CENSEUR is restricted to classes assigned to them as VP (Classe.vp_id), same
// client-side scoping precedent as StudentManager/ClasseManager/SubjectClasseManager.
export async function resolveClasseForCommand(
  ctx: AssistantCommandContext,
  rawInput: string,
): Promise<Classe | null> {
  const list = await ClasseReader.fetchClasses(ctx.accessToken, ctx.connection, ctx.schoolYear, ctx.section);
  const visible = ctx.role === "CENSEUR" ? list.filter((c) => c.vp_id === ctx.userId) : list;
  return findClasseByName(rawInput, visible);
}
