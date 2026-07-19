// Shape of LockController::locksOfYear's rows (lock_sequence table). `seq` is keyed only by
// (sy_id, seq) - it has no classe_id/subject_id column, so a lock is shared across every classe and
// subject that maps to the same seq value. See MarkEntryManager for how mark entry derives `seq`.
export interface LockRow {
  id: number;
  seq: number;
  sy_id: number;
  is_blocked: number;
  is_lock_classbased: number;
}
