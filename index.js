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

// 봇 입장 시 무시
if (member.user.bot) return;

const channel = member.guild.channels.cache.find(
c => c.name === "어서오세요"
);

if (!channel) return;


// ===== Canvas 카드 생성 =====

const canvas = Canvas.createCanvas(900, 350);
const ctx = canvas.getContext("2d");


// 배경 그라데이션
const gradient = ctx.createLinearGradient(0, 0, 900, 350);
gradient.addColorStop(0, "#5865F2");
gradient.addColorStop(1, "#23272A");

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, canvas.width, canvas.height);


// 카드 박스
ctx.fillStyle = "rgba(0,0,0,0.45)";
ctx.fillRect(40, 40, 820, 270);


// 제목
ctx.font = "bold 36px sans-serif";
ctx.fillStyle = "#ffffff";
ctx.fillText(`${member.user.username}님 안녕하세요!`, 260, 90);


// 서브 제목
ctx.font = "26px sans-serif";
ctx.fillStyle = "#dddddd";
ctx.fillText("707 서버에 오신걸 환영합니다", 260, 130);


// 정보 박스
ctx.fillStyle = "rgba(0,0,0,0.55)";
ctx.fillRect(260, 160, 500, 110);


// 정보 텍스트
ctx.font = "22px sans-serif";
ctx.fillStyle = "#ffffff";

ctx.fillText(`ID : ${member.user.id}`, 280, 200);

ctx.fillText(
`Discord 가입 : ${member.user.createdAt.toLocaleDateString()}`,
280,
230
);

ctx.fillText(
`서버 가입 : ${new Date().toLocaleDateString()}`,
280,
260
);


// 프로필 이미지
const avatar = await Canvas.loadImage(
member.user.displayAvatarURL({ extension: "png", size: 256 })
);


// 프로필 테두리
ctx.beginPath();
ctx.arc(140, 175, 105, 0, Math.PI * 2);
ctx.fillStyle = "#ffffff";
ctx.fill();


// 프로필 사진
ctx.save();
ctx.beginPath();
ctx.arc(140, 175, 100, 0, Math.PI * 2);
ctx.closePath();
ctx.clip();
ctx.drawImage(avatar, 40, 75, 200, 200);
ctx.restore();


// 이미지 파일 생성
const attachment = new AttachmentBuilder(canvas.toBuffer(), {
name: "welcome.png"
});


// ===== 역할 버튼 =====

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId(`mercenary_${member.id}`)
.setLabel("⚔️ 용병")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId(`guest_${member.id}`)
.setLabel("👤 손님")
.setStyle(ButtonStyle.Secondary)

);


// 메시지 전송
channel.send({
content: `${member} 님 환영합니다!\n역할을 먼저 선택해주세요.`,
files: [attachment],
components: [row]
});

});


// ===== 버튼 처리 =====

client.on(Events.InteractionCreate, async interaction => {

if (!interaction.isButton()) return;

const [type, userId] = interaction.customId.split("_");

// 다른 사람이 누르면 차단
if (interaction.user.id !== userId) {
return interaction.reply({
content: "❌ 이 버튼은 해당 사용자만 사용할 수 있습니다.",
ephemeral: true
});
}


// 가입신청 채널 찾기
const applyChannel = interaction.guild.channels.cache.find(
c => c.name === "가입신청서"
);


// 용병
if (type === "mercenary") {

const role = interaction.guild.roles.cache.find(
r => r.name === "용병"
);

if (role) await interaction.member.roles.add(role);

await interaction.reply({
content: `⚔️ 용병 역할이 지급되었습니다!\n${applyChannel}`,
ephemeral: true
});

}


// 손님
if (type === "guest") {

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