import { currentSettings as settings } from './Settings';
import { loadSettings } from './usersetting';
import axios from 'axios';
import { getDataSourceSrv } from '@grafana/runtime';
import { dateTime } from '@grafana/data';

const SQL = `
  SELECT n.nspname AS table_schema,
         c.relname AS table_name,
         a.attname AS column_name,
         format_type(a.atttypid, a.atttypmod) AS data_type,
         CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE a.attnum > 0
    AND NOT a.attisdropped
    AND c.relkind IN ('r', 'v', 'm', 'p')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND n.nspname NOT LIKE 'pg_toast%'
  ORDER BY n.nspname, c.relname, a.attnum`;
export async function getSchemaText(): Promise<string> {
  const ds: any = await getDataSourceSrv().get();

  const res = await ds
    .query({
      requestId: `schema-${Date.now()}`,
      interval: '1s',
      intervalMs: 1000,
      maxDataPoints: 500,
      scopedVars: {},
      range: { from: dateTime().subtract(1, 'h'), to: dateTime(), raw: { from: 'now-1h', to: 'now' } },
      targets: [{ refId: 'A', rawSql: SQL, format: 'table', rawQuery: true }],
    })
    .toPromise();

  const frame = res.data[0];
  const col = (name: string): any[] => frame.fields.find((f: any) => f.name === name).values.toArray();

  const [schemas, tables, columns, types, nullable] = ['table_schema', 'table_name', 'column_name', 'data_type', 'is_nullable'].map(col);

  const lines: string[] = [];
  let current = '';
  tables.forEach((t, i) => {
    const full = `${schemas[i]}.${t}`;
    if (full !== current) {
      lines.push(`${current ? '\n' : ''}Table: ${full}`);
      current = full;
    }
    lines.push(`  - ${columns[i]}: ${types[i]}${nullable[i] === 'NO' ? ' NOT NULL' : ''}`);
  });
  return lines.join('\n');
}

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
  Here is the data source information:
  {datasource_info}
  Here is an example of the format:
  {
  "dashboard": {
    "title": "Visitor Dashboard",
    "panels": [
      {
        "id": 1,
        "title": "Visitors Over Time",
        "type": "timeseries",
        "targets": [
          {
            "refId": "A",
            "format": "time_series",
            "rawSql": "\n            SELECT\n              NOW() - (11 - n) * INTERVAL '1 hour'\n                AS time,\n\n              (80 + n * 7 + (n % 3) * 12)\n                AS visitors\n\n            FROM generate_series(0, 11) AS n\n\n            ORDER BY time\n          "
          }
        ]
      },
      {
        "id": 2,
        "title": "Visitors by Department",
        "type": "barchart",
        "targets": [
          {
            "refId": "A",
            "format": "table",
            "rawSql": "\n            SELECT department, visitors\n\n            FROM (\n              VALUES\n                ('Medical', 150),\n                ('Surgical', 100),\n                ('Emergency', 220),\n                ('Other', 80)\n            ) AS data(department, visitors)\n          "
          }
        ]
      },
      {
        "id": 3,
        "title": "Department Distribution",
        "type": "piechart",
        "targets": [
          {
            "refId": "A",
            "format": "table",
            "rawSql": "\n            SELECT department, visitors\n\n            FROM (\n              VALUES\n                ('Medical', 150),\n                ('Surgical', 100),\n                ('Emergency', 220),\n                ('Other', 80)\n            ) AS data(department, visitors)\n          "
          }
        ]
      },
      {
        "id": 4,
        "title": "Waiting Time Distribution",
        "type": "histogram",
        "targets": [
          {
            "refId": "A",
            "format": "table",
            "rawSql": "\n            SELECT\n              ((n * 7) % 45 + (n % 5))\n                AS waiting_time_minutes\n\n            FROM generate_series(1, 100) AS n\n          "
          }
        ]
      },
      {
        "id": 5,
        "title": "Total Visitors",
        "type": "stat",
        "targets": [
          {
            "refId": "A",
            "format": "table",
            "rawSql": "\n            SELECT\n              COUNT(*) AS total_visitors\n\n            FROM generate_series(1, 550) AS n\n          "
          }
        ]
      }
    ]
  }
}
  Only generate one panel unless the user explicitly requests more.
  Only responsed in the specified JSON format.
  Do not say anything else even if the request is impossible just return an empty dashboard. 
  The strings in your json response must not be multi-line.
  {user_promt_here}
`;

export const GenerateDashboard = async (
  setSource: (source: string) => void,
  userPrompt: string
) => {
  await loadSettings();

  let output = '';

  const schema = await getSchemaText();

  // Function replacers so "$" sequences in the schema or prompt are inserted literally.
  const LLM_Input = TempPromt
    .replace('{datasource_info}', () => schema)
    .replace('{user_promt_here}', () => userPrompt);

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

  setSource(output);
};
