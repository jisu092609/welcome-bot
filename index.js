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

// ===== 환영카드 역할 선택 =====
if (interaction.isButton() && (
  interaction.customId.startsWith("mercenary_") ||
  interaction.customId.startsWith("guest_") ||
  interaction.customId.startsWith("waiting_")
)) {

  const [roleType, userId] = interaction.customId.split("_");

  if (interaction.user.id !== userId) {
    return interaction.reply({ content: "❌ 본인만 가능", ephemeral: true });
  }

  let roleName = roleType === "mercenary" ? "용병"
    : roleType === "guest" ? "손님"
    : "가입희망자";

  const role = interaction.guild.roles.cache.find(r => r.name === roleName);
  if (!role) return interaction.reply({ content: "❌ 역할 없음", ephemeral: true });

  await interaction.member.roles.add(role);

  const disabledRow = new ActionRowBuilder().addComponents(
    interaction.message.components[0].components.map(btn =>
      ButtonBuilder.from(btn).setDisabled(true)
    )
  );

  await interaction.update({ components: [disabledRow] });

  if (roleType === "waiting") {
    const applyButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("📋 가입 신청하러 가기")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${interaction.guild.id}/${APPLY_CHANNEL_ID}`)
    );

    await interaction.followUp({
      content: "아래 버튼을 눌러 가입 신청을 진행해주세요.",
      components: [applyButton],
      ephemeral: true
    });
  }
}

// ===== 제보 생성 =====
if (interaction.isButton() && interaction.customId === "report_create") {

  await interaction.deferReply({ ephemeral: true });

  const staffRole = interaction.guild.roles.cache.find(r => r.name === STAFF_ROLE_NAME);

  const reportChannel = await interaction.guild.channels.create({
    name: `report-${interaction.user.id}`,
    type: ChannelType.GuildText,
    parent: REPORT_CATEGORY_ID,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: staffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("report_close").setLabel("🔒 종료").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("report_cancel").setLabel("❌ 취소").setStyle(ButtonStyle.Danger)
  );

  await reportChannel.send({
    content: `${interaction.user} 제보 채널`,
    components: [row]
  });

  await interaction.editReply({
    content: `✅ 생성됨 → ${reportChannel}`
  });
}

// ===== 제보 종료 + 로그 =====
if (interaction.isButton() &&
 (interaction.customId === "report_close" || interaction.customId === "report_cancel")
) {

  await interaction.deferReply({ ephemeral: true });

  const logChannel = interaction.guild.channels.cache.get(REPORT_LOG_CHANNEL_ID);
  const staffRole = interaction.guild.roles.cache.find(r => r.name === STAFF_ROLE_NAME);

  const messages = await interaction.channel.messages.fetch({ limit: 100 });

  let logText = "";

  messages.reverse().forEach(msg => {
    logText += `[${msg.author.username}] ${msg.content || "(내용 없음)"}\n`;
    msg.attachments.forEach(file => logText += `📎 ${file.url}\n`);
  });

  const txtFile = new AttachmentBuilder(
    Buffer.from(logText, "utf-8"),
    { name: `report-log-${interaction.channel.name}.txt` }
  );

  if (logChannel) {
    await logChannel.send({
      content: staffRole ? `<@&${staffRole.id}>` : "",
      files: [txtFile]
    });
  }

  await interaction.editReply({ content: "📜 로그 저장 완료" });

  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 1500);
}

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