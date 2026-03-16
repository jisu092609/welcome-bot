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

Canvas.registerFont("./assets/SUIT-Regular.ttf", { family: "SUIT" });
Canvas.registerFont("./assets/SUIT-Bold.ttf", { family: "SUITB" });

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


// 캔버스 생성
const canvas = Canvas.createCanvas(1600, 800);
const ctx = canvas.getContext("2d");


// 배경
const background = await Canvas.loadImage("./assets/background.png");
ctx.drawImage(background, 0, 0, canvas.width, canvas.height);


// 프레임
const frame = await Canvas.loadImage("./assets/frame.png");

const frameWidth = 1500;
const frameHeight = 650;

const frameX = (canvas.width - frameWidth) / 2;
const frameY = (canvas.height - frameHeight) / 2;

ctx.drawImage(frame, frameX, frameY, frameWidth, frameHeight);


// 로고
const logo = await Canvas.loadImage("./assets/logo.png");

ctx.drawImage(
logo,
canvas.width / 2 - 90,
frameY - 80,
180,
90
);


// 아바타
const avatar = await Canvas.loadImage(
member.user.displayAvatarURL({ extension: "png", size: 256 })
);

const avatarSize = 230;

const avatarX = frameX + 260;
const avatarY = frameY + frameHeight / 2;

ctx.save();
ctx.beginPath();
ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
ctx.closePath();
ctx.clip();
ctx.drawImage(
avatar,
avatarX - avatarSize / 2,
avatarY - avatarSize / 2,
avatarSize,
avatarSize
);
ctx.restore();


// 텍스트 그림자
ctx.shadowColor = "rgba(0,0,0,0.6)";
ctx.shadowBlur = 10;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = 3;


// 텍스트 위치
const textX = avatarX + 230;
const textY = avatarY - 100;


// 닉네임
ctx.fillStyle = "#ffffff";
ctx.font = "56px SUITB";
ctx.fillText(`${member.user.username}님 안녕하세요!`, textX, textY);


// 환영 문구
ctx.font = "36px SUIT";
ctx.fillText("707 서버에 오신걸 환영합니다", textX, textY + 70);


// 정보 텍스트
ctx.font = "28px SUIT";

ctx.fillText(
`ID : ${member.user.id}`,
textX,
textY + 150
);

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


// 파일 생성
const attachment = new AttachmentBuilder(canvas.toBuffer(), {
name: "welcome.png"
});


// 버튼
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