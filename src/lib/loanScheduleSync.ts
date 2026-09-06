type SupabaseWriteResult = { error?: unknown };
type SupabaseWrite = () => PromiseLike<SupabaseWriteResult>;

function hasWriteError(result: SupabaseWriteResult): boolean {
  return Boolean(result.error);
}

export async function syncLoanAndOptionalSchedule(
  createLoan: SupabaseWrite,
  createSchedule?: SupabaseWrite | null
): Promise<SupabaseWriteResult> {
  const loanResult = await createLoan();

  if (hasWriteError(loanResult) || !createSchedule) {
    return loanResult;
  }

  return createSchedule();
}
