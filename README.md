# ClaimFlow

A real-time health-insurance **claims adjudication** simulator modeled on UnitedHealthcare / Optum (payer ID 87726). All members, providers and claims are synthetic.

Live: https://dist-edzrelos.devinapps.com

## What it does
- Streams synthetic 837P (professional) and 837I (hospital inpatient) claims through a 10-stage engine: intake/999, eligibility and timely filing, provider/network, benefits and prior auth, COB, coding (NCCI/MUE/sex edits), medical necessity, duplicate/FWA integrity, pricing and decision.
- Hospital claims are priced by MS-DRG: base rate × DRG weight × plan/contract factor, plus a cost outlier, capped at billed charges. DRG validation pends or regroups upcoded stays (CO-150).
- Trends tab: 10-second time series for volume, auto-adjudication, denial and pend rates, and dollars, plus breakdowns by plan and claim type.
- Outcomes: PAID, PARTIAL, DENIED, PENDED, REJECTED, plus INTERCEPTED (Optum Real point-of-care mode). Each decision comes with a full trace and CARC codes.
- Examiner work queues, appeals (overturn/uphold), payment-integrity mining and recoveries, configurable rules, and a Learn page with a Plain English toggle.
- Outputs per claim: EOB, 835 ERA, 837P/837I, 277 and 999, all downloadable, plus a CSV export.
- Installable offline PWA with no backend. State is kept in `localStorage`.

## Build and run
```bash
python3 build.py                      # inlines src/ into dist/index.html (+ sw.js, manifest, icons)
cd dist && python3 -m http.server 8765
```

## Test
```bash
pip install playwright
python3 test_ui.py   # drives every tab at desktop and phone widths over Chrome CDP (localhost:29229)
```
