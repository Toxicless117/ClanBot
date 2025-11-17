import { Client, Message, TextChannel, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import mysqlPool from "../database/mysqlConnection";
import { RowDataPacket } from "mysql2";

module.exports = {
  name: "crearclan",
  description: "Crea un nuevo clan.",
  async execute(client: Client, message: Message, args: string[]): Promise<void> {
    const connection = await mysqlPool.getConnection();

    try {
      // Normalizar el comando para que no sea sensible a mayúsculas/minúsculas
      const commandName = message.content.split(" ")[0].toLowerCase();
      if (commandName !== "cb!crearclan") {
        return;
      }

      // Verificar que el canal sea un canal de texto
      if (!message.channel || message.channel.type !== ChannelType.GuildText) {
        await message.reply("Este comando solo puede usarse en canales de texto.");
        return;
      }

      const textChannel = message.channel as TextChannel;

      // Crear embed inicial para confirmar la creación del clan
      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("Crear Clan")
        .setDescription("¿Quieres crear un nuevo clan? Presiona el botón correspondiente.")
        .setFooter({ text: "Tienes 60 segundos para responder." });

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("crear_clan_si")
          .setLabel("Sí")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("crear_clan_no")
          .setLabel("No")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("crear_clan_cancelar")
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary)
      );

      const embedMessage = await textChannel.send({ embeds: [embed], components: [buttons] });

      // Crear un collector para los botones
      const collector = embedMessage.createMessageComponentCollector({ time: 60000 }); // 60 segundos

      collector.on("collect", async (interaction) => {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({ content: "Solo el usuario que ejecutó el comando puede interactuar.", ephemeral: true });
          return;
        }

        if (interaction.customId === "crear_clan_no" || interaction.customId === "crear_clan_cancelar") {
          await interaction.update({ content: "Cancelaste la creación del clan.", embeds: [], components: [] });
          collector.stop();
          return;
        }

        if (interaction.customId === "crear_clan_si") {
          embed
            .setDescription("¿Cómo se llamará el clan? Escribe el nombre en el chat.")
            .setFooter({ text: "Tienes 3 minutos para responder." });

          await interaction.update({ embeds: [embed], components: [] });

          // Crear un collector para el nombre del clan
          const nameFilter = (response: Message) => response.author.id === message.author.id;
          const nameCollector = textChannel.createMessageCollector({ filter: nameFilter, time: 180000, max: 1 }); // 3 minutos

          nameCollector.on("collect", async (nameResponse: Message) => {
            const clanName = nameResponse.content;

            // Eliminar el mensaje del usuario para evitar redundancia
            await nameResponse.delete();

            // Insertar en la base de datos
            try {
              // Verificar si el usuario ya lidera un clan
              const [existingClans] = await connection.query<RowDataPacket[]>(
                `SELECT ID_Clan FROM Clanes WHERE Lider_Clan_ID = ?`,
                [message.author.id]
              );

              if (existingClans.length > 0) {
                await message.reply("Ya lideras un clan. No puedes crear otro.");
                return;
              }

              // Crear el clan
              if (!clanName) {
                await message.reply("Debes proporcionar un nombre para el clan.");
                return;
              }

              await connection.query(
                `INSERT INTO Clanes (Nombre_Clan, Lider_Clan_ID, Miembros_Clan) VALUES (?, ?, ?)`,
                [clanName, message.author.id, JSON.stringify([message.author.id])]
              );

              embed
                .setDescription(`¡Clan '${clanName}' creado exitosamente!`)
                .setFooter(null);
              embedMessage.edit({ embeds: [embed], components: [] });
            } catch (err) {
              console.error("Error al crear el clan:", err);
              embed
                .setDescription("Hubo un error al crear el clan. Es posible que el nombre ya exista.")
                .setFooter(null);
              embedMessage.edit({ embeds: [embed], components: [] });
            }
          });

          nameCollector.on("end", (collected) => {
            if (collected.size === 0) {
              embed
                .setDescription("No respondiste a tiempo... Tranquilo, puedes volver a intentarlo.")
                .setFooter(null);
              embedMessage.edit({ embeds: [embed], components: [] });
            }
          });
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          embed
            .setDescription("No respondiste a tiempo... Tranquilo, puedes volver a intentarlo.")
            .setFooter(null);
          embedMessage.edit({ embeds: [embed], components: [] });
        }
      });
    } finally {
      connection.release();
    }
  },
};