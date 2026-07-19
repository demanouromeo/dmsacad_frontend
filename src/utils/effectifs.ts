import type { Classe } from "../interfaces/Classe";
import type { StudentSectionSummaryRow } from "../interfaces/StudentSectionSummaryRow";

export interface ClasseEffectif {
  classe_id: number;
  classe_name: string;
  level: number;
  garcons: number;
  filles: number;
  redoublants: number;
  nouveaux: number;
  total: number;
}

export interface EffectifTotals {
  garcons: number;
  filles: number;
  redoublants: number;
  nouveaux: number;
  total: number;
}

export interface CycleEffectif extends EffectifTotals {
  cycle: 1 | 2;
  classes: ClasseEffectif[];
}

export interface SectionEffectif extends EffectifTotals {
  section: string;
  cycles: CycleEffectif[];
}

// Cycle 1 = levels 1-4 (6ème..3ème), Cycle 2 = levels 5-7 (2nde..Tle) - per the school's own
// "EFFECTIFS PAR CLASSE" report convention (see the sample PDF this report replicates). Any level
// outside that isn't expected in practice, but falls back to cycle 1 rather than being dropped.
export const cycleOfLevel = (level: number): 1 | 2 => (level >= 5 && level <= 7 ? 2 : 1);

const sumTotals = (items: EffectifTotals[]): EffectifTotals =>
  items.reduce(
    (acc, item) => ({
      garcons: acc.garcons + item.garcons,
      filles: acc.filles + item.filles,
      redoublants: acc.redoublants + item.redoublants,
      nouveaux: acc.nouveaux + item.nouveaux,
      total: acc.total + item.total,
    }),
    { garcons: 0, filles: 0, redoublants: 0, nouveaux: 0, total: 0 },
  );

// Builds one row per classe (including classes with zero enrolled students, so an empty section
// still renders its classe list with all-zero counts - matching the reference report) from the
// already-sorted (level, classe_name) classe list plus the section's flat student summary rows.
// "Nouveaux" is Total - Redoublants, same simplification StudentManager's stats bar already uses -
// there's no separate "new admission" flag in the data model.
export const buildClasseEffectifs = (
  classes: Classe[],
  summaryRows: StudentSectionSummaryRow[],
): ClasseEffectif[] => {
  const byClasse = new Map<number, StudentSectionSummaryRow[]>();
  summaryRows.forEach((row) => {
    const existing = byClasse.get(row.classe_id);
    if (existing) {
      existing.push(row);
    } else {
      byClasse.set(row.classe_id, [row]);
    }
  });

  return classes.map((classe) => {
    const rows = byClasse.get(classe.classe_id) ?? [];
    const garcons = rows.filter((r) => r.sexe === "M").length;
    const filles = rows.filter((r) => r.sexe === "F").length;
    const redoublants = rows.filter((r) => r.repeating === 1).length;
    const total = rows.length;
    return {
      classe_id: classe.classe_id,
      classe_name: classe.classe_name,
      level: classe.level,
      garcons,
      filles,
      redoublants,
      nouveaux: total - redoublants,
      total,
    };
  });
};

// Groups an already-computed classe list into Cycle 1 / Cycle 2, each carrying its own subtotal -
// cycles with no classes at all are omitted rather than rendered empty.
export const groupByCycle = (classeEffectifs: ClasseEffectif[]): CycleEffectif[] => {
  const cycles: Record<1 | 2, ClasseEffectif[]> = { 1: [], 2: [] };
  classeEffectifs.forEach((c) => {
    cycles[cycleOfLevel(c.level)].push(c);
  });
  return ([1, 2] as const)
    .filter((cycle) => cycles[cycle].length > 0)
    .map((cycle) => ({
      cycle,
      classes: cycles[cycle],
      ...sumTotals(cycles[cycle]),
    }));
};

export const buildSectionEffectif = (
  section: string,
  classes: Classe[],
  summaryRows: StudentSectionSummaryRow[],
): SectionEffectif => {
  const cycles = groupByCycle(buildClasseEffectifs(classes, summaryRows));
  return { section, cycles, ...sumTotals(cycles) };
};

export const sumSections = (sections: SectionEffectif[]): EffectifTotals =>
  sumTotals(sections);
