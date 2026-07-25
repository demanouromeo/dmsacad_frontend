import type { SectionEffectif } from "./effectifs";

export interface ClasseGenderRow {
  classe_name: string;
  garcons: number;
  filles: number;
}

export interface ClasseRepeatRow {
  classe_name: string;
  nouveaux: number;
  redoublants: number;
}

export interface CycleGroupRow {
  section: string;
  cycle1: number;
  cycle2: number;
}

// Flat, chart-ready reshapes of the already-computed SectionEffectif tree - pure, no fetching,
// same "computation layer independent of fetch/render" role as effectifs.ts itself.
export const buildClasseGenderRows = (section: SectionEffectif): ClasseGenderRow[] =>
  section.cycles.flatMap((cycle) =>
    cycle.classes.map((classe) => ({
      classe_name: classe.classe_name,
      garcons: classe.garcons,
      filles: classe.filles,
    })),
  );

export const buildClasseRepeatRows = (section: SectionEffectif): ClasseRepeatRow[] =>
  section.cycles.flatMap((cycle) =>
    cycle.classes.map((classe) => ({
      classe_name: classe.classe_name,
      nouveaux: classe.nouveaux,
      redoublants: classe.redoublants,
    })),
  );

export const buildCycleGroupRows = (sections: SectionEffectif[]): CycleGroupRow[] =>
  sections.map((section) => ({
    section: section.section,
    cycle1: section.cycles.find((c) => c.cycle === 1)?.total ?? 0,
    cycle2: section.cycles.find((c) => c.cycle === 2)?.total ?? 0,
  }));
