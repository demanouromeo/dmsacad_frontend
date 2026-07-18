// Row shape returned by StaffController::allClassMastersOfYear/allSgOfYear - deliberately not the
// full Staff interface, which has many required fields these endpoints don't return.
export interface StaffSummary {
  staff_id: number;
  name: string;
  surname: string | null;
}
