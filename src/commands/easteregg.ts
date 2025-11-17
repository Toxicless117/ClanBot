import { Client, Message, TextChannel, Collection, MessageCollector, ReadonlyCollection, EmbedBuilder } from "discord.js";
import mysqlPool from "../database/mysqlConnection";
import { RowDataPacket } from "mysql2";

// (Limpieza) Eliminada constante de ejemplo no usada; se usa DB

function parseMessagesField(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  const s = String(raw).trim();
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch (e) {
    // ignore
  }

  // Heurística rápida: si no hay corchetes y hay comas, reconstruir frases por fin de oración
  if (!s.includes('[') && s.includes(',')) {
    const parts = s.split(',');
    const out: string[] = [];
    let acc = '';
    const endRegex = /[.!?](\*|["'\)\]]*)\s*$/;
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i].trim();
      if (!acc) acc = seg; else acc += ', ' + seg;
      if (endRegex.test(seg) || i === parts.length - 1) {
        const t = acc.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        if (t) out.push(t);
        acc = '';
      }
    }
    if (out.length) return out;
  }

  // si contiene comillas dobles delimitando elementos, intentar extraer strings con regex
  const quoted = s.match(/(["'])(?:(?=(\\?))\2.)*?\1/g);
  if (quoted && quoted.length > 0) {
    return quoted.map(q => q.slice(1, -1).replace(/\n+/g, ' ').trim());
  }

  // fallback: split por comas pero respetando comillas
  const out: string[] = [];
  let cur = '';
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && !inSingle) { inDouble = !inDouble; cur += ch; continue; }
    if (ch === "'" && !inDouble) { inSingle = !inSingle; cur += ch; continue; }
    if (ch === ',' && !inDouble && !inSingle) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map(it => {
    let t = it;
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) t = t.slice(1, -1);
    return t.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
}

module.exports = {
  name: "easteregg",
  description: "Inicia el proceso para descubrir un Easter Egg oculto.",
  async execute(client: Client, message: Message): Promise<void> {
    const connection = await mysqlPool.getConnection();

    try {
      // Verificar si el canal es de texto
      if (!(message.channel instanceof TextChannel)) {
        await message.reply("Este comando solo puede usarse en canales de texto.");
        return;
      }

      // Eliminar el mensaje inicial del comando
      await message.delete();

      // Crear un collector para esperar el código secreto
      const filter = (msg: Message) => msg.author.id === message.author.id;
      const collector: MessageCollector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

      collector.on("collect", async (msg: Message) => {
        await msg.delete(); // Eliminar el mensaje del código ingresado

        const code = msg.content.toLowerCase();

        // Verificar si el código existe en la base de datos
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT Lista_Respuestas FROM Eastereggs WHERE Codigo_Easteregg = ?`,
          [code]
        );

        if (rows.length > 0) {
          const rawResponses = rows[0].Lista_Respuestas;
          const responses = parseMessagesField(rawResponses);

          if (responses.length > 0) {
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            const embed = new EmbedBuilder()
              .setColor(0xffc107) // Color amarillo
              .setTitle(`.${code} dice`)
              .setDescription(randomResponse);

            await msg.author.send({ embeds: [embed] });
          } else {
            console.error("No se encontraron respuestas válidas después de procesar los datos.");
          }
        } else {
          console.log("No se encontró ningún Easter Egg con el código proporcionado.");
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          console.log("Tiempo agotado para ingresar un código de Easter Egg.");
        }
      });
    } finally {
      connection.release();
    }
  },
};