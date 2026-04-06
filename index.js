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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
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

// ⭐ 패널 메시지 저장12
let dmPanelMessage = null;

// ⭐ 타임아웃 추가
let dmTimeout = null;

// ===== 시간 =====
function getTime() {
  return new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false
  });
}

// ⭐ 패널 업데이트 함수 (버튼 추가)
async function updateDmPanel(statusText) {
  if (!dmPanelMessage) return;

  await dmPanelMessage.edit({
    content: `📨 DM 발송 관리자 패널\n\n${statusText}`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("dm_start")
          .setLabel("📩 DM 발송시작")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("dm_cancel")
          .setLabel("❌ 사용 취소")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  });
}

// ===== READY =====
client.once("ready", async () => {

  console.log("✅ 봇 실행됨");

  const reportChannel = client.channels.cache.get(REPORT_BUTTON_CHANNEL_ID);
  if (reportChannel) {
    reportChannel.send({
      content: `📢 **제보 안내**
문제나 건의사항이 있으시면 아래 버튼을 눌러주세요.

🔒 제보는 비공개 채널로 생성되며
운영진과 제보자만 확인할 수 있습니다.`,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("report_create")
            .setLabel("📩 제보하기")
            .setStyle(ButtonStyle.Danger)
        )
      ]
    });
  }

  const dmChannel = client.channels.cache.get(DM_PANEL_CHANNEL_ID);
  if (dmChannel) {
    dmPanelMessage = await dmChannel.send({
      content: "📨 DM 발송 관리자 패널\n\n🟢 상태: 대기중",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("dm_start")
            .setLabel("📩 DM 발송시작")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("dm_cancel")
            .setLabel("❌ 사용 취소")
            .setStyle(ButtonStyle.Danger)
        )
      ]
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

const imageUrl = `https://welcome-server-production.up.railway.app/welcome?username=${encodeURIComponent(member.user.username)}&avatar=${encodeURIComponent(avatar)}&id=${member.user.id}&created=${encodeURIComponent(member.user.createdAt.toLocaleDateString())}&joined=${encodeURIComponent(member.joinedAt?.toLocaleDateString() || "Unknown")}`;
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

    // ===== 취소 버튼 (추1가) =====
    if (interaction.isButton() && interaction.customId === "dm_cancel") {

      if (activeSession && interaction.user.id !== activeSession) {
        return interaction.reply({ content: "❌ 다른 관리자가 사용중", ephemeral: true });
      }

      activeSession = null;
      dmData = {};

      if (dmTimeout) clearTimeout(dmTimeout);

      await updateDmPanel("🟢 상태: 대기중");

      return interaction.reply({ content: "✅ 취소 완료", ephemeral: true });
    }

    // DM 시작
    if (interaction.isButton() && interaction.customId === "dm_start") {

      if (activeSession && interaction.user.id !== activeSession) {
        return interaction.reply({ content: "❌ 사용중", ephemeral: true });
      }

      activeSession = interaction.user.id;

      await updateDmPanel(`🔴 상태: 사용중 (${interaction.user.username})`);

      // ⭐ 타임아웃 시작
      dmTimeout = setTimeout(async () => {
        activeSession = null;
        dmData = {};
        await updateDmPanel("🟢 상태: 대기중");
      }, 5 * 60 * 1000);

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

    if (interaction.isModalSubmit() && interaction.customId === "dm_modal") {

      if (activeSession && interaction.user.id !== activeSession) {
        return interaction.reply({ content: "❌ 사용중", ephemeral: true });
      }

      dmData[interaction.user.id] = {};

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

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("dm_role_")) {

      const ownerId = interaction.customId.split("_")[2];
      if (interaction.user.id !== ownerId) return;

      const role = interaction.guild.roles.cache.get(interaction.values[0]);
      dmData[interaction.user.id].role = role;

      await interaction.deferUpdate();

      return interaction.editReply({
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

    if (interaction.isButton() && interaction.customId.startsWith("dm_confirm_")) {

      const ownerId = interaction.customId.split("_")[2];
      if (interaction.user.id !== ownerId) return;

      await interaction.deferReply({ ephemeral: true });

      const data = dmData[interaction.user.id];

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

        await logChannel.send({ embeds: [embed] });
      }

      delete dmData[interaction.user.id];
      activeSession = null;

      if (dmTimeout) clearTimeout(dmTimeout);

      await updateDmPanel("🟢 상태: 대기중");
    }

  } catch (err) {
    console.error(err);
  }

});

client.login(process.env.DISCORD_TOKEN);