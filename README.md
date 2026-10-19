# CareerBridge AI — FYP Starter (Phase 1)

This is the first working stage of your FYP: a React frontend and FastAPI backend using the uploaded O*NET/ESCO career data and `career_embeddings.npy`.

## Included in this stage
- Manual profile form
- Semantic career recommendations using `all-MiniLM-L6-v2`
- Role skill-gap comparison using O*NET and ESCO data
- Rule-based starter learning roadmap
- Health/data-status endpoints

## Not included yet
- Resume PDF/DOCX upload and extraction
- Editable resume-extracted profile flow
- Resume rewriting suggestions
- Job-description-specific ATS estimate
- User accounts or cloud database
- Curated learning-resource links

These should be added only after this base workflow runs reliably.

## Requirements
- Python 3.10 or 3.11 recommended
- Node.js LTS and npm
- Internet access on the first backend run so Sentence Transformers can download `sentence-transformers/all-MiniLM-L6-v2`, unless the model is already cached locally.

## Start the backend (Windows PowerShell)
Open a terminal in the project folder:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API should be available at http://127.0.0.1:8000 and interactive API documentation at http://127.0.0.1:8000/docs.

If PowerShell blocks activation, you can use Command Prompt instead:
```bat
.venv\Scripts\activate.bat
```

## Start the frontend
Open a second terminal in the project folder:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173.

Keep the backend terminal running while you use the website.

## Important model note
`career_embeddings.npy` contains precomputed career vectors, not the model weights. To embed a new user profile, the backend loads the same model name used in the notebook: `sentence-transformers/all-MiniLM-L6-v2`. The backend checks that the CSV and embedding row counts match. The API reports semantic similarity for ranking; it does not claim that the score is a probability of career success.

## Data integrity
The 4,059 career rows and 4,059 embeddings were validated to have matching row counts and the expected order: O*NET rows followed by ESCO rows. Four ESCO occupation IDs appear twice in the unified CSV; the recommendation endpoint suppresses duplicate IDs in its results. Do not reorder or deduplicate `unified_careers.csv` without applying the exact same row changes to `career_embeddings.npy`.

The Pakistan Labour Force Survey files were intentionally not included in this starter ZIP. They are not needed for the first working prototype.

## Suggested next milestones
1. Run the app and test recommendations with several example profiles.
2. Fix issues found in the data or skill normalization.
3. Add PDF/DOCX resume extraction that fills the same editable profile form.
4. Add resume quality feedback and job-description-based ATS estimation.
5. Add curated learning resources, progress saving, and evaluation tests.
