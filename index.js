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
ChannelType
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


// ===== 한국시간 함수 =====

function getKST() {

const now = new Date();

return now.toLocaleString("ko-KR", {
timeZone: "Asia/Seoul",
hour: "2-digit",
minute: "2-digit",
second: "2-digit",
hour12: false
});

}


// =========================
// 봇 시작
// =========================

client.once("ready", async () => {

console.log(`✅ 로그인됨: ${client.user.tag}`);

const reportChannel = client.channels.cache.get(REPORT_BUTTON_CHANNEL_ID);
if (!reportChannel) return;

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

});


// =========================
// 환영 시스템
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

ctx.drawImage(
logo,
canvas.width / 2 - 180,
frameY - 110,
360,
180
);

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

ctx.font = "30px SUITB";

ctx.fillText(`ID : ${member.user.id}`, textX, textY + 150);

ctx.fillText(
`Discord 가입 : ${member.user.createdAt.toLocaleDateString()}`,
textX,
textY + 190
);

ctx.fillText(
`서버 가입 : ${new Date().toLocaleDateString()}`,
textX,
textY + 230
);

const attachment = new AttachmentBuilder(canvas.toBuffer(), {
name: "welcome.png"
});

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId(`mercenary_${member.id}`)
.setLabel("⚔️ 용병")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId(`guest_${member.id}`)
.setLabel("👤 손님")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId(`waiting_${member.id}`)
.setLabel("⏳ 가입희망자")
.setStyle(ButtonStyle.Success)

);

channel.send({
content: `${member} 님 환영합니다!\n역할을 먼저 선택해주세요.`,
files: [attachment],
components: [row]
});

});


// =========================
// 제보 시스템
// =========================

client.on(Events.InteractionCreate, async interaction => {

if (!interaction.isButton()) return;

const guild = interaction.guild;


// ===== 제보 생성 =====

if (interaction.customId === "report_create") {

const staffRole = guild.roles.cache.find(r => r.name === STAFF_ROLE_NAME);

const reportChannel = await guild.channels.create({
name: `report-${interaction.user.id}`,
type: ChannelType.GuildText,
parent: REPORT_CATEGORY_ID,
permissionOverwrites: [
{
id: guild.roles.everyone,
deny: [PermissionsBitField.Flags.ViewChannel]
},
{
id: interaction.user.id,
allow: [
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.AttachFiles
]
},
{
id: staffRole.id,
allow: [
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages
]
}
]
});

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("report_close")
.setLabel("🔒 제보 종료")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("report_cancel")
.setLabel("❌ 제보 취소")
.setStyle(ButtonStyle.Danger)

);

reportChannel.send({
content: `${interaction.user} 님의 제보 채널입니다.`,
components: [row]
});

interaction.reply({
content: `✅ 제보 채널 생성 → ${reportChannel}`,
ephemeral: true
});

}


// ===== 제보 종료 / 취소 =====

if (interaction.customId === "report_close" || interaction.customId === "report_cancel") {

const logChannel = guild.channels.cache.get(REPORT_LOG_CHANNEL_ID);

const messages = await interaction.channel.messages.fetch({ limit: 100 });

let logText = "";

messages.reverse().forEach(msg => {

const time = msg.createdAt.toLocaleTimeString("ko-KR", {
timeZone: "Asia/Seoul",
hour12: false
});

logText += `[${time}] ${msg.author.username} : ${msg.content}\n`;

if (msg.attachments.size > 0) {

msg.attachments.forEach(file => {
logText += `[첨부파일] ${file.url}\n`;
});

}

});

const embed = new EmbedBuilder()
.setTitle("📜 제보 로그")
.addFields(
{ name: "채널", value: interaction.channel.name },
{ name: "종료자", value: interaction.user.username },
{ name: "종료시간", value: getKST() }
)
.setDescription(logText.substring(0,4000))
.setTimestamp();

if (logChannel) logChannel.send({ embeds: [embed] });

interaction.channel.delete();

}

});

client.login(process.env.DISCORD_TOKEN);