// 🔥 안정화
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
let panelMessage = null;

// =========================
// 패널 UI 업데이트
// =========================

async function updatePanel(channel, state = "idle", user = null, progress = "") {

  let content = "";

  if (state === "idle") {
    content = `📨 DM 발송 관리자 패널\n\n🟢 상태: 대기중`;
  }

  if (state === "working") {
    content = `📨 DM 발송 관리자 패널\n\n🔒 상태: 사용중\n👤 진행자: ${user}\n⏳ 작업 진행중`;
  }

  if (state === "sending") {
    content = `📨 DM 발송 관리자 패널\n\n🚀 발송중\n👤 진행자: ${user}\n📊 ${progress}`;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("dm_start")
      .setLabel("📩 DM 발송 시작")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state !== "idle")
  );

  if (!panelMessage) {
    panelMessage = await channel.send({ content, components: [row] });
  } else {
    await panelMessage.edit({ content, components: [row] });
  }
}

// =========================
// 타임아웃
// =========================

function startTimeout(userId) {
  if (timeoutMap[userId]) clearTimeout(timeoutMap[userId]);

  timeoutMap[userId] = setTimeout(async () => {

    try {
      const user = await client.users.fetch(userId);
      await user.send("⏰ DM 작업이 시간 초과로 자동 취소되었습니다.");
    } catch {}

    delete dmData[userId];
    activeSession = null;
    delete timeoutMap[userId];

    const channel = await client.channels.fetch(DM_PANEL_CHANNEL_ID);
    updatePanel(channel, "idle");

  }, TIMEOUT);
}

// =========================
// READY
// =========================

client.once("ready", async () => {
  console.log("✅ 봇 실행됨");

  const ch = await client.channels.fetch(DM_PANEL_CHANNEL_ID);
  updatePanel(ch, "idle");
});

// =========================
// 인터랙션
// =========================

client.on(Events.InteractionCreate, async interaction => {

  try {

    if (activeSession && interaction.user.id !== activeSession) {
      return interaction.reply({
        content: "❌ 다른 관리자가 사용 중입니다.",
        ephemeral: true
      });
    }

    // =====================
    // 시작
    // =====================
    if (interaction.isButton() && interaction.customId === "dm_start") {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: "❌ 관리자만 가능", ephemeral: true });
      }

      activeSession = interaction.user.id;
      dmData[interaction.user.id] = {};

      startTimeout(interaction.user.id);

      const channel = interaction.channel;
      updatePanel(channel, "working", interaction.user.tag);

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

      startTimeout(interaction.user.id);

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
    if (interaction.isStringSelectMenu()) {

      const ownerId = interaction.customId.split("_")[2];
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ 권한 없음", ephemeral: true });
      }

      const role = interaction.guild.roles.cache.get(interaction.values[0]);
      dmData[interaction.user.id].role = role;

      startTimeout(interaction.user.id);

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
        content: `📨 확인\n\n내용:\n${dmData[interaction.user.id].content}\n\n대상: ${role.name}`,
        components: [row]
      });
    }

    // =====================
    // 발송
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

      const channel = interaction.channel;

      for (let i = 0; i < members.length; i += BATCH_SIZE) {

        const batch = members.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (member) => {
            try {
              await member.send(data.content);
              success++;
            } catch {
              fail++;
            }
          })
        );

        updatePanel(channel, "sending", interaction.user.tag, `${success + fail} / ${members.length}`);

        await new Promise(r => setTimeout(r, DELAY));
      }

      await interaction.editReply(`✅ 완료\n성공:${success} 실패:${fail}`);

      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);

      logChannel.send({
        content: `📨 DM 발송 로그
관리자: ${interaction.user.tag}

내용:
${data.content}

대상: ${data.role.name}

성공: ${success}
실패: ${fail}`
      });

      // 🔥 타임아웃 제거 (핵심)
      if (timeoutMap[interaction.user.id]) {
        clearTimeout(timeoutMap[interaction.user.id]);
        delete timeoutMap[interaction.user.id];
      }

      delete dmData[interaction.user.id];
      activeSession = null;

      updatePanel(channel, "idle");
    }

    // =====================
    // 취소
    // =====================
    if (interaction.isButton() && interaction.customId.startsWith("dm_cancel_")) {

      const ownerId = interaction.customId.split("_")[2];
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ 권한 없음", ephemeral: true });
      }

      if (timeoutMap[interaction.user.id]) {
        clearTimeout(timeoutMap[interaction.user.id]);
        delete timeoutMap[interaction.user.id];
      }

      delete dmData[interaction.user.id];
      activeSession = null;

      updatePanel(interaction.channel, "idle");

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