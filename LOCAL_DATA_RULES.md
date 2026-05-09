# Hyper-Local DUI Data Rules

Use this file when adding or updating city DUI pages.

## Safety Rule

Use historical, official, and public local data only.

Do not publish:

- Upcoming DUI checkpoint locations
- Expected checkpoint times
- Patrol locations or "where police usually sit"
- Advice for avoiding DUI enforcement
- Named private individuals from routine arrest records
- Unverified social media claims

Safe data includes:

- Past impaired-driving campaign results
- Police annual-report totals
- Official state DUI fact-book data
- County crash or traffic-safety data
- Local court and license-process context
- Local road, courthouse, and jurisdiction context
- Official agency contacts and source links

## Data Shape

Add optional `dui_local_data` to a city record in `site-data.mjs`.

```js
dui_local_data: {
  enforcement_snapshot: {
    summary: "",
    source_name: "",
    source_url: "",
    source_date: "",
  },
  past_campaigns: [
    {
      campaign_name: "",
      date_range: "",
      results_summary: "",
      source_name: "",
      source_url: "",
    },
  ],
  arrest_data: {
    city_level_available: false,
    summary: "",
    year: "",
    source_name: "",
    source_url: "",
  },
  crash_context: {
    summary: "",
    source_name: "",
    source_url: "",
  },
  local_roads: [],
  jurisdiction_notes: [
    {
      agency: "",
      role: "",
      notes: "",
    },
  ],
  data_availability_note: "",
}
```

The DUI local-data module renders only when at least one field has content.

## Preferred Research Workflow

For each city, create or update a local data row with:

- `city`
- `state`
- `county`
- `police_department`
- `annual_report_url`
- `dui_arrests_city`
- `dui_arrests_year`
- `impaired_campaign_url`
- `campaign_results`
- `major_roads`
- `state_police_troop`
- `county_court`
- `state_license_agency`
- `official_sources`
- `last_verified`

## Source Priority

Use sources in this order:

- City police department annual reports
- City police or official municipal press releases
- State highway-safety campaign results
- State DUI fact books
- County crash or safety reports
- State police or highway patrol public statistics
- Court or circuit-clerk public resources

If city-level DUI arrest data is unavailable, say that clearly and use labeled county/state context instead.

