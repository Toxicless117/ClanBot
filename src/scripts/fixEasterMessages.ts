import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

function tolerantParse(raw: string): string[] {
  if (!raw) return [];

  let s = raw.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();

  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch (e) {}

  if (/^\s*\[.*\]\s*$/.test(s)) {
    let tmp = s.replace(/'/g, '"');
    try {
      const parsed2 = JSON.parse(tmp);
      if (Array.isArray(parsed2)) return parsed2.map(String);
    } catch (e) {}
  }

  // Heurística mejorada: reconstruir frases uniendo por comas hasta fin de oración (., !, ? o *)
  // Esto evita cortar frases como "Lo sentimos, esta fortuna ..." en dos elementos
  const parts = s.split(',');
  const sentences: string[] = [];
  let acc = '';
  const endRegex = /[.!?](\*|["'\)\]]*)\s*$/; // termina en . ! ? o * con posibles comillas/cierre

  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i].trim();
    if (!acc) acc = seg;
    else acc += ', ' + seg;

    if (endRegex.test(seg) || i === parts.length - 1) {
      const t = acc.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      if (t) sentences.push(t);
      acc = '';
    }
  }

  return sentences;
}

async function run() {
  const conn = await mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    connectionLimit: 5,
  });

  const [rows] = await conn.query<any[]>('SELECT Codigo_Easteregg, Lista_Respuestas FROM Eastereggs');
  console.log('Registros a revisar:', rows.length);

  let updated = 0;
  for (const r of rows) {
    const codigo = r.Codigo_Easteregg;
    const raw = r.Lista_Respuestas ?? '';
    const arr = tolerantParse(String(raw));
    if (arr.length === 0) {
      console.log(`[${codigo}] -> parsed 0 items, skipping`);
      continue;
    }
    const jsonStr = JSON.stringify(arr);
    await conn.query('UPDATE Eastereggs SET Lista_Respuestas = ? WHERE Codigo_Easteregg = ?', [jsonStr, codigo]);
    console.log(`[${codigo}] -> updated (${arr.length} items)`);
    updated++;
  }

  // Verificación específica para .fortune
  try {
    const [vr] = await conn.query<any[]>(
      'SELECT Lista_Respuestas FROM Eastereggs WHERE Codigo_Easteregg = ? LIMIT 1',
      ['.fortune']
    );
    if (Array.isArray(vr) && vr.length > 0) {
      const val = vr[0].Lista_Respuestas;
      let arr: string[] = [];
      if (Array.isArray(val)) arr = val.map(String);
      else {
        try { arr = JSON.parse(String(val)); } catch {}
      }
      console.log(`[CHECK] .fortune -> ${Array.isArray(arr) ? arr.length : 0} mensajes`);
    } else {
      console.log('[CHECK] .fortune no existe en tabla Eastereggs');
    }
  } catch (e) {
    console.warn('[CHECK] No se pudo verificar .fortune:', e);
  }

  await conn.end();
  console.log(`Proceso terminado. Registros actualizados: ${updated}.`);
}

run().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});