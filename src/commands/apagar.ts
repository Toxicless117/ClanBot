import { Client, Message } from "discord.js";
import dotenv from "dotenv";
import mysqlPool from "../database/mysqlConnection";

dotenv.config();

module.exports = {
  name: "apagar",
  description: "Apaga el bot (solo para el propietario).",
  /**
   * Ejecuta el comando apagar.
   * @param client - El cliente del bot.
   * @param message - El mensaje que activó el comando.
   * @param args - Argumentos adicionales (no utilizados aquí).
   */
  async execute(client: Client, message: Message, args: string[]): Promise<void> {
    const ownerId = process.env.OWNER_ID;

    if (message.author.id !== ownerId) {
      // No hacer nada si el usuario no es el propietario
      return;
    }

    // Normalizar el comando para que no sea sensible a mayúsculas/minúsculas
    const commandName = message.content.split(" ")[0].toLowerCase();
    if (commandName !== "cb!apagar") {
      return;
    }

    await message.reply("Apagando el bot...");

    try {
      // Cerrar la conexión a la base de datos MySQL
      await mysqlPool.end();
      console.log("Conexión a la base de datos MySQL cerrada correctamente.");

      // Cerrar sesión del cliente de Discord
      await client.destroy();

      // Asegurarse de que todas las tareas pendientes se completen antes de salir
      console.log("[DEBUG] Cerrando el proceso del bot...");

      // Salir del proceso
      setTimeout(() => {
        console.log("[DEBUG] Proceso finalizado.");
        process.exit(0);
      }, 1000);
    } catch (error) {
      console.error("Error al apagar el bot:", error);
      process.exit(1);
    }
  },
};