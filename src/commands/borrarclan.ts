import { Client, Message, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { RowDataPacket } from "mysql2";
import mysqlPool from "../database/mysqlConnection";

module.exports = {
  name: "borrarclan",
  description: "Elimina un clan del cual eres líder.",
  async execute(client: Client, message: Message, args: string[]): Promise<void> {
    const connection = await mysqlPool.getConnection();

    try {
      // Verificar si el usuario lidera algún clan
      const [clans] = await connection.query<RowDataPacket[]>(
        `SELECT ID_Clan, Nombre_Clan FROM Clanes WHERE Lider_Clan_ID = ?`,
        [message.author.id]
      );

      if (clans.length === 0) {
        await message.reply("No lideras ningún clan para borrar.");
        return;
      }

      // Mostrar lista de clanes liderados
      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("Clanes liderados")
        .setDescription("Selecciona el clan que deseas borrar:");

      const buttons = new ActionRowBuilder<ButtonBuilder>();
      clans.forEach((clan: any, index: number) => {
        buttons.addComponents(
          new ButtonBuilder()
            .setCustomId(`delete_clan_${clan.ID_Clan}`)
            .setLabel(clan.Nombre_Clan)
            .setStyle(ButtonStyle.Danger)
        );
      });

      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId("cancel")
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary)
      );

      const embedMessage = await message.reply({ embeds: [embed], components: [buttons] });

      const collector = embedMessage.createMessageComponentCollector({ time: 15000 }); // 15 segundos

      collector.on("collect", async (interaction) => {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({ content: "Solo el usuario que ejecutó el comando puede interactuar.", ephemeral: true });
          return;
        }

        if (interaction.customId === "cancel") {
          await interaction.update({ content: "Operación cancelada.", embeds: [], components: [] });
          collector.stop();
          return;
        }

        const clanId = interaction.customId.split("_")[2];
        const selectedClan = clans.find((clan: any) => clan.ID_Clan.toString() === clanId);

        if (!selectedClan) {
          await interaction.reply({ content: "Clan no encontrado.", ephemeral: true });
          return;
        }

        await connection.query(`DELETE FROM Clanes WHERE ID_Clan = ?`, [selectedClan.ID_Clan]);
        await interaction.update({ content: `El clan **${selectedClan.Nombre_Clan}** ha sido eliminado.`, embeds: [], components: [] });
        collector.stop();
      });

      collector.on("end", async (_, reason) => {
        if (reason === "time") {
          await embedMessage.edit({ content: "Tiempo agotado. Operación cancelada.", embeds: [], components: [] });
        }
      });
    } finally {
      connection.release();
    }
  },
};