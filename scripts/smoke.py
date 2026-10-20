"""Exercise a running API with the real encoder and a generated DOCX resume.

Run with the backend virtualenv: python scripts/smoke.py
Optional: CAREERBRIDGE_API_URL=http://127.0.0.1:8000
"""
from io import BytesIO
import json
import os
import urllib.error
import urllib.request
import uuid

from docx import Document

BASE = os.environ.get('CAREERBRIDGE_API_URL', 'http://127.0.0.1:8000').rstrip('/')


def request(path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(BASE + path, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as response:
        return json.load(response)


def upload_docx():
    document = Document()
    for line in [
        'Alex Example',
        'Education',
        'BS Computer Science, Example University, 2025',
        'Experience',
        'Software engineering intern at Example Studio',
        'Built a Python and SQL reporting application and a React dashboard.',
        'Skills',
        'Python, SQL, JavaScript, React, Git, teamwork',
    ]:
        document.add_paragraph(line)
    content = BytesIO()
    document.save(content)
    boundary = 'CareerBridge' + uuid.uuid4().hex
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="example.docx"\r\n'
        'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n'
    ).encode() + content.getvalue() + f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(BASE + '/api/resume/extract', data=body,
                                 headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
    with urllib.request.urlopen(req, timeout=60) as response:
        result = json.load(response)
    assert result['extraction_method'] == 'docx_text', result
    assert {'python', 'sql'} <= {s.lower() for s in result['profile']['skills']}, result
    assert 'Computer Science' in result['profile']['education'], result
    assert 'reporting application' in result['profile']['experience'], result
    print('PASS DOCX upload produces an editable profile with education, experience, and skills')
    return result['profile']


def explore(profile, label):
    recommendation = request('/api/careers/recommend', {**profile, 'top_k': 3})
    careers = recommendation['results']
    assert len(careers) == 3 and len({c['id'] for c in careers}) == 3, recommendation
    assert all(-1 <= c['semantic_similarity'] <= 1.001 for c in careers), recommendation
    target = careers[0]
    gap = request('/api/skill-gap', {'career_id': target['id'], 'user_skills': profile['skills']})
    assert gap['career']['id'] == target['id'] and gap['essential_skills'], gap
    roadmap = request('/api/roadmap', {'career_id': target['id'], 'user_skills': profile['skills'], 'weeks': 4})
    assert [m['week'] for m in roadmap['milestones']] == [1, 2, 3, 4], roadmap
    print(f'PASS {label}: real recommendations → skill gaps → four-week roadmap ({target["title"]})')


def main():
    health = request('/api/health')
    assert health['status'] == 'ok' and health['career_records'] == 4059, health
    assert health['embedding_shape'] == [4059, 384], health
    explore({'education': 'BS Computer Science', 'experience': 'Developed web applications',
             'skills': ['Python', 'SQL', 'JavaScript'], 'interests': 'software development'}, 'manual profile')
    explore(upload_docx(), 'reviewed resume profile')
    assert request('/api/data-status')['model_loaded'] is True
    print('All live API smoke checks passed.')


if __name__ == '__main__':
    try:
        main()
    except urllib.error.HTTPError as exc:
        raise SystemExit(f'API check failed: HTTP {exc.code}: {exc.read().decode()}') from exc
