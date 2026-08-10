const { Client } = require('pg');

const connStrings = [
  'postgresql://postgres:Econoservice1982*@db.zkoacqpewrsepboswacp.supabase.co:5432/postgres',
  'postgresql://postgres:[Econoservice1982*]@db.zkoacqpewrsepboswacp.supabase.co:5432/postgres'
];

async function run() {
  let connected = false;
  let client;

  for (const connStr of connStrings) {
    console.log(`Intentando conectar con URI: ${connStr.replace(/:([^@]+)@/, ':****@')}`);
    client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log('¡Conexión establecida con éxito!');
      connected = true;
      break;
    } catch (err) {
      console.warn(`Error al conectar con este password: ${err.message}`);
    }
  }

  if (!connected) {
    console.error('No se pudo establecer conexión con ninguna de las contraseñas.');
    process.exit(1);
  }

  const queries = [
    'ALTER TABLE clientes ADD COLUMN IF NOT EXISTS torre text;',
    'ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE equipos DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE servicios DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE historial DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE stock DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE gastos DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE proveedores DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE config DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE presupuestos DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE presupuesto_items DISABLE ROW LEVEL SECURITY;'
  ];

  for (const q of queries) {
    try {
      console.log(`Ejecutando: ${q}`);
      await client.query(q);
      console.log('  -> Completado con éxito.');
    } catch (err) {
      console.error(`  -> Error al ejecutar: ${err.message}`);
    }
  }

  await client.end();
  console.log('\n✅ ¡Migración de base de datos finalizada con éxito!');
}

run();
