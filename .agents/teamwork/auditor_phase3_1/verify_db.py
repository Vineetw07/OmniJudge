import urllib.request
import json
import sqlite3
import os

db_path = os.path.join(os.getcwd(), 'prisma', 'prisma', 'dogfood.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute('SELECT count(*) FROM Score')
before_scores = c.fetchone()[0]
c.execute('SELECT count(*) FROM AuditLog')
before_audits = c.fetchone()[0]

c.execute('SELECT id, name FROM RubricCriterion')
criteria = c.fetchall()
print('Criteria in DB:', criteria)

# Find project in trk_01
c.execute("SELECT id, title, trackId FROM Project WHERE trackId = 'trk_01' LIMIT 1")
project = c.fetchone()
print('Project in trk_01:', project)

payload = {
    'projectId': project[0],
    'scores': [{'criterionId': criteria[0][0], 'value': 4.5}],
    'comment': 'Auditor forensic verification score'
}

req = urllib.request.Request(
    'http://localhost:8080/api/judge/scores',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'Cookie': 'session=jdg_a_seed_token_2026'},
    method='POST'
)

resp = urllib.request.urlopen(req)
print('Submit Response Status:', resp.status, resp.read().decode())

c.execute('SELECT count(*) FROM Score')
after_scores = c.fetchone()[0]
c.execute('SELECT count(*) FROM AuditLog')
after_audits = c.fetchone()[0]
c.execute('SELECT id, userId, action, payload, createdAt FROM AuditLog ORDER BY createdAt DESC LIMIT 1')
latest_audit = c.fetchone()

print(f'Score count: before={before_scores}, after={after_scores}')
print(f'AuditLog count: before={before_audits}, after={after_audits}')
print('Latest AuditLog entry:', latest_audit)
conn.close()
