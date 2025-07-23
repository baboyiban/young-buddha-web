export interface AbsenceRequest {
  id: number;
  name: string;
  type: string;
  request_date: string;
  absent_date: string;
  time_slot?: string | null;
  reason?: string | null;
  status: string;
  approver?: string | null;
  approved_at?: string | null;
  comment?: string | null;
}
