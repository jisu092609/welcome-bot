// 🔥 안정화 핸들러 (맨 위 추가)
process.on("unhandledRejection", err => {
  console.error("❌ UnhandledRejection:", err);
});
process.on("uncaughtException", err => {
  console.error("❌ UncaughtException:", err);
});

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

const DM_PANEL_CHANNEL_ID = "1485636420532961451";
const DELAY = 1000;
let dmData = {};

// =========================
// READY (안정화 버전)
// =========================

client.once("ready", async () => {
  console.log(`✅ 로그인됨: ${client.user.tag}`);

  try {
    // 🔥 DM 패널 (fetch 사용 = Railway 안정화)
    const panelChannel = await client.channels.fetch(DM_PANEL_CHANNEL_ID);

    if (!panelChannel) {
      console.log("❌ DM 패널 채널 못찾음");
    } else {
      console.log("✅ DM 패널 채널:", panelChannel.name);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("dm_start")
          .setLabel("📩 DM 발송 시작")
          .setStyle(ButtonStyle.Primary)
      );

      await panelChannel.send({
        content: "📨 DM 발송 관리자 패널\n버튼을 눌러 시작하세요.",
        components: [row]
      });
    }

  } catch (err) {
    console.error("❌ DM 패널 생성 오류:", err);
  }
});

// =========================
// DM 메시지 입력
// =========================

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.channel.id !== DM_PANEL_CHANNEL_ID) return;

    const data = dmData[message.author.id];
    if (!data || data.step !== 1) return;

    data.content = message.content;
    data.step = 2;

    const roles = message.guild.roles.cache
      .filter(r => r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
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

    await message.reply({
      content: "🎭 DM 보낼 역할을 선택하세요",
      components: [row]
    });

  } catch (err) {
    console.error("❌ messageCreate 에러:", err);
  }
});

// =========================
// 인터랙션 처리
// =========================

client.on(Events.InteractionCreate, async interaction => {
  try {

    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const guild = interaction.guild;

    // 👉 시작
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

    // 👉 역할 선택
    if (interaction.isStringSelectMenu() && interaction.customId === "dm_role_select") {

      const data = dmData[interaction.user.id];
      if (!data) return;

      const role = guild.roles.cache.get(interaction.values[0]);
      if (!role) return interaction.reply({ content: "❌ 역할 없음", ephemeral: true });

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

    // 👉 발송
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

    // 👉 취소
    if (interaction.customId === "dm_cancel") {
      delete dmData[interaction.user.id];

      return interaction.update({
        content: "❌ 취소됨",
        components: []
      });
    }

  } catch (err) {
    console.error("❌ Interaction 에러:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);