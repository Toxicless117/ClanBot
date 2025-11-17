import { Client, Message } from "discord.js";

module.exports = {
  name: "reportarse",
  description: "Verifica que el bot esté operativo.",
  /**
   * Ejecuta el comando reportarse.
   * @param client - El cliente del bot.
   * @param message - El mensaje que activó el comando.
   * @param args - Argumentos adicionales (no utilizados aquí).
   */
  async execute(client: Client, message: Message, args: string[]): Promise<void> {
    // Normalizar el comando para que no sea sensible a mayúsculas/minúsculas
    const commandName = message.content.split(" ")[0].toLowerCase();
    if (commandName !== "cb!reportarse") {
      return;
    }

    await message.reply("Clan Bot operativo y listo para ejecutar sus comandos.");
  },
};