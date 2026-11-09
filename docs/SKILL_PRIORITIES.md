# How career skill priorities are selected

This selection pipeline is shared by all careers, discovery skill suggestions,
and roadmap gap selection. It uses the supplied occupational datasets; it does
not generate new requirements or make live claims about a particular vacancy.

- **O*NET:** workplace tools use `Workplace Example`, not the broad software
  category in `Element Name`. Names such as Structured query language SQL are
  displayed as SQL while retaining the original source label. Both basic and
  transferable skill files are consulted. Suppressed, irrelevant, and low-rated
  entries are excluded; importance must be at least 3 on the supplied scale.
- **ESCO:** use the selected occupation's essential and optional relations,
  including source skill descriptions and skill URIs.
- **Title enrichment:** an O*NET occupation can use ESCO skill detail only if its
  punctuation/plural-normalised title uniquely matches an ESCO preferred title
  or published alternative label. Preferred titles take precedence over aliases.
  Ambiguous matches are skipped. This is a CareerBridge matching rule, **not an
  official crosswalk**. Related entries identify their ESCO occupation in the UI.
  Semantic similarity alone never transfers skills from another occupation—for
  example, Registered Nurses do not inherit Nurse Assistant requirements.

The existing local MiniLM model ranks only the eligible skills for that role.
A diversity adjustment reduces near-duplicate suggestions. Ranking results are
precomputed for the shipped occupational catalogue and cached by occupation
context and labels. The relevance shortlist is bounded at
80 candidates and diversity selection at 40. If model ranking fails, catalogue
order remains available. The 0.75/0.25 ranking weights are engineering choices,
not an independently validated relevance measure.

The shipped `backend/data/skill_rankings.json.gz` contains only ordered indices
for public occupational data, covering all 4,059 career records. Discovery still
encodes the user's story to retrieve relevant careers, but does not re-encode
their fixed skill catalogues on each request. Keys include the model name,
ranking version, career context, and exact skill text. Missing, changed, or
invalid entries fall back to live ranking. No user profiles are stored in this
artifact. See [performance measurements and rebuild instructions](DISCOVERY_PERFORMANCE.md).

Technology ordering prefers supplied O*NET in-demand flags, then a small list
of portable foundations (Python, SQL, R, JavaScript, Java, Git, Excel, HTML, CSS)
**only when that occupation actually lists them**. This is an editorial learning
priority, not a measured ranking of job-market frequency. No role receives these
tools merely because they are common elsewhere.

The main view selects up to 12 practical skills and 8 tools. If no practical
skill detail is available, it also includes up to four broad foundations.
Further catalogue entries and supporting foundations remain expandable. Some
occupations have limited source detail: tool lists and broad capabilities do
not replace specialist training, licensing requirements, or a full job description.

Each expandable skill explains its catalogue description/source where available.
Tools are explicitly presented as alternatives to review against a target job,
not a requirement to learn every competing package.

Coverage measures only the selected learning priorities. Exact/alias matches and
user confirmations count; semantic evidence still requires confirmation. This is
not an employability, proficiency, or qualification score. Additional catalogue
entries are outside that denominator. Roadmap targets balance remaining practical
skills, tools, and foundations; listed/confirmed priority skills are excluded.
Previously saved roadmaps remain snapshots until regenerated and saved again.

Regression tests check source provenance across data science, software development,
nursing, electrical work, graphic design, civil engineering, and cooking, plus an
ESCO occupation, outage fallback, matching of Python/SQL, and roadmap exclusions.
Browser tests exercise both interfaces, source details, confirmation, and mobile
layout. These checks verify behaviour and provenance; independent domain-expert
review is still needed to evaluate the relevance of the selected learning priorities.
