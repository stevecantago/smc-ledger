import { describe, expect, it } from 'vitest';
import { syncLoanAndOptionalSchedule } from './loanScheduleSync';

describe('syncLoanAndOptionalSchedule', () => {
  it('waits for the loan write before creating its linked schedule', async () => {
    const calls: string[] = [];

    const result = await syncLoanAndOptionalSchedule(
      async () => {
        calls.push('loan');
        return { error: null };
      },
      async () => {
        calls.push('schedule');
        return { error: null };
      }
    );

    expect(calls).toEqual(['loan', 'schedule']);
    expect(result.error).toBeNull();
  });

  it('does not create a linked schedule when the loan write fails', async () => {
    const calls: string[] = [];
    const loanError = { message: 'loan insert failed' };

    const result = await syncLoanAndOptionalSchedule(
      async () => {
        calls.push('loan');
        return { error: loanError };
      },
      async () => {
        calls.push('schedule');
        return { error: null };
      }
    );

    expect(calls).toEqual(['loan']);
    expect(result.error).toBe(loanError);
  });
});
