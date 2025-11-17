import { Client, Collection, GatewayIntentBits } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";
import initializeDatabase from "./database/initializeDatabase";
import mysqlPool from "./database/mysqlConnection";
import { exec } from "child_process";

dotenv.config();

// Clase personalizada para el cliente del bot
class ClanBotClient extends Client {
  commands: Collection<string, any> = new Collection(); // Inicializar directamente
}

const client = new ClanBotClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PREFIX = "cb!".toLowerCase(); // Convertir el prefijo a minúsculas para flexibilidad

console.log("Intentando cargar comandos desde la carpeta /commands...");
// Cargar comandos dinámicamente desde la carpeta /commands
// En runtime (dist), solo existen .js
const commandFiles = readdirSync(join(__dirname, "commands"))
  .filter(file => file.endsWith(".js"));

console.log("Archivos de comandos encontrados:", commandFiles); // Depuración

for (const file of commandFiles) {
  try {
    console.log(`[DEBUG] Intentando cargar archivo de comando: ${file}`); // Depuración
    const command = require(`./commands/${file}`);
    if (command.name) {
      client.commands.set(command.name, command);
      console.log(`[DEBUG] Comando cargado: ${command.name}`); // Log para confirmar carga
    } else {
      console.log(`[WARNING] El archivo ${file} no exporta un comando válido.`);
    }
  } catch (error) {
    console.error(`[ERROR] Error al cargar el archivo ${file}:`, error);
  }
}

client.once("clientReady", () => {
  console.log(`ClanBot en estado operativo como ${client.user?.tag}!`);
});

// Manejar mensajes y ejecutar comandos
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase(); // Convertir el mensaje a minúsculas y eliminar espacios

  if (!content.startsWith(PREFIX)) return;

  console.log(`Mensaje recibido: ${message.content}`); // Mensaje de depuración

  const args = content.slice(PREFIX.length).trim().split(/\s+/); // Dividir por espacios
  const commandName = args.shift()?.toLowerCase() ?? "";

  // Buscar el comando o sus alias
  const command = client.commands.get(commandName) ||
                  client.commands.find((cmd: any) => cmd.aliases && cmd.aliases.includes(commandName));

  if (!command) {
    console.log(`Comando no encontrado: ${commandName}`); // Mensaje de depuración
    return;
  }

  try {
    await command.execute(client, message, args);
  } catch (error) {
    console.error(`Error al ejecutar el comando ${commandName}:`, error);
    message.reply("Hubo un error al ejecutar el comando.");
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error ejecutando el comando ${interaction.commandName}:`, error);
    await interaction.reply({ content: "Hubo un error al ejecutar este comando.", ephemeral: true });
  }
});

(async () => {
  console.log("[DEBUG] Inicializando base de datos...");
  try {
    await initializeDatabase();
    console.log("[DEBUG] Base de datos inicializada correctamente.");
  } catch (error) {
    console.error("[ERROR] Error al inicializar la base de datos:", error);
    process.exit(1); // Salir si la base de datos no se inicializa correctamente
  }
})();

(async () => {
  const connection = await mysqlPool.getConnection();

  try {
    const easterEggs = {
      ".fortune": [
        "Todo trabajo duro, al final valdrá la pena.",
        "Todo está en silencio.",
        "*Pero no vino ninguna fortuna*",
        "Si algo no puede salir mal, de todos modos lo hará.",
        "La naturaleza es siempre el lado oculto de los defectos.",
        "Nunca uses tus mejores pantalones cuando luches por la libertad.",
        "El descanso es bueno, pero el ocio es su hermano.",
        "Sonríe cuando estés listo.",
        "No se puede caer en el piso.",
        "Tu suerte está a punto de cambiar.",
        "Lo sentimos, esta fortuna está temporalemnte fuera de servicio.",
        "Me gustan los frijoles.",
        "Esto claramente no es una fortuna.",
        "Esto claramente no es una referencia a Halo."
      ]
    };

    for (const [code, responses] of Object.entries(easterEggs)) {
      const jsonResponses = JSON.stringify(responses); // Asegurar que sea un JSON válido
      await connection.query(
        `INSERT INTO Eastereggs (Codigo_Easteregg, Lista_Respuestas) VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE Lista_Respuestas = VALUES(Lista_Respuestas);`,
        [code, jsonResponses]
      );
    }

    console.log("Easter eggs actualizados en la base de datos.");
  } finally {
    connection.release();
  }
})();

// Ejecutar el script de reparación de Easter Eggs al iniciar el bot (sobre JS compilado)
exec("node dist/scripts/fixEasterMessages.js", (error, stdout, stderr) => {
  if (error) {
    console.error("Error al ejecutar el script de reparación de Easter Eggs:", error);
    return;
  }
  if (stderr) {
    console.error("Advertencias del script de reparación de Easter Eggs:", stderr);
  }
  console.log("Salida del script de reparación de Easter Eggs:", stdout);
});

// Manejar el apagado limpio del bot
process.on("SIGINT", async () => {
  console.log("[DEBUG] Apagando el bot...");
  try {
    await mysqlPool.end();
    console.log("[DEBUG] Conexión a la base de datos cerrada correctamente.");
    await client.destroy();
    console.log("[DEBUG] Cliente de Discord destruido correctamente.");
  } catch (error) {
    console.error("[ERROR] Error al apagar el bot:", error);
  } finally {
    process.exit(0);
  }
});

client.login(process.env.TOKEN);
