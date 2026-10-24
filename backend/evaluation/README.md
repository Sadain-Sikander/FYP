# Skill evidence evaluation

This evaluates retrieval of **evidence worth asking the user about**, not competence,
employability, or ATS performance. Semantic and fuzzy matches never increase
coverage or remove a learning target until the user confirms them.

## What changed

The original matcher compared listed skill names using aliases and fuzzy text.
The hybrid matcher keeps exact/alias matches, then uses the existing pretrained
`sentence-transformers/all-MiniLM-L6-v2` to retrieve related evidence from listed
skills, experience, and education. It returns the original evidence text and its
source. Aspirational/negative statements are conservatively excluded; this is a
simple language filter, not a trained negation or entailment model.

No model was trained or fine-tuned. There is no external LLM call. The first model
download requires connectivity; subsequent inference can use the local cache.

## Dataset and protocol

`skill_pairs.json` contains 72 author-curated synthetic examples, written before
model scoring: 24 development examples and 48 test examples. Labels are
provisional and **have not been independently reviewed by domain experts**.
They include aliases, paraphrased evidence, unrelated skills, negation,
aspirations, adjacent skills, and participant-versus-practitioner examples.

A cosine threshold of **0.42** was selected by development F1 (ties prefer precision,
then a higher threshold), sweeping 0.40–0.80 in increments of 0.02. The development
sweep is retained in `development-thresholds.json`. The threshold was frozen before
inspecting test metrics. Test results were not used to retune it.

The script uses the production matcher with cached embeddings, so its decisions
follow the same evidence filtering and confirmation policy as the API. It compares:

- **Original rules:** only explicit skill-list input, matching the previous feature.
- **Rules with the same evidence:** fuzzy matching also receives the supplied prose.
- **Hybrid candidates:** explicit matches plus suggestions requiring confirmation.

## Observed test results

48 examples: 23 positive and 25 negative. Counts and errors are in `results.json`.

| Method | Precision | Recall | F1 | TP / FP / FN / TN |
| --- | ---: | ---: | ---: | --- |
| Original rules | 1.000 | 0.174 | 0.296 | 4 / 0 / 19 / 25 |
| Rules with the same evidence | 1.000 | 0.174 | 0.296 | 4 / 0 / 19 / 25 |
| Hybrid candidates | 0.696 | 0.696 | 0.696 | 16 / 7 / 7 / 18 |

The hybrid finds substantially more candidate evidence in this small fixture, at
the cost of false suggestions. These numbers are **not production accuracy**.
False positives include adjacent programming languages, a participant described
as a practitioner, and basic versus advanced skill levels. False negatives include
backend development and active listening paraphrases. Similarity alone is not
sufficient to establish that a person has a skill.

The product therefore asks **Yes, I have this skill / Not yet**, supports undo,
and leaves all unconfirmed skills in the roadmap. Model failures retain explicit
and fuzzy results with a visible fallback message. User decisions are per career,
survive same-tab refresh, and reset when the profile changes.

## Reproduce

From the repository root, using the backend virtual environment:

```bash
python backend/evaluation/evaluate_skills.py --tune
python backend/evaluation/evaluate_skills.py --output /tmp/skill-evaluation.json
```

In this cloud workspace, prepend `HF_HOME=/workspace/.cache/huggingface
HF_HUB_OFFLINE=1` and use `/workspace/.venvs/fyp/bin/python` once the model is cached.
The script never trains or changes the production threshold automatically.

For a defensible FYP study, collect consented, de-identified profile examples,
obtain independent domain-expert labels, measure annotator agreement, and split
by person/occupation before tuning. Report precision/recall by domain and include
user-confirmation acceptance rates. This fixture is an initial reproducible
engineering benchmark, not a substitute for that study.
