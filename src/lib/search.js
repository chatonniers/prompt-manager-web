function scorePrompt(prompt, query) {
  const q = query.toLowerCase().trim();
  if (!q) return 1;

  const fields = [
    { value: prompt.title, weight: 10 },
    { value: (prompt.tags || []).join(" "), weight: 8 },
    { value: (prompt.promptItems || []).map(i => i.label || '').join(" "), weight: 8 },
    { value: (prompt.solutions || []).join(" "), weight: 7 },
    { value: prompt.storyFlow || "", weight: 6 },
    { value: prompt.body, weight: 5 },
    { value: (prompt.promptItems || []).map(i => (i.body || '') + ' ' + (i.body_fr || '')).join(" "), weight: 5 },
    { value: (prompt.landscapes || []).join(" "), weight: 3 },
    { value: prompt.notes || "", weight: 2 }
  ];

  return fields.reduce((score, { value, weight }) => {
    const v = (value || "").toLowerCase();
    if (v.includes(q)) score += weight;
    if (v.startsWith(q)) score += weight * 2;
    return score;
  }, 0);
}

function filterAndRank(prompts, query, context, showAll) {
  let pool = prompts;

  if (!showAll && context && context.detected) {
    pool = prompts.filter(p =>
      !p.solutions || p.solutions.length === 0 || p.solutions.includes(context.solution)
    );
  }

  const q = query.trim();

  return pool
    .map(p => ({ prompt: p, score: scorePrompt(p, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      const pa = a.prompt, pb = b.prompt;

      // 1. Favorites always on top
      if (pa.isFavorite !== pb.isFavorite) return pa.isFavorite ? -1 : 1;

      // 2. Solution-relevant prompts before universal (empty solutions) ones
      const aSol = context && context.detected && pa.solutions && pa.solutions.includes(context.solution) ? 0 : 1;
      const bSol = context && context.detected && pb.solutions && pb.solutions.includes(context.solution) ? 0 : 1;
      if (aSol !== bSol) return aSol - bSol;

      // 3. Story-flow match
      if (context && context.suggestedFlows && context.suggestedFlows.length > 0) {
        const aFlow = context.suggestedFlows.includes(pa.storyFlow) ? 0 : 1;
        const bFlow = context.suggestedFlows.includes(pb.storyFlow) ? 0 : 1;
        if (aFlow !== bFlow) return aFlow - bFlow;
      }

      // 4. Within each group: A-Z by title when no search query, score desc when searching
      if (q) return b.score - a.score;
      return (pa.title || "").localeCompare(pb.title || "");
    })
    .map(({ prompt }) => prompt);
}

export { scorePrompt, filterAndRank };
