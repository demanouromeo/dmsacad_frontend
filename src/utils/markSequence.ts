// dbsequence in [1..6] is how non-APC marks (student_subject.sequence) key a (term, sequence) pair -
// see StudentController's own comment block on saveSeqMarks/getSeqMarks for this exact mapping.
export const computeDbSequence = (term: number, sequence: number): number => (term - 1) * 2 + sequence;

// Inverse of computeDbSequence - turns a raw dbsequence (e.g. from fillRateNonApc's rows) back into
// its (term, sequence) pair.
export const termAndSequenceFromDbsequence = (
  dbsequence: number,
): { term: number; sequence: number } => ({
  term: Math.floor((dbsequence - 1) / 2) + 1,
  sequence: ((dbsequence - 1) % 2) + 1,
});
