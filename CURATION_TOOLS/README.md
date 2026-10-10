# Upstream Curation Tools

These tools predate the mature Cart Builder and feed its source curation CSVs.

They are preserved here because the current builder still relies on curated branding/commercial CSVs.

The exact current live archive/curation state is **not** bundled in this checkpoint.

Relevant tools:

```text
Scan-RetroBranding.ps1
Build-BrandingReview.ps1

Scan-RetroCommercials.ps1
Build-CommercialReview.ps1
Build-CommercialReview-v2.ps1
Build-2000sCommercialReview.ps1
```

For one-off branding, prefer the newer Cart Builder helper:

```powershell
.\Add-HandpickedBranding.ps1
```

For a future public release, consolidate these separate workflows into a cleaner import/asset-manager experience.
