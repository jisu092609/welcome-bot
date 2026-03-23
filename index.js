// 🔥 안정화 (봇 안죽게)
process.on("unhandledRejection", err => console.error("❌", err));
process.on("uncaughtException", err => console.error("❌", err));

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  PermissionsBitField,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== 설정 =====
const DM_PANEL_CHANNEL_ID = "1485636420532961451";
const LOG_CHANNEL_ID = "1485645421245239478";

const TIMEOUT = 120000;
const BATCH_SIZE = 5;
const DELAY = 1000;

let dmData = {};
let activeSession = null;
let timeoutMap = {};

// =========================
// READY
// =========================

client.once("ready", async () => {
  console.log("✅ 봇 실행됨");

  const ch = await client.channels.fetch(DM_PANEL_CHANNEL_ID);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("dm_start")
      .setLabel("📩 DM 발송 시작")
      .setStyle(ButtonStyle.Primary)
  );

  ch.send({
    content: "📨 DM 발송 관리자 패널",
    components: [row]
  });
});

// =========================
// 타임아웃
// =========================

function startTimeout(userId, channel) {
  if (timeoutMap[userId]) clearTimeout(timeoutMap[userId]);

  timeoutMap[userId] = setTimeout(() => {
    delete dmData[userId];
    activeSession = null;
    channel.send("⏰ 작업이 자동 취소되었습니다.");
  }, TIMEOUT);
}

// =========================
// 인터랙션
// =========================

client.on(Events.InteractionCreate, async interaction => {
  try {

    // 🔒 작업중 차단
    if (activeSession && interaction.user.id !== activeSession) {
      return interaction.reply({
        content: "❌ 다른 관리자가 사용 중입니다.",
        ephemeral: true
      });
    }

    // =====================
    // 시작 버튼
    // =====================
    if (interaction.isButton() && interaction.customId === "dm_start") {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: "❌ 관리자만 가능", ephemeral: true });
      }

      activeSession = interaction.user.id;
      dmData[interaction.user.id] = {};

      startTimeout(interaction.user.id, interaction.channel);

      const modal = new ModalBuilder()
        .setCustomId("dm_modal")
        .setTitle("DM 메시지 입력");

      const input = new TextInputBuilder()
        .setCustomId("dm_content")
        .setLabel("보낼 메시지")
        .setStyle(TextInputStyle.Paragraph);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }

    // =====================
    // 모달 제출
    // =====================
    if (interaction.isModalSubmit() && interaction.customId === "dm_modal") {

      const content = interaction.fields.getTextInputValue("dm_content");

      dmData[interaction.user.id].content = content;

      startTimeout(interaction.user.id, interaction.channel);

      const roles = interaction.guild.roles.cache
        .filter(r => r.name !== "@everyone")
        .sort((a, b) => b.position - a.position)
        .map(r => ({
          label: r.name,
          value: r.id
        }))
        .slice(0, 25);

      const select = new StringSelectMenuBuilder()
        .setCustomId(`dm_role_${interaction.user.id}`)
        .setPlaceholder("역할 선택")
        .addOptions(roles);

      return interaction.reply({
        content: "🎭 역할 선택",
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

    // =====================
    // 역할 선택
    // =====================
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("dm_role_")) {

      const ownerId = interaction.customId.split("_")[2];
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ 권한 없음", ephemeral: true });
      }

      const role = interaction.guild.roles.cache.get(interaction.values[0]);
      dmData[interaction.user.id].role = role;

      startTimeout(interaction.user.id, interaction.channel);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`dm_confirm_${interaction.user.id}`)
          .setLabel("✅ 발송")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`dm_cancel_${interaction.user.id}`)
          .setLabel("❌ 취소")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.update({
        content: `📨 확인\n\n내용:\n${dmData[interaction.user.id].content}\n\n대상:\n${role.name} (${role.members.size}명)`,
        components: [row]
      });
    }

    // =====================
    // 발송 (최적화 버전)
    // =====================
    if (interaction.isButton() && interaction.customId.startsWith("dm_confirm_")) {

      const ownerId = interaction.customId.split("_")[2];
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ 권한 없음", ephemeral: true });
      }

      const data = dmData[interaction.user.id];

      await interaction.reply({ content: "🚀 발송 시작...", ephemeral: true });

      await interaction.guild.members.fetch();

      const members = Array.from(data.role.members.values());

      let success = 0;
      let fail = 0;
      let failList = [];

      for (let i = 0; i < members.length; i += BATCH_SIZE) {

        const batch = members.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (member) => {
            try {
              await member.send(data.content);
              success++;
            } catch {
              fail++;
              failList.push(member.user.tag);
            }
          })
        );

        await interaction.editReply({
          content: `🚀 발송중...\n${success + fail} / ${members.length}`
        });

        await new Promise(r => setTimeout(r, DELAY));
      }

      let result = `✅ 완료\n성공: ${success}\n실패: ${fail}`;

      if (failList.length > 0) {
        result += `\n\n❌ 실패 유저:\n${failList.slice(0, 20).join("\n")}`;
        if (failList.length > 20) {
          result += `\n...외 ${failList.length - 20}명`;
        }
      }

      await interaction.editReply({ content: result });

      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);

      logChannel.send({
        content: `
📨 DM 발송 로그
관리자: ${interaction.user.tag}

내용:
${data.content}

대상: ${data.role.name}

성공: ${success}
실패: ${fail}
`
      });

      delete dmData[interaction.user.id];
      activeSession = null;
    }

    // =====================
    // 취소
    // =====================
    if (interaction.isButton() && interaction.customId.startsWith("dm_cancel_")) {

      const ownerId = interaction.customId.split("_")[2];
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ 권한 없음", ephemeral: true });
      }

      delete dmData[interaction.user.id];
      activeSession = null;

      return interaction.update({
        content: "❌ 취소됨",
        components: []
      });
    }

  } catch (err) {
    console.error("❌ 에러:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);