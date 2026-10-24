/**
 * Double progression: stay at a weight until every working set reaches the
 * top of the rep range, then add load (2.5 kg per side for barbell/Smith lifts,
 * 2.5 kg for dumbbells and machines) and work back up from the bottom of the range.
 */
const topOfRange = (reps) => parseInt(String(reps).split('-').pop(), 10) || 12;
const bottomOfRange = (reps) => parseInt(String(reps).split('-')[0], 10) || 8;

export function lastPerformance(name, history) {
  for (const w of history) {
    const ex = w.exercises.find((e) => e.name === name);
    if (ex) {
      const working = ex.sets.filter((s) => s.type === 'working' && s.weightKg != null);
      if (working.length) return { date: w.date, sets: working, perSide: Boolean(ex.perSide) };
    }
  }
  return null;
}

export function suggestLoads(planExercises, history) {
  return planExercises.map((pe) => {
    const last = lastPerformance(pe.name, history);
    if (!last) return { ...pe, last: null, suggestion: null };
    const top = topOfRange(pe.reps);
    const heaviest = Math.max(...last.sets.map((s) => s.weightKg));
    const atHeaviest = last.sets.filter((s) => s.weightKg === heaviest);
    const assisted = atHeaviest.some((s) => s.assisted);
    const allTop = atHeaviest.every((s) => (s.reps ?? 0) >= top);
    let weightKg = heaviest;
    let reason = `Stay at ${heaviest} kg and add a rep per set until all reach ${top}.`;
    if (allTop) {
      // Assisted machines: progress by *reducing* assistance
      weightKg = assisted ? Math.max(0, heaviest - 5) : heaviest + 2.5;
      reason = assisted
        ? `You hit ${top} reps on every set: drop the assistance to ${weightKg} kg.`
        : `You hit ${top}+ reps on every set: go up to ${weightKg} kg${pe.perSide ? ' per side' : ''} for ${bottomOfRange(pe.reps)}-${top} reps.`;
    }
    return {
      ...pe,
      last: { date: last.date, sets: last.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })) },
      suggestion: { weightKg, increase: weightKg !== heaviest, reason, assisted },
    };
  });
}
