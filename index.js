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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
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

// ===== DM =====
const DM_PANEL_CHANNEL_ID = "1485636420532961451";
let dmData = {};
let activeSession = null;

// ===== 시간 =====
function getTime(date = new Date()) {
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

// ===== READY =====
client.once("ready", async () => {

  console.log("✅ 봇 실행됨");

  const reportChannel = client.channels.cache.get(REPORT_BUTTON_CHANNEL_ID);
  if (reportChannel) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("report_create")
        .setLabel("📩 제보하기")
        .setStyle(ButtonStyle.Danger)
    );

    reportChannel.send({
      content: "문제가 있으면 제보해주세요.",
      components: [row]
    });
  }

});

// =========================
// 🎉 환영카드
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
    content: `${member} 환영합니다!`,
    files: [attachment],
    components: [row]
  });

});

// =========================
// 인터랙션
// =========================

client.on(Events.InteractionCreate, async interaction => {

  try {

    // ===== 역할 =====
    if (interaction.isButton() && interaction.customId.includes("_")) {

      const [type, userId] = interaction.customId.split("_");

      if (["mercenary","guest","waiting"].includes(type)) {

        if (interaction.user.id !== userId) {
          return interaction.reply({ content: "❌ 본인만 가능", ephemeral: true });
        }

        const roleName = type === "mercenary" ? "용병" :
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
            content: `📄 가입신청서 작성 → <#${APPLY_CHANNEL_ID}>`,
            ephemeral: true
          });
        }

        return;
      }
    }

    // ===== 제보 생성 =====
    if (interaction.customId === "report_create") {

      await interaction.deferReply({ ephemeral: true });

      const staffRole = interaction.guild.roles.cache.find(r => r.name === STAFF_ROLE_NAME);
      if (!staffRole) return interaction.editReply("❌ 관리자 역할 없음");

      const channel = await interaction.guild.channels.create({
        name: `report-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: REPORT_CATEGORY_ID,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: staffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      channel.startTime = new Date();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("report_close").setLabel("🔒 종료").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("report_cancel").setLabel("❌ 취소").setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${interaction.user}님의 제보 채널입니다.`,
        components: [row]
      });

      await interaction.editReply(`✅ 생성됨 → ${channel}`);
    }

    // ===== 제보 종료 =====
    if (interaction.customId === "report_close" || interaction.customId === "report_cancel") {

      const logChannel = interaction.guild.channels.cache.get(REPORT_LOG_CHANNEL_ID);

      const messages = await interaction.channel.messages.fetch({ limit: 100 });

      let logText = "";
      messages.reverse().forEach(msg => {

        const role = msg.member?.roles.cache.some(r => r.name === STAFF_ROLE_NAME)
          ? "👮 관리자"
          : "👤 유저";

        logText += `[${getTime(msg.createdAt)}] ${role} ${msg.author.username} : ${msg.content}\n`;

        if (msg.attachments.size > 0) {
          msg.attachments.forEach(a => {
            logText += `📎 ${a.url}\n`;
          });
        }

      });

      const embed = new EmbedBuilder()
        .setTitle("📜 제보 로그")
        .addFields(
          { name: "제보자", value: interaction.channel.name },
          { name: "종료자", value: interaction.user.username },
          { name: "시작", value: getTime(interaction.channel.startTime || new Date()) },
          { name: "종료", value: getTime() }
        )
        .setDescription(logText.substring(0, 4000));

      if (logChannel) logChannel.send({ embeds: [embed] });

      await interaction.channel.delete();
    }

    // ===== fallback =====
    if (interaction.isButton() && !interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: "⚠️ 처리되지 않은 버튼", ephemeral: true });
    }

  } catch (err) {
    console.error(err);
  }

});

client.login(process.env.DISCORD_TOKEN);