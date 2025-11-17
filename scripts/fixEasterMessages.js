"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function tolerantParse(raw) {
    if (!raw)
        return [];
    // Normalizar saltos de línea, tabs, trim
    let s = raw.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();
    // 1) Intento JSON directo
    try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed))
            return parsed.map(String);
    }
    catch (e) {
        // ignore
    }
    // 2) Si la cadena parece tener corchetes pero JSON falló, limpiarlo un poco
    if (/^\s*\[.*\]\s*$/.test(s)) {
        // quitar comillas simples y convertir a comillas dobles
        let tmp = s.replace(/'/g, '"');
        try {
            const parsed2 = JSON.parse(tmp);
            if (Array.isArray(parsed2))
                return parsed2.map(String);
        }
        catch (e) { }
    }
    // 3) Heurística: split por comas pero respetando comillas dobles y simples
    const out = [];
    let cur = '';
    let inDouble = false;
    let inSingle = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '"' && !inSingle) {
            inDouble = !inDouble;
            cur += ch; // conserva comillas para posible limpieza
            continue;
        }
        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
            cur += ch;
            continue;
        }
        if (ch === ',' && !inDouble && !inSingle) {
            out.push(cur.trim());
            cur = '';
            continue;
        }
        cur += ch;
    }
    if (cur.trim() !== '')
        out.push(cur.trim());
    // 4) Limpieza final: quitar comillas envolventes y asteriscos sobrantes, también arreglar salts de línea
    const cleaned = out.map(item => {
        let t = item.trim();
        // quitar comillas envolventes
        if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
            t = t.slice(1, -1);
        }
        // reemplazar secuencias de salto por espacio y limpiar espacios dobles
        t = t.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        return t;
    }).filter(Boolean);
    return cleaned;
}
async function run() {
    const conn = await promise_1.default.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        connectionLimit: 5,
    });
    const [rows] = await conn.query('SELECT Codigo_Easteregg, Lista_Respuestas FROM Eastereggs');
    console.log('Registros a revisar:', rows.length);
    for (const r of rows) {
        const codigo = r.Codigo_Easteregg;
        const raw = r.Lista_Respuestas ?? '';
        const arr = tolerantParse(String(raw));
        // Si ya es JSON válido y tiene 1+ items, actualizamos
        if (arr.length === 0) {
            console.log(`[${codigo}] -> parsed 0 items, skipping`);
            continue;
        }
        const jsonStr = JSON.stringify(arr);
        await conn.query('UPDATE Eastereggs SET Lista_Respuestas = ? WHERE Codigo_Easteregg = ?', [jsonStr, codigo]);
        console.log(`[${codigo}] -> updated (${arr.length} items)`);
    }
    await conn.end();
    console.log('Proceso terminado');
}
run().catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
});
//# sourceMappingURL=fixEasterMessages.js.map