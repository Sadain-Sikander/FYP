export const levels = [
  "High school diploma or equivalent",
  "Associate’s degree",
  "Bachelor’s degree",
  "Master’s degree",
  "Doctorate or professional degree",
  "Professional certificate",
  "Vocational or technical certificate",
  "Industry certification",
  "Other / independent learning",
];
export const initialDiscovery = () => ({
  stage: "role",
  view: "identity",
  role: "",
  level: "",
  subject: "",
  detail: "",
  entryType: "auto",
  started: false,
  identityText: null,
  identityFingerprint: "",
  wording: 0,
});
export function uniqueWords(value) {
  const seen = new Map();
  String(value || "")
    .split(/[,;\n]/)
    .map((word) => word.trim())
    .filter(Boolean)
    .forEach((word) => {
      if (!seen.has(word.toLowerCase())) seen.set(word.toLowerCase(), word);
    });
  return [...seen.values()];
}
export const entries = (value) =>
  String(value || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
export const fingerprint = (form) => JSON.stringify(form);
export function identityStatement(form, variant = 0) {
  const skills = uniqueWords(form.skills);
  const education = entries(form.education);
  const experiences = entries(form.experience);
  const parts = [];
  if (education.length)
    parts.push(`My learning includes ${education.join("; ")}.`);
  if (experiences.length)
    parts.push(`My experience includes ${experiences.join("; ")}.`);
  if (skills.length) parts.push(`I bring skills in ${skills.join(", ")}.`);
  if (form.interests.trim())
    parts.push(`I’m interested in ${form.interests.trim()}.`);
  if (form.career_goals.trim())
    parts.push(`My next goal is to ${form.career_goals.trim()}.`);
  if (variant % 2 && parts.length > 1) parts.unshift(parts.pop());
  return parts.join(" ");
}
