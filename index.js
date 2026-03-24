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
  Events,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const Canvas = require("canvas");

Canvas.registerFont("./assets/SUIT-Regular.ttf", { family: "SUIT" });
Canvas.registerFont("./assets/SUIT-Bold.ttf", { family: "SUITB" });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// ===== 설정 =====
const WELCOME_CHANNEL_ID = "1479184071761592340";
const DM_PANEL_CHANNEL_ID = "1485636420532961451";

const TIMEOUT = 120000;
const BATCH_SIZE = 5;
const DELAY = 1000;

let dmData = {};
let activeSession = null;
let timeoutMap = {};
let panelMessage = null;

// =========================
// 패널 UI
// =========================

async function updatePanel(channel, state = "idle", user = "", progress = "") {

  let content = `📨 DM 발송 관리자 패널\n\n`;

  if (state === "idle") content += "🟢 상태: 대기중";
  if (state === "working") content += `🔒 사용중\n👤 ${user}`;
  if (state === "sending") content += `🚀 발송중\n👤 ${user}\n📊 ${progress}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("dm_start")
      .setLabel("📩 DM 발송시작")
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
    delete dmData[userId];
    activeSession = null;
    delete timeoutMap[userId];

    const ch = await client.channels.fetch(DM_PANEL_CHANNEL_ID);
    updatePanel(ch, "idle");

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
// 🎉 환영카드 (원본 유지)
// =========================

client.on("guildMemberAdd", async (member) => {
 console.log("🔥 유저 입장 감지:", member.user.tag);

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

    // ===== 환영카드 버튼 =====
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
      if (!role) return;

      await interaction.member.roles.add(role);

      // 🔥 버튼 비활성화
      const disabledRow = new ActionRowBuilder().addComponents(
        interaction.message.components[0].components.map(btn =>
          ButtonBuilder.from(btn).setDisabled(true)
        )
      );

      return interaction.update({
        content: "✅ 역할이 지급되었습니다.",
        components: [disabledRow]
      });
    }

    // ===== DM 시작 =====
    if (interaction.isButton() && interaction.customId === "dm_start") {

      if (activeSession && interaction.user.id !== activeSession) {
        return interaction.reply({ content: "❌ 사용중", ephemeral: true });
      }

      activeSession = interaction.user.id;
      dmData[interaction.user.id] = {};

      startTimeout(interaction.user.id);
      updatePanel(interaction.channel, "working", interaction.user.tag);

      const modal = new ModalBuilder()
        .setCustomId("dm_modal")
        .setTitle("DM 내용 입력");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("dm_content")
            .setLabel("내용")
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

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`dm_confirm_${interaction.user.id}`).setLabel("✅ 발송").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`dm_cancel_${interaction.user.id}`).setLabel("❌ 취소").setStyle(ButtonStyle.Danger)
      );

      return interaction.update({
        content: `📨 확인\n대상: ${role.name}`,
        components: [row]
      });
    }

    // ===== 발송 =====
    if (interaction.isButton() && interaction.customId.startsWith("dm_confirm_")) {

      const ownerId = interaction.customId.split("_")[2];
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ 권한 없음", ephemeral: true });
      }

      const data = dmData[interaction.user.id];

      await interaction.reply({ content: "🚀 발송 시작", ephemeral: true });

      await interaction.guild.members.fetch();
      const members = Array.from(data.role.members.values());

      let success = 0;
      let fail = 0;

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

        updatePanel(interaction.channel, "sending", interaction.user.tag, `${success+fail}/${members.length}`);
        await new Promise(r => setTimeout(r, DELAY));
      }

      await interaction.editReply(`✅ 완료\n성공:${success} 실패:${fail}`);

      if (timeoutMap[interaction.user.id]) {
        clearTimeout(timeoutMap[interaction.user.id]);
        delete timeoutMap[interaction.user.id];
      }

      delete dmData[interaction.user.id];
      activeSession = null;

      updatePanel(interaction.channel, "idle");
    }

    // ===== 취소 =====
    if (interaction.isButton() && interaction.customId.startsWith("dm_cancel_")) {

      const userId = interaction.customId.split("_")[2];

      if (timeoutMap[userId]) {
        clearTimeout(timeoutMap[userId]);
        delete timeoutMap[userId];
      }

      delete dmData[userId];
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