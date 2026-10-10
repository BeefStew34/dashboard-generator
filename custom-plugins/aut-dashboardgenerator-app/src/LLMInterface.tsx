import { saveDashboardFromJson } from 'DashboardModel';
import { currentSettings as settings } from './Settings';
import { loadSettings } from './usersetting';
import axios from 'axios';
import { getDataSourceType, getSchemaText } from 'DataSourceInterface';


type OpenAIResponse = {
  output_text?: string; 
  output: Array<{
    type: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
};

const extractResponse = (
  data: OpenAIResponse
): string => {
  if (data.output_text) {
    return data.output_text;
  }

  const message = (data.output || []).find(
    item => item.type === 'message'
  );

  return (
    message?.content
      ?.filter(content => content.type === 'output_text')
      .map(content => content.text ?? '')
      .join('') ?? ''
  );
};

const AskOpenAI = async (prompt: string) => {
    const key : string = settings["OpenAIKey"];
    const model : string = settings["Model"];
    if (!key || !model) {
  throw new Error(
    'Save an OpenAI key and model ID in Settings first.'
  );
}
    
    const post_data = {
        "input": prompt,
        "model": model
    };
    const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
    };

    const { data, status } = await axios.post<OpenAIResponse>(
      'https://api.openai.com/v1/responses',
      post_data,
      { headers }
    );



    if (status !== 200) return null;

    return extractResponse(data);
};

const TempPromt: string = `
  You are a grafana dashboard generator.
  You will be given a user prompt and you will generate a corresponding Grafana dashboard.
  Use this data source reference on every panel and target, exactly as written: {"type": "{ds_type}", "uid": "{ds_uid}"},
  Always set the dashboards name to "dashboard-generator-last-dashboard"
  Here is the data source information:
  {datasource_info}
  Here is an the JSON spec
  Grafana 8.5 Dashboard JSON Specification
  Reference for LLM-generated dashboards. Target: Grafana 8.5.x, schemaVersion 36.
  1. Rules for the generating model
  • Output exactly one valid JSON object and nothing else: no prose, no markdown fences, no comments, no trailing commas.
  • Use only the fields and values documented here. Do not invent fields, panel types or option names.
  • New dashboards: id is null, version is 0, schemaVersion is 36.
  • Every panel id is a unique positive integer. Every target refId is unique within its panel (A, B, C...).
  • Use only the data source type and UID supplied by the user, verbatim. Never invent table or column names.
  • Prefer current panel types: timeseries, stat, gauge, bargauge, barchart, piechart, histogram, table, text. Avoid legacy graph, singlestat, table-old and heatmap.
  • Place panels on the 24-column grid with no overlaps (section 6).
  • Pick the panel type that fits the data shape (section 13).
  • When a value is not specified by the user, use the defaults given in this document.
  2. Output envelope
  This plugin's editor stores the dashboard wrapped in a single key:
  { "dashboard": { } }
  The model outputs that wrapper; the plugin unwraps it before calling Grafana. If your plugin expects the bare dashboard object, delete this section and output the dashboard object directly.
  3. Top-level dashboard object
  {
    "id": null,
    "uid": "visitors-overview",
    "title": "Visitors Overview",
    "description": "",
    "tags": ["generated"],
    "timezone": "browser",
    "editable": true,
    "graphTooltip": 0,
    "liveNow": false,
    "fiscalYearStartMonth": 0,
    "weekStart": "",
    "refresh": "",
    "schemaVersion": 36,
    "version": 0,
    "time": { "from": "now-6h", "to": "now" },
    "timepicker": {},
    "templating": { "list": [] },
    "annotations": { "list": [] },
    "links": [],
    "panels": []
  }
  • id (number or null): internal database id. Always null when creating; Grafana assigns it.
  • uid (string): stable unique identifier, 1 to 40 characters from a-z A-Z 0-9 - _. It forms the URL (/d/<uid>/<slug>). Saving again with the same uid and overwrite: true updates that dashboard. Use null to let Grafana generate one.
  • title (string, required): display name. Must be unique within its folder.
  • description (string): free text shown in dashboard lists.
  • tags (string[]): labels used for search and for dashboard-link filters.
  • timezone (string): browser, utc, an empty string (user or org default), or an IANA name such as Europe/London.
  • editable (boolean, default true): false locks the dashboard against edits in the UI.
  • graphTooltip (0, 1 or 2): 0 = independent tooltips, 1 = shared crosshair, 2 = shared crosshair and tooltip.
  • liveNow (boolean, default false): keep streaming data continuously for live sources.
  • fiscalYearStartMonth (0 to 11): month the fiscal year starts; 0 = January. Affects now/fy.
  • weekStart (string): empty string (default), monday, saturday or sunday. Affects now/w.
  • refresh (string or false): auto-refresh interval such as 30s or 5m. Empty string or false disables it. Should be one of timepicker.refresh_intervals.
  • schemaVersion (number): 36 for Grafana 8.5. Older values are migrated on load; never use a higher value.
  • version (number): save counter. 0 for new dashboards. When updating without overwrite, it must equal the stored version.
  • time, timepicker: default time range and picker options (section 4).
  • templating: variables (section 11). annotations: annotation queries (section 12). links: dashboard links (section 12).
  • panels (array): all panels and rows, in layout order (section 6).
  • Leave out style, gnetId, iteration, __inputs and __requires (legacy or export-only).
  4. Time settings
  • time.from and time.to (string): relative expressions such as now, now-6h, now-7d, now-1d/d (round to the day), now/M (round to the month). Units: s m h d w M y. Absolute values are ISO-8601 strings or epoch milliseconds as strings.
  • timepicker.refresh_intervals (string[]): choices in the refresh menu. Default: 5s, 10s, 30s, 1m, 5m, 15m, 30m, 1h, 2h, 1d.
  • timepicker.hidden (boolean): hide the time picker.
  • timepicker.nowDelay (string): shift now back, for example 1m, to avoid incomplete recent data.
  5. Data source references
  A data source is referenced by an object, not a name:
  { "type": "postgres", "uid": "YOUR_DATASOURCE_UID" }
  • type is the plugin id: prometheus, loki, postgres, mysql, mssql, elasticsearch, influxdb, graphite, cloudwatch, testdata.
  • Special references: Mixed { "type": "datasource", "uid": "-- Mixed --" }, reuse another panel's results { "type": "datasource", "uid": "-- Dashboard --" }, built-in annotations { "type": "grafana", "uid": "-- Grafana --" }.
  • A data source variable is referenced as { "type": "postgres", "uid": "\${DS}" }.
  • null means the default data source. Legacy string names are still accepted and migrated, but always emit objects.
  • Set datasource on the panel. A target inherits it; only set target.datasource when the panel uses Mixed.
  6. Panels: common fields and layout
  {
    "id": 1,
    "type": "timeseries",
    "title": "Visitors over time",
    "description": "",
    "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 },
    "datasource": { "type": "postgres", "uid": "YOUR_DATASOURCE_UID" },
    "targets": [
      { "refId": "A", "rawQuery": true, "format": "time_series", "rawSql": "SELECT ..." }
    ],
    "fieldConfig": { "defaults": {}, "overrides": [] },
    "options": {},
    "transformations": []
  }
  • id (number, required): unique within the dashboard.
  • type (string, required): panel plugin id (section 10).
  • title (string): header text. description (string): tooltip shown from the panel's info icon.
  • transparent (boolean, default false): remove the panel background and border.
  • gridPos (object, required): position and size (below).
  • datasource: data source reference (section 5). Not needed for text and row panels.
  • targets (array): queries (section 7).
  • fieldConfig (object): display settings applied to the returned fields (section 8).
  • options (object): panel-type specific settings (section 10).
  • transformations (array): post-query data processing (section 9).
  • links (array): panel links, each { "title", "url", "targetBlank" }.
  • interval (string): minimum query interval override, for example 1m. Sets the floor for $__interval.
  • maxDataPoints (number): cap on points per series requested from the data source.
  • timeFrom (string): override the dashboard range for this panel with a relative range, for example 1h or now-1h.
  • timeShift (string): shift this panel back in time, for example 1d. hideTimeOverride (boolean) hides the override note.
  • repeat (string): name of a multi-value variable; one copy of the panel is rendered per selected value. repeatDirection is h (default) or v. maxPerRow (number) limits copies per row in horizontal repeats.
  • libraryPanel (object): { "uid", "name" } to reuse a library panel. Do not generate unless asked.
  • Leave out pluginVersion, repeatIteration and repeatPanelId (maintained by Grafana).
  Layout (gridPos)
  • The grid is 24 columns wide. x is the column (0 to 23), w the width in columns (1 to 24). y is the row offset (0 or more) and h the height (1 or more). One height unit is about 30 pixels.
  • x + w must not exceed 24. Panels must not overlap; Grafana pushes colliding panels down and compacts empty space upward.
  • Fill each band left to right so widths add up to 24, then start the next band at y equal to the previous band's y + h.
  • Typical sizes: stat 6x4 or 6x8, gauge 6x6, timeseries 12x8 or 24x9, barchart or piechart 12x8, table 24x10, text 24x3.
  • Panel order in the panels array should follow reading order (top to bottom, left to right).
  Rows
  A row is a panel with type row. It groups the panels below it until the next row.
  { "id": 10, "type": "row", "title": "Details", "collapsed": false, "gridPos": { "x": 0, "y": 8, "w": 24, "h": 1 }, "panels": [] }
  • Expanded row (collapsed false): panels is empty and the grouped panels follow the row in the top-level panels array.
  • Collapsed row (collapsed true): the grouped panels are nested inside the row's own panels array instead.
  • repeat on a row repeats the whole row per variable value.
  7. Queries (targets)
  Every target has a refId and fields specific to the data source.
  • refId (string, required): unique per panel.
  • hide (boolean): do not run this query (useful with transformations or expressions).
  • datasource: only for Mixed panels.
  PostgreSQL, MySQL and MSSQL:
  • rawQuery (boolean): always true when writing SQL.
  • rawSql (string): the SQL text. Use spaces or \n for line breaks inside JSON strings.
  • format (string): time_series or table (see section 14).
  Prometheus:
  • expr (string): PromQL. legendFormat (string): for example {{instance}}. interval (string): query step override. instant (boolean): instant query. range (boolean): range query. format: time_series, table or heatmap. exemplar (boolean).
  Loki:
  • expr (string): LogQL. queryType (string): range or instant. legendFormat (string). maxLines (number).
  TestData (for demos with no real database):
  • scenarioId (string): for example random_walk, csv_metric_values, predictable_pulse. Optional fields vary by scenario.
  For any other data source, build one query in the Grafana UI and copy its target shape.
  8. fieldConfig: defaults and overrides
  fieldConfig.defaults applies to every field. fieldConfig.overrides applies settings to selected fields.
  {
    "defaults": {
      "unit": "short",
      "decimals": 0,
      "min": 0,
      "max": 100,
      "noValue": "-",
      "displayName": "Visitors",
      "color": { "mode": "palette-classic" },
      "thresholds": {
        "mode": "absolute",
        "steps": [
          { "color": "green", "value": null },
          { "color": "orange", "value": 70 },
          { "color": "red", "value": 90 }
        ]
      },
      "mappings": [
        { "type": "value", "options": { "0": { "text": "Down", "color": "red", "index": 0 } } },
        { "type": "range", "options": { "from": 1, "to": 9, "result": { "text": "Low", "index": 1 } } },
        { "type": "special", "options": { "match": "null", "result": { "text": "N/A", "index": 2 } } }
      ],
      "links": [],
      "custom": {}
    },
    "overrides": [
      {
        "matcher": { "id": "byName", "options": "visitors" },
        "properties": [
          { "id": "unit", "value": "short" },
          { "id": "custom.lineWidth", "value": 3 },
          { "id": "color", "value": { "mode": "fixed", "fixedColor": "blue" } }
        ]
      }
    ]
  }
  • unit (string): display unit. Common ids: none, short, percent (0 to 100), percentunit (0 to 1), bytes, decbytes, bits, ns, ms, s, m, h, d, reqps, ops, Bps, currencyUSD, currencyGBP, currencyEUR, dateTimeAsIso, dateTimeFromNow, celsius.
  • decimals (number): decimal places. Omit for automatic.
  • min, max (number): scale bounds. Required for meaningful gauge and bargauge panels.
  • noValue (string): text shown when there is no data.
  • displayName (string): rename the field or series. Supports \${__field.name} and \${__series.name}.
  • color.mode (string): fixed (uses fixedColor), thresholds, palette-classic (one colour per series), or a continuous scale such as continuous-GrYlRd, continuous-RdYlGr, continuous-BlYlRd, continuous-YlRd, continuous-BlPu, continuous-YlBl.
  • Colours are names (green, red, yellow, orange, blue, purple, dark-green, semi-dark-blue, light-red, text) or hex or rgba strings.
  • thresholds.mode: absolute or percentage. steps is ordered ascending; the first step must have value: null (the base colour).
  • mappings (array): rewrite values. Types: value (exact match, keyed by value), range (from, to), regex (pattern), special (match: null, nan, null+nan, true, false, empty). Each result may set text, color and index (display order).
  • links (array): data links, each { "title": "Details", "url": "/d/abc123?var-dept=\${__value.raw}", "targetBlank": true }.
  • custom (object): settings specific to the panel type (section 10).
  Overrides:
  • matcher.id is one of byName (options: field name), byRegexp (options: regex string), byType (options: number, string, time or boolean), byFrameRefID (options: a query refId).
  • properties is a list of { "id", "value" }. The id is any defaults key (unit, decimals, min, max, color, thresholds, mappings, displayName, links, noValue) or custom.<property> for panel-specific settings.
  9. Transformations
  transformations is an ordered list of { "id": <name>, "options": { } }. They run after the queries, before display.
  • organize: { "excludeByName": { "col": true }, "indexByName": { "a": 0, "b": 1 }, "renameByName": { "old": "New name" } }
  • filterFieldsByName: { "include": { "names": ["time", "visitors"] } }
  • sortBy: { "sort": [ { "field": "visitors", "desc": true } ] }
  • limit: { "limitField": 10 }
  • groupBy: { "fields": { "department": { "operation": "groupby", "aggregations": [] }, "visitors": { "operation": "aggregate", "aggregations": ["sum"] } } }
  • reduce: { "reducers": ["min", "max", "mean", "last"] } turns each series into one row of statistics.
  • calculateField: { "mode": "binary", "binary": { "left": "a", "operator": "/", "right": "b" }, "alias": "ratio", "replaceFields": false }. Also "mode": "reduceRow" with "reduce": { "reducer": "sum" }.
  • Other ids: merge, seriesToColumns ({ "byField": "time" }), joinByField, concatenate, labelsToFields, convertFieldType, renameByRegex.
  Prefer doing aggregation in SQL or PromQL; use transformations for reshaping and renaming.
  10. Panel types and their options
  Calculation ids used by reduceOptions.calcs: lastNotNull (default), last, firstNotNull, first, min, max, mean, sum, count, range, delta, diff, step.
  stat
  One big number, optionally with a sparkline.
  "options": {
    "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false },
    "orientation": "auto",
    "textMode": "auto",
    "colorMode": "value",
    "graphMode": "area",
    "justifyMode": "auto"
  }
  • reduceOptions.calcs: how each series is reduced to one value. values: true shows every row as its own value instead of reducing. fields is a regex such as /^visitors$/ to pick which fields to show; empty means all numeric fields.
  • orientation: auto, horizontal, vertical.
  • textMode: auto, value, value_and_name, name, none.
  • colorMode: value, background, none. graphMode: area or none. justifyMode: auto or center.
  • Colour comes from fieldConfig.defaults.thresholds and color.
  gauge
  A dial between min and max.
  • options: reduceOptions (as in stat), orientation, showThresholdLabels (boolean), showThresholdMarkers (boolean).
  • Always set fieldConfig.defaults.min and max, and thresholds.
  bargauge
  Horizontal or vertical bars, good for ranking categories.
  • options: reduceOptions, orientation (horizontal or vertical), displayMode (gradient, basic or lcd), showUnfilled (boolean).
  • For one bar per SQL row use reduceOptions.values: true. Set min and max.
  timeseries
  Lines, bars or points over time. Requires a time field.
  "options": {
    "legend": { "displayMode": "list", "placement": "bottom", "calcs": [] },
    "tooltip": { "mode": "single" }
  },
  "fieldConfig": {
    "defaults": {
      "custom": {
        "drawStyle": "line",
        "lineInterpolation": "linear",
        "lineWidth": 1,
        "fillOpacity": 10,
        "gradientMode": "none",
        "showPoints": "auto",
        "pointSize": 5,
        "spanNulls": false,
        "stacking": { "mode": "none", "group": "A" },
        "axisPlacement": "auto",
        "axisLabel": "",
        "scaleDistribution": { "type": "linear" },
        "thresholdsStyle": { "mode": "off" }
      }
    },
    "overrides": []
  }
  • options.legend.displayMode: list, table or hidden. placement: bottom or right. calcs: statistics shown in the legend, for example ["mean", "max", "lastNotNull"].
  • options.tooltip.mode: single, multi or none.
  • custom.drawStyle: line, bars, points. lineInterpolation: linear, smooth, stepBefore, stepAfter. lineWidth: 0 to 10. fillOpacity: 0 to 100. gradientMode: none, opacity, hue, scheme.
  • custom.showPoints: auto, always, never. pointSize: pixels. spanNulls: true, false or a millisecond threshold for connecting gaps.
  • custom.stacking.mode: none, normal, percent.
  • custom.axisPlacement: auto, left, right, hidden. axisLabel: axis title. axisSoftMin and axisSoftMax: soft scale bounds.
  • custom.scaleDistribution.type: linear, log (add "log": 10), symlog.
  • custom.thresholdsStyle.mode: off, line, area, line+area, dashed, dashed+area.
  barchart
  Bars for categories (a string field plus numeric fields) or for time buckets.
  "options": {
    "orientation": "auto",
    "xField": "department",
    "showValue": "auto",
    "stacking": "none",
    "groupWidth": 0.7,
    "barWidth": 0.97,
    "xTickLabelRotation": 0,
    "legend": { "displayMode": "list", "placement": "bottom", "calcs": [] },
    "tooltip": { "mode": "single" }
  },
  "fieldConfig": { "defaults": { "custom": { "lineWidth": 1, "fillOpacity": 80, "gradientMode": "none" } }, "overrides": [] }
  • xField: the string or time field used for the x axis. Defaults to the first suitable field.
  • orientation: auto, horizontal, vertical. showValue: auto, always, never. stacking: none, normal, percent.
  • groupWidth and barWidth: 0 to 1.
  piechart
  Share of a whole. Use at most about 6 slices.
  "options": {
    "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": true },
    "pieType": "pie",
    "displayLabels": ["percent"],
    "legend": { "displayMode": "list", "placement": "right", "values": ["percent"] },
    "tooltip": { "mode": "single" }
  }
  • For SQL results of one text column (slice name) plus one numeric column (slice size), set reduceOptions.values to true.
  • pieType: pie or donut. displayLabels: any of name, value, percent. legend.values: any of value, percent.
  histogram
  Buckets raw numeric values itself. Query the raw values, not pre-bucketed counts.
  • options: bucketSize (number, optional; automatic if omitted), bucketOffset (number, default 0), combine (boolean, merge all series into one), legend, tooltip (as in timeseries).
  • fieldConfig.defaults.custom: fillOpacity (0 to 100), lineWidth, gradientMode.
  table
  "options": {
    "showHeader": true,
    "footer": { "show": false, "reducer": ["sum"], "fields": "" },
    "sortBy": [ { "displayName": "visitors", "desc": true } ]
  },
  "fieldConfig": { "defaults": { "custom": { "align": "auto", "displayMode": "auto", "filterable": false } }, "overrides": [] }
  • options.showHeader (boolean). options.footer.show (boolean) with reducer (list of calculation ids) and fields (regex, empty for all numeric). options.sortBy: list of { "displayName", "desc" }. options.frameIndex: which result frame to show when there are several.
  • custom.align: auto, left, center, right. custom.displayMode: auto, color-text, color-background, color-background-solid, gradient-gauge, lcd-gauge, basic, json-view. custom.width and custom.minWidth: pixels. custom.filterable (boolean): per-column filter.
  • Use overrides with byName to set unit, width or displayMode per column.
  text
  Static notes. Needs no data source or targets.
  "options": { "mode": "markdown", "content": "# Title\nSome **markdown** text." }
  • mode: markdown, html or code. content: the text. Variables such as $department are interpolated.
  logs
  Log lines from Loki, Elasticsearch and similar.
  • options: showTime, showLabels, showCommonLabels, wrapLogMessage, prettifyLogMessage, enableLogDetails (booleans), dedupStrategy (none, exact, numbers, signature), sortOrder (Descending or Ascending).
  Other types
  state-timeline, status-history, geomap, nodeGraph, traces, news, dashlist, alertlist, annolist also exist. Generate them only when explicitly requested, and copy their option shape from a panel built in the Grafana UI.
  11. Template variables
  templating.list is an array of variable objects. Reference a variable in queries, titles and text as $name or \${name}. Format options: \${name:csv}, \${name:pipe}, \${name:json}, \${name:text}, \${name:queryparam}.
  Common fields:
  • name (string, required): identifier used as $name. Letters, digits and underscores only.
  • label (string): text shown in the dropdown label.
  • description (string).
  • type (string, required): query, custom, textbox, constant, datasource, interval, adhoc.
  • hide (0, 1 or 2): 0 = show label and dropdown, 1 = hide the label, 2 = hide the variable entirely.
  • skipUrlSync (boolean): keep the variable out of the URL.
  • current (object): selected value, { "selected": true, "text": "Medical", "value": "Medical" }. For multi-select, text and value are arrays. For All, use { "selected": true, "text": "All", "value": "$__all" }.
  • options (array): choices, each { "selected": false, "text": "Medical", "value": "Medical" }. Required for custom, textbox, interval; empty ([]) for query variables (Grafana fills it).
  • multi (boolean): allow several values. includeAll (boolean): add an All option. allValue (string or null): custom value for All; null expands to every option.
  Query variable:
  {
    "name": "department",
    "label": "Department",
    "type": "query",
    "datasource": { "type": "postgres", "uid": "YOUR_DATASOURCE_UID" },
    "query": "SELECT DISTINCT department FROM visits ORDER BY 1",
    "definition": "SELECT DISTINCT department FROM visits ORDER BY 1",
    "refresh": 1,
    "sort": 1,
    "regex": "",
    "multi": true,
    "includeAll": true,
    "allValue": null,
    "hide": 0,
    "skipUrlSync": false,
    "current": { "selected": true, "text": "All", "value": "$__all" },
    "options": []
  }
  • query (string): the query returning the values. definition (string): copy of query for the editor.
  • refresh (0, 1 or 2): 0 = never re-run, 1 = on dashboard load, 2 = on time range change.
  • sort (0 to 6): 0 = none, 1 = alphabetical asc, 2 = alphabetical desc, 3 = numerical asc, 4 = numerical desc, 5 = case-insensitive asc, 6 = case-insensitive desc.
  • regex (string): filter or extract parts of the returned values.
  Other types:
  • custom: "query": "Medical,Surgical,Emergency,Other" (comma-separated) plus matching options.
  • textbox: "query": "default text", with current and a single selected entry in options.
  • constant: "query": "fixed value", "hide": 2.
  • datasource: "query": "postgres" (plugin id of the data sources to list), optional regex to filter by name.
  • interval: "query": "1m,10m,30m,1h,6h,1d", "auto": false, "auto_count": 30, "auto_min": "10s".
  • adhoc: "datasource": { ... }, "filters": []. Only for data sources that support ad hoc filters.
  Built-in variables available in queries without declaring them: $__from and $__to (epoch ms), $__interval and $__interval_ms, $__dashboard, $__timeFilter(column) (SQL).
  In SQL, a multi-value variable expands to a quoted list, so write WHERE department IN ($department).
  12. Annotations and links
  annotations.list always starts with the built-in entry:
  {
    "builtIn": 1,
    "name": "Annotations & Alerts",
    "datasource": { "type": "grafana", "uid": "-- Grafana --" },
    "enable": true,
    "hide": true,
    "iconColor": "rgba(0, 211, 255, 1)",
    "type": "dashboard"
  }
  Query annotations draw events on time-based panels:
  • Common fields: name, datasource, enable (boolean), hide (boolean, hides the toggle), iconColor.
  • SQL data sources: rawQuery is SQL returning columns time, optional timeend, text, tags, and filtered with $__timeFilter(time).
  • Prometheus: expr (PromQL), titleFormat, textFormat, tagKeys, step.
  Dashboard links (links at the top level):
  { "title": "Related", "type": "dashboards", "tags": ["generated"], "asDropdown": true, "includeVars": true, "keepTime": true, "targetBlank": false }
  • type: dashboards (list dashboards by tags) or link (a single url).
  • title, url, tooltip, icon (external link, dashboard, question, info, bolt, doc, cloud), asDropdown, includeVars, keepTime, targetBlank.
  13. Choosing a panel for the data
  • One number: stat. One number with a known range (percent, capacity): gauge.
  • Value over time: timeseries.
  • Category plus number, comparing values: barchart or bargauge. Share of a whole with 6 or fewer categories: piechart.
  • Distribution of raw numeric values: histogram.
  • Detailed rows and columns: table.
  • Notes and explanations: text.
  • Log lines: logs. State changes over time: state-timeline.
  14. SQL query rules (PostgreSQL, MySQL, MSSQL)
  • Set rawQuery: true and write the query in rawSql.
  • format: time_series: the first column must be named time (timestamp or epoch seconds). Every other numeric column becomes a series. An optional text column named metric splits the result into series by its values. Always ORDER BY time.
  • format: table: any columns, used for table, stat, barchart, piechart, histogram and bargauge.
  • timeseries panels must use time_series. All other panels should use table.
  • Grafana macros (PostgreSQL): $__timeFilter(col) expands to a range condition on the dashboard time range; $__timeGroupAlias(col, '1h') buckets and aliases the column as time; $__timeFrom() and $__timeTo() give the range bounds; $__unixEpochFilter(col) for epoch columns.
  • Example over a real table: SELECT $__timeGroupAlias(visited_at, '1h'), COUNT(*) AS visitors FROM visits WHERE $__timeFilter(visited_at) GROUP BY 1 ORDER BY 1.
  • Alias columns with readable names; they become legend, header and tooltip labels.
  • Do not guess column names. Use only the schema the user provides.
  15. Complete example
  {
    "dashboard": {
      "id": null,
      "uid": "visitor-dashboard",
      "title": "Visitor Dashboard",
      "tags": ["generated"],
      "timezone": "browser",
      "editable": true,
      "graphTooltip": 0,
      "refresh": "",
      "schemaVersion": 36,
      "version": 0,
      "time": { "from": "now-24h", "to": "now" },
      "timepicker": {},
      "annotations": { "list": [] },
      "links": [],
      "templating": {
        "list": [
          {
            "name": "department",
            "label": "Department",
            "type": "custom",
            "query": "Medical,Surgical,Emergency,Other",
            "multi": true,
            "includeAll": true,
            "allValue": null,
            "hide": 0,
            "skipUrlSync": false,
            "current": { "selected": true, "text": "All", "value": "$__all" },
            "options": [
              { "selected": true, "text": "All", "value": "$__all" },
              { "selected": false, "text": "Medical", "value": "Medical" },
              { "selected": false, "text": "Surgical", "value": "Surgical" },
              { "selected": false, "text": "Emergency", "value": "Emergency" },
              { "selected": false, "text": "Other", "value": "Other" }
            ]
          }
        ]
      },
      "panels": [
        {
          "id": 1,
          "type": "stat",
          "title": "Total Visitors",
          "gridPos": { "x": 0, "y": 0, "w": 6, "h": 8 },
          "datasource": { "type": "postgres", "uid": "YOUR_DATASOURCE_UID" },
          "targets": [
            { "refId": "A", "rawQuery": true, "format": "table", "rawSql": "SELECT COUNT(*) AS total_visitors FROM generate_series(1, 550) AS n" }
          ],
          "fieldConfig": { "defaults": { "unit": "short", "color": { "mode": "thresholds" }, "thresholds": { "mode": "absolute", "steps": [ { "color": "blue", "value": null } ] } }, "overrides": [] },
          "options": { "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false }, "orientation": "auto", "textMode": "auto", "colorMode": "value", "graphMode": "none", "justifyMode": "auto" }
        },
        {
          "id": 2,
          "type": "timeseries",
          "title": "Visitors Over Time",
          "gridPos": { "x": 6, "y": 0, "w": 18, "h": 8 },
          "datasource": { "type": "postgres", "uid": "YOUR_DATASOURCE_UID" },
          "targets": [
            { "refId": "A", "rawQuery": true, "format": "time_series", "rawSql": "SELECT NOW() - (11 - n) * INTERVAL '1 hour' AS time, (80 + n * 7 + (n % 3) * 12) AS visitors FROM generate_series(0, 11) AS n ORDER BY time" }
          ],
          "fieldConfig": { "defaults": { "unit": "short", "custom": { "drawStyle": "line", "lineInterpolation": "smooth", "lineWidth": 2, "fillOpacity": 15, "showPoints": "auto" } }, "overrides": [] },
          "options": { "legend": { "displayMode": "list", "placement": "bottom", "calcs": [] }, "tooltip": { "mode": "single" } }
        },
        {
          "id": 3,
          "type": "barchart",
          "title": "Visitors by Department",
          "gridPos": { "x": 0, "y": 8, "w": 12, "h": 8 },
          "datasource": { "type": "postgres", "uid": "YOUR_DATASOURCE_UID" },
          "targets": [
            { "refId": "A", "rawQuery": true, "format": "table", "rawSql": "SELECT department, visitors FROM (VALUES ('Medical', 150), ('Surgical', 100), ('Emergency', 220), ('Other', 80)) AS data(department, visitors) WHERE department IN ($department) ORDER BY visitors DESC" }
          ],
          "fieldConfig": { "defaults": { "custom": { "lineWidth": 1, "fillOpacity": 80, "gradientMode": "none" } }, "overrides": [] },
          "options": { "orientation": "auto", "xField": "department", "showValue": "auto", "stacking": "none", "groupWidth": 0.7, "barWidth": 0.97, "legend": { "displayMode": "list", "placement": "bottom", "calcs": [] }, "tooltip": { "mode": "single" } }
        },
        {
          "id": 4,
          "type": "piechart",
          "title": "Department Distribution",
          "gridPos": { "x": 12, "y": 8, "w": 12, "h": 8 },
          "datasource": { "type": "postgres", "uid": "YOUR_DATASOURCE_UID" },
          "targets": [
            { "refId": "A", "rawQuery": true, "format": "table", "rawSql": "SELECT department, visitors FROM (VALUES ('Medical', 150), ('Surgical', 100), ('Emergency', 220), ('Other', 80)) AS data(department, visitors) WHERE department IN ($department)" }
          ],
          "fieldConfig": { "defaults": { "color": { "mode": "palette-classic" } }, "overrides": [] },
          "options": { "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": true }, "pieType": "pie", "displayLabels": ["percent"], "legend": { "displayMode": "list", "placement": "right", "values": ["percent"] }, "tooltip": { "mode": "single" } }
        },
        {
          "id": 5,
          "type": "table",
          "title": "Department Detail",
          "gridPos": { "x": 0, "y": 16, "w": 24, "h": 8 },
          "datasource": { "type": "postgres", "uid": "YOUR_DATASOURCE_UID" },
          "targets": [
            { "refId": "A", "rawQuery": true, "format": "table", "rawSql": "SELECT department, visitors, ROUND(visitors * 100.0 / SUM(visitors) OVER (), 1) AS share_pct FROM (VALUES ('Medical', 150), ('Surgical', 100), ('Emergency', 220), ('Other', 80)) AS data(department, visitors) WHERE department IN ($department) ORDER BY visitors DESC" }
          ],
          "fieldConfig": {
            "defaults": { "custom": { "align": "auto", "displayMode": "auto", "filterable": false } },
            "overrides": [ { "matcher": { "id": "byName", "options": "share_pct" }, "properties": [ { "id": "unit", "value": "percent" }, { "id": "custom.displayMode", "value": "color-text" } ] } ]
          },
          "options": { "showHeader": true, "footer": { "show": true, "reducer": ["sum"], "fields": "" }, "sortBy": [ { "displayName": "visitors", "desc": true } ] }
        }
      ]
    }
  }
  16. Saving through the HTTP API
  The plugin sends the dashboard to Grafana with POST /api/dashboards/db:
  {
    "dashboard": { },
    "folderId": 0,
    "overwrite": true,
    "message": "Created by plugin"
  }
  • dashboard: the dashboard object from this document (without the plugin's own wrapper).
  • folderId (number): 0 is the General folder. folderUid (string) may be used instead.
  • overwrite (boolean): true replaces an existing dashboard with the same uid or title; false fails with an error if it exists.
  • message (string): version-history note.
  • Success returns id, uid, url, slug, version and status. Common failures: 400 invalid body or title clash, 403 permission denied (needs Editor role), 412 version mismatch.
  17. Final checklist for the model
  • Output is one JSON object, parseable with no edits.
  • id is null, schemaVersion is 35, version is 0, and uid and title are set.
  • Panel id values are unique; each refId is unique within its panel.
  • Every gridPos fits inside 24 columns with no overlaps.
  • Every non-text panel has a datasource object with the supplied type and uid.
  • Time series SQL returns a time column and uses format: time_series; everything else uses format: table.
  • gauge and bargauge panels have min, max and thresholds.
  • Variables used in queries ($name) exist in templating.list.
  • No invented tables, columns, panel types or option names.
  END OF SPEC

  Only generate one panel unless the user explicitly requests more.
  Only responsed in the specified JSON format.
  Do not say anything else even if the request is impossible just return an empty dashboard. 
  The strings in your json response must not be multi-line.
  {user_prompt_here}
`;

export const GenerateDashboard = async (
  setSource: (source: string) => void,
  userPrompt: string
) => {
  await loadSettings();

  let output = '';

  const schema = await getSchemaText();
  
  //const DATA_SOURCE_UID = await getDataSourceUID();

  // Function replacers so "$" sequences in the schema or prompt are inserted literally.
  const LLM_Input = TempPromt
    .replace('{datasource_info}', () => schema)
    .replace('{user_prompt_here}', userPrompt)
    .replace('{ds_type}', await getDataSourceType())
    .replace('{ds_uid}',"\$\{DS_POSTGRESQL\}");
  console.log(LLM_Input);
  switch (settings['SelectedAI']) {
    case 'openai':
      output =
        (await AskOpenAI(LLM_Input)) ??
        'Failed to get response from OpenAI';
      break;

    default:
      throw new Error(
        'Only OpenAI generation is currently implemented. Select OpenAI in Settings.'
      );
  }
  const savedDashboard = await saveDashboardFromJson(output);
  setSource(output);
  return savedDashboard.url as string;
};
