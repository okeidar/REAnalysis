# Context:
We have simplified the Chrome extension to use only a single default mode with a structured tabular output format. The export function needs to be updated to work with this new prompt output format that produces markdown tables with specific data points.

# Requirements:
- Remove all legacy code and backward compatibility for old modes (dynamic, tabular, custom)
- Update CSV export to work with the new simplified prompt output format
- Extract data directly from the saved ChatGPT response output
- Remove all column configuration systems and complex data mapping
- Simplify the export function to parse the actual saved ChatGPT response output directly

# Tasks:
- [ ] Remove legacy column systems and data mapping functions
- [ ] Update CSV export to parse markdown table format from saved ChatGPT output.
- [ ] Remove all backward compatibility code for old prompt modes
- [ ] Update export UI to reflect the simplified system
- [ ] Remove unused functions related to column configuration
- [ ] Test CSV export with the new prompt format


