## ⚠️ Deprecated!

**This repository is deprecated.** <br />
A more up-to-date version of panel plugin examples is available here: https://github.com/grafana/grafana-plugin-examples#panel-plugins

**Examples:**
- [panel-basic](https://github.com/grafana/grafana-plugin-examples/blob/main/examples/panel-basic) - demonstrates how to build a panel plugin that uses the time series graph
- [panel-flot](https://github.com/grafana/grafana-plugin-examples/blob/main/examples/panel-flot) - demonstrates how to use the Flot plotting library in a panel plugin.
- [panel-plotly](https://github.com/grafana/grafana-plugin-examples/blob/main/examples/panel-plotly) - demonstrates how to use the Plotly graphing library in a panel plugin.

---

# Grafana Panel Plugin Template

[![Build](https://github.com/grafana/grafana-starter-panel/workflows/CI/badge.svg)](https://github.com/grafana/grafana-starter-panel/actions?query=workflow%3A%22CI%22)

This template is a starting point for building Grafana Panel Plugins in Grafana 7.0+

## What is Grafana Panel Plugin?

Panels are the building blocks of Grafana. They allow you to visualize data in different ways. While Grafana has several types of panels already built-in, you can also build your own panel, to add support for other visualizations.

For more information about panels, refer to the documentation on [Panels](https://grafana.com/docs/grafana/latest/features/panels/panels/)

## Getting started

1. Install dependencies

   ```bash
   yarn install
   ```

2. Build plugin in development mode or run in watch mode

   ```bash
   yarn dev
   ```

   or

   ```bash
   yarn watch
   ```

3. Build plugin in production mode

   ```bash
   yarn build
   ```

## Dashboard generator editing

Simple mode edits dashboard/panel titles, panel descriptions, and text content, and supports adding text panels, duplicating, reordering, and removing panels. It preserves existing queries and visualization settings. Use Complex mode for SQL, result formats, and visualization configuration; generation no longer creates query variants.

**Update preview** saves the current editor JSON to Grafana and reloads the embedded dashboard so edits are visible. Manual preview updates validate JSON/panel structure only.

### Generated SQL validation and repair

Generation validates dashboard JSON and active PostgreSQL panel queries locally using the JavaScript `pgsql-ast-parser` package; no PostgreSQL installation is required. The validator checks syntax, a single SELECT statement (including SELECT-only CTEs), and resolvable table/column references. Nested row panels are checked; hidden targets are skipped.

#### Model selection and richer schema context

Settings includes **GPT-6 Luna** using the user-supplied model ID `gpt-6-luna`. This is not a verified OpenAI model listing: your OpenAI API key must have access to that exact ID, and it must support the Responses API. Unsupported/unavailable model errors are displayed with the model ID and API explanation; there is no silent fallback to another model. Model selection alone does not guarantee better SQL.

Generation automatically resolves **Grafana's default datasource**, which must be PostgreSQL. There is no datasource selector in plugin Settings. Schema discovery, automatic bounded lookups, and generated SQL panels are bound to the default datasource's concrete UID resolved at the start of generation, so they cannot independently switch to a dashboard datasource variable. Model-generated references, query variables, and SQL annotations are bound to that same UID; legacy manually edited dashboards retain datasource-variable support.

The plugin does **not** use a separate PostgreSQL username/password. It sends the UID and SQL to Grafana's `/api/ds/query` backend route; Grafana connects using that datasource's stored server-side credentials, just as it does for dashboard queries using the same UID. Passwords are never read, copied into the browser, or sent to the model. The OpenAI key is unrelated to database authentication. Successfully saving dashboard JSON does not execute its SQL or prove that its database role has SELECT access.

Application settings contain view mode and the save button, without connection checks or datasource help text. Existing saved datasource overrides are ignored; the backend's legacy UID column is retained for backward compatibility, and settings saves use the original five fields.

When PostgreSQL reports permission denied, the plugin makes one separate read-only identity query through the failed query's UID, requesting `current_user`, `session_user`, and `current_database()`. The error then shows the probe's effective role, login role, and database (no password). This is a separate query and may use a different pooled connection; it is not a guarantee of the original session's identity. If the probe fails, the original error is preserved. Grafana-level Forbidden errors do not normally trigger this PostgreSQL identity probe. No role changes, grants, or privilege elevation are performed. Required schema-discovery permission failures stop generation. Optional lookup failures instead produce a visible warning and allow generation to continue with available metadata/evidence. The denied SQL is not retried or sent to the model for SQL repair; only a sanitized lookup outcome (table/columns/status, not database-role diagnostics) informs generation.

Schema discovery includes available catalog metadata without filtering on schema/table/column grants. Metadata visibility is not a permission test. Empty metadata indicates a discovery/datasource visibility issue, not proof that dashboard queries lack access. If the default connection still lacks table SELECT privileges, a Grafana/database administrator must correct its access or default datasource configuration.

The model receives grouped table/view definitions, exact schema/column names and types, nullability, defaults, table/column comments when present, and declared primary/unique/foreign keys. Composite key and foreign-key column order is preserved. Prompt text is capped at 20,000 characters, with whole-table omission notices rather than partial definitions; individual comments/defaults are bounded. The full returned schema remains available for local validation.

The generation prompt requires explicit catalog-listed columns (no `SELECT *`), exact identifiers, declared join relationships, aggregation at the intended grain, deliberate NULL handling, and appropriate time-series/stat/categorical result shapes. Catalog comments/defaults are treated as data, not instructions; units, enum values, timestamp meanings, and actual row contents are not inferred. Missing fields produce explanatory text panels instead of invented SQL. These are generation instructions, not guarantees of semantic correctness.

#### Automatic intermediate discovery

Before generating, the model may propose at most **three** structured lookups based on catalog metadata and the request: scalar ID/label/category values from one table (up to three columns), optionally matched using an escaped literal substring, or a MIN/MAX range from one date/timestamp column. The plugin builds the SQL itself; arbitrary model SQL, joins, expressions, unknown columns, opaque data types, and obvious sensitive columns are rejected before execution.

Validated lookups run automatically through Grafana's resolved default datasource, without SQL-approval or value-sharing dialogs. Values use DISTINCT/ORDER BY/LIMIT 21, retaining at most 20 rows; date ranges return a single aggregate row. Strings are bounded to 200 characters and time fields are normalized to ISO8601. Successful results are automatically included in the configured model's generation request.

Unknown table/column and malformed-JSON plan errors include exact catalog context and allow **one** model repair attempt. SQL output aliases (for example `time`) and expressions are not physical lookup columns. The planner also receives a bounded excerpt of the current dashboard to prefer relevant existing SQL relationships; this is context, not proof that its SQL works. When schema text is truncated, the generator appends request-relevant table definitions selected from the full discovered catalog (for example item/category/stock/history tables) so omitted tables are not invisible merely because they sort late alphabetically. Every repaired plan passes the same strict validation before execution. Sensitive-column and arbitrary-SQL plans are not repaired or executed.

If a matched `values` lookup returns no rows, the plugin automatically runs the same bounded lookup without the match to expose actual values from that column. If a plan remains invalid, or an optional lookup fails (including permission errors, timeouts, or invalid result layouts), generation continues with catalog metadata and any successful lookup evidence. Duplicate lookup SQL is executed at most once. Warnings remain visible after generation. Failed lookups are reported as unavailable, not empty data or proof that every query on a table is forbidden; valid catalog columns are not removed because an optional lookup failed. Missing evidence must not be replaced with invented IDs/categories: the model is instructed to use supported alternatives or explanatory text panels.

Required datasource/schema discovery, model-service failures outside optional repair, final dashboard/SQL validation, and dashboard-save errors remain fatal. Optional fallback does not guarantee runtime access or correct data and does not change database grants.

Generation uses catalog metadata plus lookup evidence to distinguish actual IDs from names, select valid categories/date ranges, and avoid inventing predicates. Bounded results are not exhaustive; truncated values are not exact filter values. The prompt also includes known-working SQL examples from this database for dispensed antibiotic units, top antibiotic items, mSupply monthly usage, and prescription category totals, plus an embedded business glossary for the core operational tables (`transact`, `trans_line`, `item`, `store`, `transaction_category`, and `d_msupply_monthly_usage`). These examples and glossary entries are treated as reusable relationship and time-filtering patterns, not mandatory output or proof that every literal applies. Calendar-month time series are instructed to use a native timestamp expression such as `date_trunc('month', column)::timestamp AS "time"`.

After normal SQL validation, generated dashboards are checked against the lookup evidence. SQL that filters text/category columns using unconfirmed string literals, invents absolute date windows when the user gave no time range and no dateRange evidence exists, or hides no-match aggregate results with `COALESCE(..., 0)` is sent through up to two repair attempts. Deliberate `COALESCE(..., 0)` in a `LEFT JOIN` dimension query, such as complete category totals, is allowed. If it still cannot be made evidence-safe, generation fails instead of saving a misleading dashboard. Literal checks are static and conservative: if a valid filter is rejected, add or repair the lookup evidence rather than granting unrelated table permissions.

The planner adds one model call, plus at most one repair call when its identifiers or JSON are invalid; it does not repeatedly explore the database or capture/render graphs. Output is bounded, but DISTINCT/ILIKE/MIN/MAX may still scan a large table; configure appropriate datasource/database timeouts. Results are not logged. Name-based sensitive-column screening is not a complete privacy classifier: use a datasource exposing only data appropriate to share with the configured model. The existing confirmation before replacing the dashboard is unchanged.

#### SQL repair and limitations

Grafana time macros and template variables are normalized in a validation copy only; saved SQL is unchanged. Supported macros include time/timeEpoch, timeFilter, timeGroup/timeGroupAlias, timeFrom/timeTo and their unixEpoch equivalents, plus interval placeholders. Unknown macros are reported rather than silently accepted. Dynamic identifiers, ambiguous database search paths, and projections whose columns cannot be inferred receive best-effort schema checks, not guesses.

If validation fails, the generator sends the candidate JSON and errors (including panel ID, target refId, and failed SQL) back to the selected model. It allows at most **two repair attempts**, revalidating each response. Only a successfully validated candidate is saved and placed in the editor; unresolved errors are shown without saving over the previous dashboard.

Validation does **not** execute generated SQL, EXPLAIN, or trial queries. Existing schema discovery still uses Grafana's configured datasource and requires access to PostgreSQL metadata. Required schema-discovery failures stop generation and are not sent through SQL repair; optional lookup failures instead use the warning/fallback behavior described above. Validation cannot verify database permissions, function availability, type compatibility, variable expansion at runtime, or visualization result shapes. The local parser supports a subset of PostgreSQL syntax and can reject advanced valid constructs. Grafana still executes the final queries to render the dashboard; runtime permission errors must be resolved in the datasource/database.

#### Prompt diagnostics

Open browser developer tools (**F12 → Console**) on the generator page, enable **Preserve log**, and filter for `[Dashboard generator]` before generating. Every outgoing model request logs its stage (`discovery-plan`, `discovery-repair`, `dashboard-generation`, or `sql-repair`), model ID, and full sanitized prompt **before** the HTTP request is sent. The logged prompt is the exact `input` sent to the Responses API, including schema context and bounded lookup evidence when available.

A preceding **Schema summary** log includes the resolved datasource UID, total discovered table/column counts, metadata text length, and whether the prompt's schema text was truncated. Counts describe the full discovered catalog, not proof that every table/column fitted in the prompt or is readable. Expand each request's `prompt` to inspect exactly which definitions were passed.

Logs appear in the browser console, not PostgreSQL logs. Known configured OpenAI/Claude API keys are redacted from prompt text before logging and transmission; authentication headers remain unchanged and are never logged. Other prompt data (SQL, metadata/comments, user descriptions and lookup values) may be confidential, so do not share logs publicly. The production build script uses `--preserveConsole` so these diagnostics are not stripped from the built plugin.

The editor scrolls independently with its action buttons outside the scroll area. On small screens the columns stack and the page can scroll; the embedded Grafana dashboard has its own scroll area.

## Learn more

- [Build a panel plugin tutorial](https://grafana.com/tutorials/build-a-panel-plugin)
- [Grafana documentation](https://grafana.com/docs/)
- [Grafana Tutorials](https://grafana.com/tutorials/) - Grafana Tutorials are step-by-step guides that help you make the most of Grafana
- [Grafana UI Library](https://developers.grafana.com/ui) - UI components to help you build interfaces using Grafana Design System
