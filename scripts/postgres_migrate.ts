import { migrationSql, withAdminClient } from './postgres_state_common.js';

const result = await withAdminClient(async (client) => {
  await client.query(migrationSql());
  const tables = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'metaedge'
    order by table_name
  `);
  return tables.rows.map((row) => row.table_name);
});

console.log(JSON.stringify({ schema: 'metaedge', tables: result, migrated: true }, null, 2));
