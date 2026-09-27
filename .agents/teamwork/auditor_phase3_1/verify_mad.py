import urllib.request
import csv
import io
import sqlite3
import os

# 1. Fetch CSV from /api/export.csv
req = urllib.request.Request(
    'http://localhost:8080/api/export.csv',
    headers={'Cookie': 'session=org_seed_token_2026'}
)
resp = urllib.request.urlopen(req)
csv_text = resp.read().decode('utf-8')

reader = csv.reader(io.StringIO(csv_text))
rows = list(reader)
header = rows[0]
data_rows = rows[1:]

print('CSV Header:', header)
print('Total projects exported in CSV:', len(data_rows))

# 2. Check independent calculation from database
db_path = os.path.join(os.getcwd(), 'prisma', 'prisma', 'dogfood.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Get criteria weights
c.execute('SELECT id, weight FROM RubricCriterion')
weights = {row[0]: row[1] for row in c.fetchall()}

# Get all scores
c.execute('SELECT judgeId, projectId, criterionId, value FROM Score')
scores = c.fetchall()

# Judge -> Project -> weighted sum / weight total
judge_projects = {}
for j_id, p_id, crit_id, val in scores:
    w = weights.get(crit_id, 1.0)
    if j_id not in judge_projects:
        judge_projects[j_id] = {}
    if p_id not in judge_projects[j_id]:
        judge_projects[j_id][p_id] = {'wsum': 0.0, 'wtotal': 0.0}
    judge_projects[j_id][p_id]['wsum'] += val * w
    judge_projects[j_id][p_id]['wtotal'] += w

judge_raw = {}
for j_id, pmap in judge_projects.items():
    judge_raw[j_id] = {}
    for p_id, stats in pmap.items():
        judge_raw[j_id][p_id] = stats['wsum'] / stats['wtotal'] if stats['wtotal'] > 0 else 0.0

# Independent MAD normalisation function
def calc_mad_norm(scores_list):
    if not scores_list:
        return []
    s = sorted(scores_list)
    n = len(s)
    mid = n // 2
    median = s[mid] if n % 2 != 0 else (s[mid - 1] + s[mid]) / 2.0
    devs = sorted([abs(x - median) for x in scores_list])
    mad = devs[mid] if n % 2 != 0 else (devs[mid - 1] + devs[mid]) / 2.0
    if mad == 0:
        return [0.0 for _ in scores_list]
    return [0.6745 * (x - median) / mad for x in scores_list]

judge_norm = {}
for j_id, pmap in judge_raw.items():
    p_ids = list(pmap.keys())
    raw_vals = [pmap[pid] for pid in p_ids]
    norm_vals = calc_mad_norm(raw_vals)
    judge_norm[j_id] = {pid: nv for pid, nv in zip(p_ids, norm_vals)}

# Check zero-variance judges (e.g., jdg_07)
if 'jdg_07' in judge_norm:
    iva_raw = list(judge_raw['jdg_07'].values())
    iva_norm = list(judge_norm['jdg_07'].values())
    print('Iva Petrova (jdg_07) raw scores count:', len(iva_raw), 'sample:', iva_raw)
    print('Iva Petrova (jdg_07) norm scores count:', len(iva_norm), 'sample:', iva_norm)
    assert all(v == 0.0 for v in iva_norm), 'jdg_07 normalized scores should all be 0.0'
    print('PASS: Zero-variance judge Iva Petrova (jdg_07) correctly normalized to 0.0 without divide-by-zero.')

# Cross-check project normalized scores from CSV against independent calculation
discrepancies = 0
for r in data_rows:
    p_id, title, track, raw_str, norm_str, rank_str = r
    norms_for_p = [judge_norm[jid][p_id] for jid in judge_norm if p_id in judge_norm[jid]]
    expected_norm = sum(norms_for_p) / len(norms_for_p) if norms_for_p else 0.0
    csv_norm = float(norm_str)
    if abs(expected_norm - csv_norm) > 0.001:
        print(f'Discrepancy for {p_id}: CSV={csv_norm}, Expected={expected_norm}')
        discrepancies += 1

if discrepancies == 0:
    print('PASS: All 41 project normalized scores in CSV match independent MAD calculation exactly!')
else:
    print(f'FAIL: {discrepancies} discrepancies found.')

conn.close()
