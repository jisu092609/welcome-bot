// 🔥 안정화
process.on("unhandledRejection", err => console.error("❌", err));
process.on("uncaughtException", err => console.error("❌", err));

const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  PermissionsBitField,
  ChannelType,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// ===== 설정 =====
const WELCOME_CHANNEL_ID = "1479184071761592340";
const APPLY_CHANNEL_ID = "1462180691713458289";

const REPORT_BUTTON_CHANNEL_ID = "1483509928449671168";
const REPORT_CATEGORY_ID = "1461907310493564938";
const REPORT_LOG_CHANNEL_ID = "1483510318196985856";

const STAFF_ROLE_NAME = "707Manager";

// ===== DM 설정 =====
const DM_PANEL_CHANNEL_ID = "1485636420532961451";
let dmData = {};
let activeSession = null;

// ===== READY =====
client.once("ready", async () => {

  console.log(`✅ 로그인됨: ${client.user.tag}`);

  // 제보 버튼 생성
  const reportChannel = client.channels.cache.get(REPORT_BUTTON_CHANNEL_ID);
  if (reportChannel) {

    const msgs = await reportChannel.messages.fetch({ limit: 10 });
    msgs.forEach(m => {
      if (m.author.id === client.user.id) m.delete().catch(()=>{});
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("report_create")
        .setLabel("📩 제보하기")
        .setStyle(ButtonStyle.Danger)
    );

    reportChannel.send({
      content: "문제가 발생했거나 제보가 필요하면 버튼을 눌러주세요.",
      components: [row]
    });
  }

});

// =========================
// 🎉 환영카드 (Railway)
// =========================

client.on("guildMemberAdd", async (member) => {

  if (member.user.bot) return;

  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const avatar = member.user.displayAvatarURL({ extension: "png" });

  const imageUrl = `https://welcome-server-production.up.railway.app/welcome?username=${encodeURIComponent(member.user.username)}&avatar=${encodeURIComponent(avatar)}&id=${member.user.id}&created=${encodeURIComponent(member.user.createdAt.toLocaleDateString())}&joined=${encodeURIComponent(member.joinedAt.toLocaleDateString())}`;

  const attachment = new AttachmentBuilder(imageUrl, { name: "welcome.png" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mercenary_${member.id}`).setLabel("⚔️ 용병").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`guest_${member.id}`).setLabel("👤 손님").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`waiting_${member.id}`).setLabel("⏳ 가입희망자").setStyle(ButtonStyle.Success)
  );

  await channel.send({
    content: `${member} 님 환영합니다!\n역할을 먼저 선택해주세요.`,
    files: [attachment],
    components: [row]
  });

});

// =========================
// 인터랙션
// =========================

client.on(Events.InteractionCreate, async interaction => {

  try {

    // ===== 역할 선택 =====
    if (interaction.isButton() &&
      (interaction.customId.startsWith("mercenary_") ||
       interaction.customId.startsWith("guest_") ||
       interaction.customId.startsWith("waiting_"))) {

      const [type, userId] = interaction.customId.split("_");

      if (interaction.user.id !== userId) {
        return interaction.reply({ content: "❌ 본인만 가능", ephemeral: true });
      }

      let roleName = type === "mercenary" ? "용병" :
                     type === "guest" ? "손님" : "가입희망자";

      const role = interaction.guild.roles.cache.find(r => r.name === roleName);
      if (!role) return interaction.reply({ content: "❌ 역할 없음", ephemeral: true });

      await interaction.member.roles.add(role);

      const disabledRow = new ActionRowBuilder().addComponents(
        interaction.message.components[0].components.map(btn =>
          ButtonBuilder.from(btn).setDisabled(true)
        )
      );

      await interaction.update({ components: [disabledRow] });

      if (type === "waiting") {
        await interaction.followUp({
          content: `📋 가입 신청 → <#${"1462180691713458289"}>`,
          ephemeral: true
        });
      }

      return;
    }

    // ===== 제보 생성 =====
    if (interaction.customId === "report_create") {

      await interaction.deferReply({ ephemeral: true });

      const staffRole = interaction.guild.roles.cache.find(r => r.name === STAFF_ROLE_NAME);

      const reportChannel = await interaction.guild.channels.create({
        name: `report-${interaction.user.id}`,
        type: ChannelType.GuildText,
        parent: REPORT_CATEGORY_ID,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: staffRole.id, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("report_close").setLabel("🔒 종료").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("report_cancel").setLabel("❌ 취소").setStyle(ButtonStyle.Danger)
      );

      await reportChannel.send({
        content: `${interaction.user} 님의 제보 채널입니다.`,
        components: [row]
      });

      await interaction.editReply({
        content: `✅ 생성됨 → ${reportChannel}`
      });
    }

    // ===== 제보 종료 =====
    if (interaction.customId === "report_close" || interaction.customId === "report_cancel") {

      const logChannel = interaction.guild.channels.cache.get(REPORT_LOG_CHANNEL_ID);

      const messages = await interaction.channel.messages.fetch({ limit: 100 });

      let logText = "";
      messages.reverse().forEach(msg => {
        logText += `${msg.author.username}: ${msg.content}\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle("📜 제보 로그")
        .setDescription(logText.substring(0,4000));

      if (logChannel) logChannel.send({ embeds: [embed] });

      await interaction.channel.delete();
    }

  } catch (err) {
    console.error("❌ 에러:", err);
  }

});

client.login(process.env.DISCORD_TOKEN);