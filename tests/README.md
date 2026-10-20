# Scoring audit

Run `node tests/scoring-audit.cjs` from the repository root (no dependencies). Optionally pass a JSON report path.

The fixture was extracted from the Air Force Services-hosted official PFRA PDF, effective 1 March 2026, on 20 October 2026. Its source URL and SHA-256 are in the fixture. Direct AFPC download of the corrected March 17 PDF returned 403, so the fixture is explicitly NOT certified against that revision. Replace it only after extracting and reviewing the current official document; do not generate it from application data.

Known source ambiguity: male 30–34 push-ups repeats 26 reps for 3.0 and 2.5 points. Tests retain both printed rows and use the highest achieved point value.

Tests cover all 126 standard event/age/sex tables, whole-value scoring domains, WHtR boundaries, age boundaries, and composite rating rules including missed physical minima. Color badge categories are UI helpers, not official component ratings.
