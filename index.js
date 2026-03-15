const {
Client,
GatewayIntentBits,
AttachmentBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
Events
} = require("discord.js");

const Canvas = require("canvas");

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers
]
});

client.once("ready", () => {
console.log(`✅ 로그인됨: ${client.user.tag}`);
});

client.on("guildMemberAdd", async (member) => {

const channel = member.guild.channels.cache.find(
c => c.name === "아롱이의 봇연구소"
);

if (!channel) return;

// Canvas 생성
const canvas = Canvas.createCanvas(900, 350);
const ctx = canvas.getContext("2d");

// 배경
ctx.fillStyle = "#1e1f22";
ctx.fillRect(0, 0, canvas.width, canvas.height);

// 제목
ctx.font = "40px sans-serif";
ctx.fillStyle = "#ffffff";
ctx.fillText(`환영합니다 ${member.user.username}!`, 260, 80);

// 정보
ctx.font = "24px sans-serif";
ctx.fillText(`ID : ${member.user.id}`, 260, 150);

ctx.fillText(
`Discord 가입 : ${member.user.createdAt.toLocaleDateString()}`,
260,
200
);

ctx.fillText(
`서버 가입 : ${new Date().toLocaleDateString()}`,
260,
250
);

// 프로필 이미지
const avatar = await Canvas.loadImage(
member.user.displayAvatarURL({ extension: "png" })
);

ctx.save();
ctx.beginPath();
ctx.arc(140, 175, 100, 0, Math.PI * 2);
ctx.closePath();
ctx.clip();
ctx.drawImage(avatar, 40, 75, 200, 200);
ctx.restore();

// 파일 생성
const attachment = new AttachmentBuilder(canvas.toBuffer(), {
name: "welcome.png"
});

// 역할 선택 버튼
const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("mercenary")
.setLabel("⚔️ 용병")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("guest")
.setLabel("👤 손님")
.setStyle(ButtonStyle.Secondary)

);

channel.send({
content: `${member} 님 환영합니다!\n역할을 먼저 선택해주세요.`,
files: [attachment],
components: [row]
});

});

// 버튼 처리
client.on(Events.InteractionCreate, async interaction => {

if (!interaction.isButton()) return;

// 가입신청 채널 찾기
const applyChannel = interaction.guild.channels.cache.find(
c => c.name === "가입신청서"
);

if (interaction.customId === "mercenary") {

const role = interaction.guild.roles.cache.find(
r => r.name === "용병"
);

if (role) await interaction.member.roles.add(role);

await interaction.reply({
content: `⚔️ 용병 역할이 지급되었습니다!\n${applyChannel}`,
ephemeral: true
});

}

if (interaction.customId === "guest") {

const role = interaction.guild.roles.cache.find(
r => r.name === "손님"
);

if (role) await interaction.member.roles.add(role);

await interaction.reply({
content: `👤 손님 역할이 지급되었습니다!\n${applyChannel}`,
ephemeral: true
});

}

});

client.login(process.env.DISCORD_TOKEN);