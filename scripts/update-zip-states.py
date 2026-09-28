"""Regenerate exact ZIP membership ranges from GeoNames (CC BY 4.0)."""
import io
import json
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

source = 'https://download.geonames.org/export/zip/US.zip'
with urllib.request.urlopen(source, timeout=30) as response:
    archive = zipfile.ZipFile(io.BytesIO(response.read()))
rows = archive.read('US.txt').decode('utf-8').splitlines()
states = defaultdict(set)
for row in rows:
    fields = row.split('\t')
    if len(fields) > 4 and len(fields[1]) == 5 and fields[1].isdigit() and fields[4]:
        states[int(fields[1])].add(fields[4])
# Ambiguous assignments are omitted rather than inferred.
entries = sorted((code, next(iter(names))) for code, names in states.items() if len(names) == 1)
ranges = []
for code, state in entries:
    if ranges and ranges[-1][1] + 1 == code and ranges[-1][2] == state:
        ranges[-1][1] = code
    else:
        ranges.append([code, code, state])
path = Path(__file__).resolve().parents[1] / 'lib/data/us-zip-states.json'
path.write_text(json.dumps(ranges, separators=(',', ':')) + '\n')
print(f'{len(entries)} ZIP codes; {len(ranges)} exact membership ranges; {path.stat().st_size} bytes')
