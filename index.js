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

// ⭐ DM 로그 채널
const DM_LOG_CHANNEL_ID = "1485645421245239478";

// ===== DM =====
const DM_PANEL_CHANNEL_ID = "1485636420532961451";
let dmData = {};
let activeSession = null;

// ===== 시간 =====
function getTime() {
  return new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false
  });
}

// ===== READY =====
client.once("ready", async () => {

  console.log("✅ 봇 실행됨");

  // DM 패널
  const dmChannel = client.channels.cache.get(DM_PANEL_CHANNEL_ID);
  if (dmChannel) {
    dmChannel.send({
      content: "📨 DM 발송 관리자 패널\n\n🟢 상태: 대기중",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("dm_start")
            .setLabel("📩 DM 발송시작")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

});

// =========================
// 인터랙션
// =========================

client.on(Events.InteractionCreate, async interaction => {

  try {

    // 🔥 버튼 아니면 무시 (중요)
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    // ===== DM 시작 =====
    if (interaction.isButton() && interaction.customId === "dm_start") {

      activeSession = interaction.user.id;
      dmData[interaction.user.id] = {};

      const modal = new ModalBuilder()
        .setCustomId("dm_modal")
        .setTitle("DM 내용 입력");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("dm_content")
            .setLabel("보낼 메시지")
            .setStyle(TextInputStyle.Paragraph)
        )
      );

      return interaction.showModal(modal);
    }

    // ===== DM 입력 =====
    if (interaction.isModalSubmit() && interaction.customId === "dm_modal") {

      const content = interaction.fields.getTextInputValue("dm_content");
      dmData[interaction.user.id].content = content;

      const roles = interaction.guild.roles.cache
        .filter(r => r.name !== "@everyone")
        .map(r => ({ label: r.name, value: r.id }))
        .slice(0, 25);

      return interaction.reply({
        content: "🎭 역할 선택",
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`dm_role_${interaction.user.id}`)
              .addOptions(roles)
          )
        ],
        ephemeral: true
      });
    }

    // ===== 역할 선택 =====
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("dm_role_")) {

      const ownerId = interaction.customId.split("_")[2];

      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ 본인만 가능", ephemeral: true });
      }

      const role = interaction.guild.roles.cache.get(interaction.values[0]);
      dmData[interaction.user.id].role = role;

      return interaction.update({
        content: `📨 대상: ${role.name}`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`dm_confirm_${interaction.user.id}`)
              .setLabel("발송")
              .setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    // ===== DM 발송 =====
    if (interaction.isButton() && interaction.customId.startsWith("dm_confirm_")) {

      const ownerId = interaction.customId.split("_")[2];

      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ 본인만 가능", ephemeral: true });
      }

      const data = dmData[interaction.user.id];

      await interaction.reply({ content: "🚀 발송 시작", ephemeral: true });

      await interaction.guild.members.fetch();

      const members = Array.from(data.role.members.values());

      let success = 0;
      let fail = 0;

      for (const member of members) {
        try {
          await member.send(data.content);
          success++;
        } catch {
          fail++;
        }
      }

      await interaction.editReply(`✅ 완료\n성공:${success} 실패:${fail}`);

      // 로그
      const logChannel = interaction.guild.channels.cache.get(DM_LOG_CHANNEL_ID);

      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle("📨 DM 발송 로그")
          .addFields(
            { name: "관리자", value: interaction.user.username },
            { name: "시간", value: getTime() },
            { name: "대상 역할", value: data.role.name },
            { name: "대상 인원", value: `${members.length}명` },
            { name: "성공", value: `${success}명`, inline: true },
            { name: "실패", value: `${fail}명`, inline: true },
            { name: "내용", value: data.content.substring(0, 1000) }
          );

        logChannel.send({ embeds: [embed] });
      }

      delete dmData[interaction.user.id];
      activeSession = null;
    }

  } catch (err) {
    console.error(err);
  }

});

client.login(process.env.DISCORD_TOKEN);