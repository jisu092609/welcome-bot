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

const Canvas = require("canvas");

Canvas.registerFont("./assets/SUIT-Regular.ttf", { family: "SUIT" });
Canvas.registerFont("./assets/SUIT-Bold.ttf", { family: "SUITB" });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== 기존 설정 =====
const WELCOME_CHANNEL_ID = "1479184071761592340";
const APPLY_CHANNEL_ID = "1462180691713458289";

const REPORT_BUTTON_CHANNEL_ID = "1483509928449671168";
const REPORT_CATEGORY_ID = "1461907310493564938";
const REPORT_LOG_CHANNEL_ID = "1483510318196985856";

const STAFF_ROLE_NAME = "707Manager";

// ===== DM 설정 =====
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
// 패널 UI
// =========================

async function updatePanel(channel, state = "idle", user = null, progress = "") {

  let content = "";

  if (state === "idle") content = "📨 DM 패널\n🟢 대기중";
  if (state === "working") content = `🔒 사용중\n👤 ${user}`;
  if (state === "sending") content = `🚀 발송중\n${progress}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("dm_start")
      .setLabel("📩 DM 시작")
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
      await user.send("⏰ 작업 자동 취소됨");
    } catch {}

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
  console.log(`✅ 로그인됨: ${client.user.tag}`);

  // DM 패널 생성
  const dmChannel = await client.channels.fetch(DM_PANEL_CHANNEL_ID);
  updatePanel(dmChannel, "idle");

  // 제보 버튼 생성
  const reportChannel = client.channels.cache.get(REPORT_BUTTON_CHANNEL_ID);
  if (reportChannel) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("report_create")
        .setLabel("📩 제보하기")
        .setStyle(ButtonStyle.Danger)
    );

    reportChannel.send({
      content: "제보가 필요하면 버튼을 눌러주세요.",
      components: [row]
    });
  }
});

// =========================
// 환영 시스템
// =========================

client.on("guildMemberAdd", async (member) => {
  try {
    if (member.user.bot) return;

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const canvas = Canvas.createCanvas(1600, 800);
    const ctx = canvas.getContext("2d");

    const bg = await Canvas.loadImage("./assets/background.png");
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: "png" }));

    ctx.drawImage(avatar, 200, 200, 300, 300);

    ctx.font = "50px SUITB";
    ctx.fillStyle = "#fff";
    ctx.fillText(`${member.user.username}님 환영합니다`, 600, 400);

    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: "welcome.png" });

    channel.send({
      content: `${member} 환영합니다!`,
      files: [attachment]
    });

  } catch (err) {
    console.error("환영 오류:", err);
  }
});

// =========================
// 인터랙션 (통합)
// =========================

client.on(Events.InteractionCreate, async interaction => {

  try {

    // ===== DM 시스템 =====
    if (interaction.isButton() && interaction.customId === "dm_start") {

      if (activeSession && interaction.user.id !== activeSession) {
        return interaction.reply({ content: "다른 관리자 사용중", ephemeral: true });
      }

      activeSession = interaction.user.id;
      dmData[interaction.user.id] = {};

      startTimeout(interaction.user.id);

      updatePanel(interaction.channel, "working", interaction.user.tag);

      const modal = new ModalBuilder()
        .setCustomId("dm_modal")
        .setTitle("DM 입력");

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

    if (interaction.isModalSubmit() && interaction.customId === "dm_modal") {

      const content = interaction.fields.getTextInputValue("dm_content");
      dmData[interaction.user.id].content = content;

      const roles = interaction.guild.roles.cache.map(r => ({
        label: r.name,
        value: r.id
      })).slice(0, 25);

      return interaction.reply({
        content: "역할 선택",
        components: [new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`dm_role_${interaction.user.id}`)
            .addOptions(roles)
        )],
        ephemeral: true
      });
    }

    // ===== 기존 역할 버튼 =====
    if (interaction.isButton()) {

      if (interaction.customId.startsWith("mercenary_") ||
          interaction.customId.startsWith("guest_") ||
          interaction.customId.startsWith("waiting_")) {

        const [type, userId] = interaction.customId.split("_");

        if (interaction.user.id !== userId) {
          return interaction.reply({ content: "본인만 가능", ephemeral: true });
        }

        let roleName = type === "mercenary" ? "용병" :
                       type === "guest" ? "손님" : "가입희망자";

        const role = interaction.guild.roles.cache.find(r => r.name === roleName);
        if (!role) return;

        await interaction.member.roles.add(role);

        return interaction.reply({ content: `${roleName} 지급됨`, ephemeral: true });
      }
    }

  } catch (err) {
    console.error(err);
  }
});

client.login(process.env.DISCORD_TOKEN);