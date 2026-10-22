/** Pinned TC-001 / fixture values for k6 (M6 #57). */
export const TC001 = {
  journeyDate: '2026-04-01',
  from: 'SAB',
  to: 'SAA',
  trainRunId: 'a5012c27-3b3a-4114-bea2-a33ec2bea8d7',
  inventory3aId: 'c0714d77-5e36-4aeb-a001-dd17aa3809c3',
  userId: '11111111-1111-4111-8111-111111111111',
};

export function authHeaders(token, runId) {
  const h = { 'Content-Type': 'application/json', 'X-Run-Id': runId };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}
