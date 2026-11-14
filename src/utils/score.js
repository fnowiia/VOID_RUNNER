/** Rewards depend only on visible counters; time is recorded separately. */
export function calculateStars(mistakes, hintsUsed) {
  if (mistakes === 0 && hintsUsed === 0) return 3;
  if (mistakes <= 2 && hintsUsed <= 1) return 2;
  return 1;
}

export function formatTime(ms = 0) {
  const totalSeconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export function improveProgress(previous, run) {
  const candidate = {
    level_id: run.level_id,
    best_time_ms: run.duration_ms,
    best_errors: run.mistakes,
    best_stars: calculateStars(run.mistakes, run.hints_used),
    completed_at: run.completed_at,
  };
  if (!previous) return candidate;
  return {
    level_id: run.level_id,
    best_time_ms: Math.min(previous.best_time_ms, candidate.best_time_ms),
    best_errors: Math.min(previous.best_errors, candidate.best_errors),
    best_stars: Math.max(previous.best_stars, candidate.best_stars),
    completed_at: previous.completed_at < candidate.completed_at ? previous.completed_at : candidate.completed_at,
  };
}
