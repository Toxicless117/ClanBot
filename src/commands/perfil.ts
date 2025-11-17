import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, Message, EmbedBuilder } from "discord.js";
import mysqlPool from "../database/mysqlConnection";
import { getRequiredXP } from "../utils/leveling";
import { RowDataPacket } from "mysql2";

module.exports = {
  name: "perfil",
  description: "Consulta tu perfil dentro del servidor y del bot.",
  async execute(client: Client, message: Message, args: string[]): Promise<void> {
    console.log("[DEBUG] Comando cb!perfil ejecutado correctamente.");

    // Obtener el usuario mencionado o el autor del mensaje
    const mentionedUser = message.mentions.users.first();
    const userId = mentionedUser ? mentionedUser.id : message.author.id;

    const connection = await mysqlPool.getConnection();

    try {
      // Consultar la base de datos para verificar si el usuario tiene un perfil
      const [userRows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM Usuarios WHERE ID_Usuario = ?`,
        [userId]
      );

      if (userRows.length === 0) {
        const embed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("Perfil no encontrado")
          .setDescription("No tienes un perfil registrado. ¿Quieres crear uno?")
          .setFooter({ text: "Tienes 30 segundos para decidir." });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("create_profile")
            .setLabel("Crear Perfil")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("cancel")
            .setLabel("Cancelar")
            .setStyle(ButtonStyle.Danger)
        );

        const reply = await message.reply({ embeds: [embed], components: [row] });

        const collector = reply.createMessageComponentCollector({ time: 30000, filter: (i) => i.user.id === userId });

        collector.on("collect", async (interaction) => {
          if (!interaction.isButton()) return;
          // Si por alguna razón pasó el filtro, bloqueamos a otros usuarios
          if (interaction.user.id !== userId) {
            await interaction.reply({ content: "Solo el autor puede usar estos botones.", ephemeral: true });
            return;
          }

          if (interaction.customId === "create_profile") {
            await connection.query(
              `INSERT INTO Usuarios (ID_Usuario, Nombre_Usuario, Nivel, XP, Racha) VALUES (?, ?, 1, 0, 0)`,
              [userId, interaction.user.username]
            );

            await interaction.update({
              content: "Tu perfil ha sido creado exitosamente.",
              embeds: [],
              components: [],
            });
          } else if (interaction.customId === "cancel") {
            await interaction.update({
              content: "Has cancelado el proceso.",
              embeds: [],
              components: [],
            });

            setTimeout(() => reply.delete().catch(() => {}), 10000);
          }
        });

        collector.on("end", async (_collected) => {
          try {
            // Si no se canceló explícitamente, mostrar expiración y borrar a los 10s
            if (reply.editable) {
              await reply.edit({ content: "Tiempo agotado. Cerrando...", embeds: [], components: [] });
              setTimeout(() => reply.delete().catch(() => {}), 10000);
            } else {
              setTimeout(() => reply.delete().catch(() => {}), 10000);
            }
          } catch {
            // ignorar errores de edición/borrado
          }
        });

        return;
      }

      const userRow = userRows[0];

      // Consultar el clan asociado al usuario (miembro o líder)
      let clanName = "Sin Clan";
      let clanRole = "Sin rol";
      if (userRow.ID_Clan) {
        const [clanRows] = await connection.query<RowDataPacket[]>(
          `SELECT Nombre_Clan, Lider_Clan_ID FROM Clanes WHERE ID_Clan = ?`,
          [userRow.ID_Clan]
        );
        if (clanRows.length > 0) {
          clanName = clanRows[0].Nombre_Clan;
          clanRole = clanRows[0].Lider_Clan_ID == userId ? "Líder" : "Miembro";
        }
      } else {
        // Si no hay ID_Clan en el usuario, verificar si es líder de algún clan
        const [leaderRows] = await connection.query<RowDataPacket[]>(
          `SELECT Nombre_Clan FROM Clanes WHERE Lider_Clan_ID = ? LIMIT 1`,
          [userId]
        );
        if (leaderRows.length > 0) {
          clanName = leaderRows[0].Nombre_Clan;
          clanRole = "Líder";
        }
      }

      // Datos para el embed con estilo panel tipo “ficha técnica”
      const targetUser = mentionedUser ?? message.author;
      const nivel = Number(userRow.Nivel ?? 1);
      const racha = Number(userRow.Racha ?? 0);
      const requiredXP = getRequiredXP(nivel, racha);
      const xp = Number(userRow.XP ?? 0);
      const multiplicador = Number(userRow.Multiplicador ?? 1);
      const logros = Number(userRow.Logros ?? 0);
      const rachaMax = Number(userRow.Racha_Max ?? racha);
      const puntosTotales = Number(userRow.Puntos_Totales ?? 0);
      const avatarURL = targetUser.displayAvatarURL({ size: 128 });

      // Reproducción exacta del diseño usando campos inline (estructura del panel de la imagen)
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71) // verde lateral similar
        .setTitle(`Perfil de ${targetUser.username}`)
        .setThumbnail(avatarURL)
        .addFields(
          { name: 'Nivel', value: `${nivel}`, inline: true },
          { name: 'XP', value: `${xp} / ${requiredXP}`, inline: true },
          { name: 'Racha de Actividad', value: `${racha} días`, inline: true },
          { name: 'Multiplicador de Racha', value: `x${multiplicador}`, inline: true },
          { name: 'Puntos Totales', value: `${puntosTotales}`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: 'Logros', value: logros === 0 ? 'Ninguno' : String(logros), inline: false },
          { name: 'Clan', value: clanName === 'Sin Clan' ? 'Sin Clan' : `${clanName} ${clanRole === 'Líder' ? '(Líder)' : '(Miembro)'}`, inline: false },
          { name: '\u200B', value: '¡Sigue participando para mejorar tus estadísticas!', inline: false }
        );

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("[ERROR] Al ejecutar el comando cb!perfil:", error);
      message.reply("Ocurrió un error al ejecutar el comando. Por favor, inténtalo de nuevo más tarde.");
    } finally {
      connection.release();
    }
  },
};