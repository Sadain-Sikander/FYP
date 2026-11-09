# Discovery skill suggestion performance

Previously, a discovery request ranked the fixed skill catalogues of eight
retrieved occupations with repeated model calls. The shipped ranking index
moves that work to a build step, using the same MiniLM model and diversity
algorithm. User-story encoding and career retrieval still happen per request.

An isolated cloud CPU run on 2026-11-09 produced the following results:

| Synthetic subject | Live ranking | Precomputed ranking | Encoder calls before → after |
| --- | ---: | ---: | ---: |
| Information Technology | 5.097 s | 0.547 s | 15 → 1 |
| Nursing | 3.273 s | 0.233 s | 15 → 1 |
| Business administration | 3.940 s | 0.211 s | 15 → 1 |

All three returned identical suggestion lists. These are single observations
with a warm model and cold role-ranking/metadata-index caches, not latency
guarantees. Model import, download, loading, network, and browser rendering are
excluded. Hardware and concurrent requests affect results. The UI also lets
users continue with three manually entered skills while suggestions load.

To reproduce, activate the backend environment and run from the repository root:

```bash
python scripts/benchmark_discovery.py
```

The benchmark compares both paths in an isolated process; it does not alter the
running API or saved user data. The model must be cached or downloadable.

## Rebuilding the public index

Normal users do not need to rebuild it. Developers should regenerate after
changing the occupational datasets, model, or ranking algorithm:

```bash
python scripts/build_skill_rankings.py
```

Commit both `backend/data/skill_rankings.json.gz` and its adjacent manifest.
The manifest records source-file hashes and catalogue coverage. Bump
`RANKING_VERSION` in `backend/app/role_skills.py` when the ranking algorithm or
model revision changes, even if the model name stays the same. The artifact
contains public-data ranking indices only, with no user input. Exact content
keys prevent changed occupation/skill text from reusing stale entries; invalid
or missing entries use the live ranking fallback.
