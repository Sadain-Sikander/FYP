const object = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value, max) => typeof value === "string" && value.length <= max;
const nonempty = (value, max = 600) => text(value, max) && !!value.trim();
const categories = [
  "Introduction",
  "Experience",
  "Role knowledge",
  "Problem solving",
  "Reflection",
];
export function validQuestions(value) {
  return (
    Array.isArray(value) &&
    value.length === 5 &&
    value.every(
      (q, i) =>
        object(q) &&
        q.id === `q${i + 1}` &&
        q.category === categories[i] &&
        nonempty(q.question) &&
        nonempty(q.hint),
    )
  );
}
export function validFeedback(value) {
  return (
    object(value) &&
    nonempty(value.summary) &&
    nonempty(value.follow_up) &&
    Array.isArray(value.strengths) &&
    value.strengths.length <= 3 &&
    value.strengths.every(
      (s) => object(s) && nonempty(s.quote) && nonempty(s.comment),
    ) &&
    ["improvements", "outline"].every(
      (key) =>
        Array.isArray(value[key]) &&
        value[key].length >= (key === "outline" ? 2 : 1) &&
        value[key].length <= (key === "outline" ? 4 : 3) &&
        value[key].every((s) => nonempty(s)),
    ) &&
    (value.note === undefined || text(value.note, 600))
  );
}
export function validInterviewDraft(value) {
  if (value === undefined) return true;
  if (!object(value)) return false;
  if (value.target !== undefined && !text(value.target, 160)) return false;
  if (value.reviewedKey !== undefined && !text(value.reviewedKey, 60000))
    return false;
  if (
    value.index !== undefined &&
    (!Number.isInteger(value.index) || value.index < 0 || value.index > 4)
  )
    return false;
  if (value.session !== undefined && value.session !== null) {
    const s = value.session;
    if (
      !object(s) ||
      !text(s.contextKey, 65000) ||
      !text(s.role, 160) ||
      !validQuestions(s.questions) ||
      !["starter", "personalized"].includes(s.generation) ||
      (s.notice !== undefined && !text(s.notice, 600))
    )
      return false;
  }
  for (const key of ["answers", "feedback"]) {
    if (value[key] === undefined) continue;
    if (
      !object(value[key]) ||
      Object.keys(value[key]).some((id) => !/^q[1-5]$/.test(id))
    )
      return false;
    if (
      !Object.values(value[key]).every((entry) =>
        key === "answers"
          ? text(entry, 5000)
          : object(entry) &&
            text(entry.answer, 5000) &&
            validFeedback(entry.data),
      )
    )
      return false;
  }
  return true;
}
