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
// READY
// =========================

client.once("ready", async () => {
  console.log("✅ 봇 실행됨");

  const ch = await client.channels.fetch(DM_PANEL_CHANNEL_ID);
  updatePanel(ch, "idle");
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

    // ===== 역할 버튼 =====
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

      // 버튼 비활성화
      const disabledRow = new ActionRowBuilder().addComponents(
        interaction.message.components[0].components.map(btn =>
          ButtonBuilder.from(btn).setDisabled(true)
        )
      );

      // ⭐ 먼저 버튼 업데이트
      await interaction.update({
        content: "✅ 역할이 지급되었습니다.",
        components: [disabledRow]
      });

      // ⭐ 가입희망자 메시지 (ephemeral)
      if (type === "waiting") {

        const moveButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("📄 가입신청서 작성하러 가기")
            .setStyle(ButtonStyle.Link)
            .setURL("https://discord.com/channels/886997213266464848/1462180691713458289")
        );

        await interaction.followUp({
          content: "📌 가입희망자는 가입신청서를 작성해주세요!",
          components: [moveButton],
          ephemeral: true
        });
      }

      return;
    }

  } catch (err) {
    console.error("❌ 에러:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);