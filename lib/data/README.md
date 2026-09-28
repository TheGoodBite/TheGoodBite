# US ZIP state lookup

`us-zip-states.json` contains exact ZIP-to-state memberships from [GeoNames US postal data](https://download.geonames.org/export/zip/US.zip), downloaded September 28, 2026. GeoNames data is licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution: GeoNames, https://www.geonames.org/.

Only consecutive known ZIP codes with the same state are compressed into inclusive numeric ranges. Gaps and ambiguous state assignments are omitted; this is not a heuristic based on broad postal prefixes. Missing codes cannot establish a same-state match. The data describes postal assignments, not physical distance or stock availability.

Run `python3 scripts/update-zip-states.py` to refresh. No geolocation API is called at search time. Update the download date here when refreshing.
