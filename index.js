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

// 한글 폰트 등록
Canvas.registerFont("./assets/font.ttf", { family: "Noto" });

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

if (member.user.bot) return;

const channel = member.guild.channels.cache.find(
c => c.name === "어서오세요"
);

if (!channel) return;


// ===== Canvas 생성 =====
const canvas = Canvas.createCanvas(1200, 500);
const ctx = canvas.getContext("2d");


// ===== 배경 =====
const background = await Canvas.loadImage("./assets/background.png");
ctx.drawImage(background, 0, 0, canvas.width, canvas.height);


// ===== 프로필 =====
const avatar = await Canvas.loadImage(
member.user.displayAvatarURL({ extension: "png", size: 256 })
);

ctx.save();
ctx.beginPath();
ctx.arc(180, 250, 110, 0, Math.PI * 2);
ctx.closePath();
ctx.clip();
ctx.drawImage(avatar, 70, 140, 220, 220);
ctx.restore();


// ===== 프레임 =====
const frame = await Canvas.loadImage("./assets/frame.png");
ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);


// ===== 로고 =====
const logo = await Canvas.loadImage("./assets/logo.png");
ctx.drawImage(logo, 520, 20, 180, 90);


// ===== 텍스트 =====
ctx.fillStyle = "#ffffff";

ctx.font = "bold 48px Noto";
ctx.fillText(`${member.user.username}님 안녕하세요!`, 420, 200);

ctx.font = "32px Noto";
ctx.fillText("707 서버에 오신걸 환영합니다", 420, 250);

ctx.font = "26px Noto";

ctx.fillText(`ID : ${member.user.id}`, 420, 320);

ctx.fillText(
`Discord 가입 : ${member.user.createdAt.toLocaleDateString()}`,
420,
360
);

ctx.fillText(
`서버 가입 : ${new Date().toLocaleDateString()}`,
420,
400
);


// ===== 이미지 생성 =====
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


// ===== 메시지 전송 =====
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

if (interaction.user.id !== userId) {
return interaction.reply({
content: "❌ 이 버튼은 해당 사용자만 사용할 수 있습니다.",
ephemeral: true
});
}

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