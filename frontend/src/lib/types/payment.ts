export interface PaymentRequest {
  id: string;
  email: string;
  userId: string;
  name: string;
  requestDate: string;
  type: string;
  absentDate: string;
  schedule: string;
  reason: string;
  approved: string;
}