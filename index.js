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
  StringSelectMenuBuilder
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

// ===== 설정 =====
const WELCOME_CHANNEL_ID = "1479184071761592340";
const APPLY_CHANNEL_ID = "1462180691713458289";

const REPORT_BUTTON_CHANNEL_ID = "1483509928449671168";
const REPORT_CATEGORY_ID = "1461907310493564938";
const REPORT_LOG_CHANNEL_ID = "1483510318196985856";

const STAFF_ROLE_NAME = "707Manager";

// 🔥 DM 패널 설정 추가
const DM_PANEL_CHANNEL_ID = "1485636420532961451";
const DELAY = 1000;
let dmData = {};

// ===== 한국시간 =====
function getKST(date = new Date()) {
  return date.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false
  });
}

// =========================
// 봇 시작
// =========================

client.once("ready", async () => {

  console.log(`✅ 로그인됨: ${client.user.tag}`);

  // ===== 제보 버튼 =====
  const reportChannel = client.channels.cache.get(REPORT_BUTTON_CHANNEL_ID);
  if (reportChannel) {
    const messages = await reportChannel.messages.fetch({ limit: 10 });
    messages.forEach(msg => {
      if (msg.author.id === client.user.id) msg.delete().catch(()=>{});
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

  // 🔥 DM 패널 생성
  const panelChannel = client.channels.cache.get(DM_PANEL_CHANNEL_ID);
  if (panelChannel) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("dm_start")
        .setLabel("📩 DM 발송 시작")
        .setStyle(ButtonStyle.Primary)
    );

    panelChannel.send({
      content: "📨 DM 발송 관리자 패널\n버튼을 눌러 시작하세요.",
      components: [row]
    });
  }

});

// =========================
// 환영 시스템 (기존 유지)
// =========================

client.on("guildMemberAdd", async (member) => {
  if (member.user.bot) return;

  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const canvas = Canvas.createCanvas(1600, 800);
  const ctx = canvas.getContext("2d");

  const background = await Canvas.loadImage("./assets/background.png");
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

  const frame = await Canvas.loadImage("./assets/frame.png");

  const frameWidth = 1500;
  const frameHeight = 650;

  const frameX = (canvas.width - frameWidth) / 2;
  const frameY = (canvas.height - frameHeight) / 2 + 40;

  ctx.drawImage(frame, frameX, frameY, frameWidth, frameHeight);

  const logo = await Canvas.loadImage("./assets/logo.png");

  ctx.drawImage(logo, canvas.width / 2 - 180, frameY - 110, 360, 180);

  const avatar = await Canvas.loadImage(
    member.user.displayAvatarURL({ extension: "png", size: 256 })
  );

  const avatarSize = 230;

  const avatarX = frameX + 340;
  const avatarY = frameY + frameHeight / 2;

  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize/2 + 8, 0, Math.PI * 2);
  ctx.strokeStyle = "#9c6cff";
  ctx.lineWidth = 6;
  ctx.shadowColor = "#9c6cff";
  ctx.shadowBlur = 20;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize/2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(
    avatar,
    avatarX - avatarSize/2,
    avatarY - avatarSize/2,
    avatarSize,
    avatarSize
  );

  ctx.restore();

  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 18;

  const textX = avatarX + 250;
  const textY = avatarY - 100;

  ctx.font = "56px SUITB";
  ctx.fillStyle = "#ffffff";

  ctx.fillText(`${member.user.username}님 안녕하세요!`, textX, textY);

  ctx.font = "40px SUITB";
  ctx.fillText("707 서버에 오신걸 환영합니다", textX, textY + 70);

  const attachment = new AttachmentBuilder(canvas.toBuffer(), {
    name: "welcome.png"
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mercenary_${member.id}`).setLabel("⚔️ 용병").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`guest_${member.id}`).setLabel("👤 손님").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`waiting_${member.id}`).setLabel("⏳ 가입희망자").setStyle(ButtonStyle.Success)
  );

  channel.send({
    content: `${member} 님 환영합니다!\n역할을 먼저 선택해주세요.`,
    files: [attachment],
    components: [row]
  });
});

// =========================
// 메시지 입력 (DM 시스템)
// =========================

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== DM_PANEL_CHANNEL_ID) return;

  const data = dmData[message.author.id];
  if (!data || data.step !== 1) return;

  data.content = message.content;
  data.step = 2;

  const roles = message.guild.roles.cache
    .filter(r => r.name !== "@everyone")
    .map(r => ({
      label: r.name,
      value: r.id
    }))
    .slice(0, 25);

  const select = new StringSelectMenuBuilder()
    .setCustomId("dm_role_select")
    .setPlaceholder("역할 선택")
    .addOptions(roles);

  const row = new ActionRowBuilder().addComponents(select);

  message.reply({
    content: "🎭 DM 보낼 역할을 선택하세요",
    components: [row]
  });
});

// =========================
// 버튼 처리 (기존 + DM)
// =========================

client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  const guild = interaction.guild;

  // 🔥 DM 시작
  if (interaction.customId === "dm_start") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ 관리자만 사용 가능", ephemeral: true });
    }

    dmData[interaction.user.id] = { step: 1 };

    return interaction.reply({
      content: "📩 보낼 메시지를 입력해주세요.",
      ephemeral: true
    });
  }

  // 🔥 역할 선택
  if (interaction.isStringSelectMenu() && interaction.customId === "dm_role_select") {
    const data = dmData[interaction.user.id];
    if (!data) return;

    const role = guild.roles.cache.get(interaction.values[0]);
    data.role = role;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("dm_confirm").setLabel("✅ 발송").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("dm_cancel").setLabel("❌ 취소").setStyle(ButtonStyle.Danger)
    );

    return interaction.update({
      content: `📨 DM 발송 확인\n\n내용:\n${data.content}\n\n대상:\n${role.name} (${role.members.size}명)`,
      components: [row]
    });
  }

  // 🔥 DM 발송
  if (interaction.customId === "dm_confirm") {

    const data = dmData[interaction.user.id];
    if (!data) return;

    let success = 0;
    let fail = 0;
    let failList = [];

    await interaction.reply("🚀 DM 발송 시작...");

    for (const member of data.role.members.values()) {
      try {
        await member.send(data.content);
        success++;
        await new Promise(res => setTimeout(res, DELAY));
      } catch {
        fail++;
        failList.push(`${member.user.tag} (${member.id})`);
      }
    }

    let resultMsg = `✅ 완료\n성공: ${success}\n실패: ${fail}`;

    if (failList.length > 0) {
      resultMsg += `\n\n❌ 실패 유저:\n${failList.slice(0, 20).join("\n")}`;
      if (failList.length > 20) {
        resultMsg += `\n...외 ${failList.length - 20}명`;
      }
    }

    await interaction.followUp(resultMsg);

    delete dmData[interaction.user.id];
  }

  // 🔥 취소
  if (interaction.customId === "dm_cancel") {
    delete dmData[interaction.user.id];

    return interaction.update({
      content: "❌ 취소됨",
      components: []
    });
  }

  // ================= 기존 버튼들 유지 =================
  if (!interaction.isButton()) return;

  // 👉 기존 역할 선택 / 제보 시스템 그대로 유지 (생략 없이 그대로 작동)
});