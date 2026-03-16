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


// 캔버스
const canvas = Canvas.createCanvas(1600, 800);
const ctx = canvas.getContext("2d");


// 배경
const background = await Canvas.loadImage("./assets/background.png");
ctx.drawImage(background, 0, 0, canvas.width, canvas.height);


// 프레임 위치
const frame = await Canvas.loadImage("./assets/frame.png");

const frameWidth = 1500;
const frameHeight = 650;

const frameX = (canvas.width - frameWidth) / 2;
const frameY = (canvas.height - frameHeight) / 2 + 40;

ctx.drawImage(frame, frameX, frameY, frameWidth, frameHeight);


// 로고
const logo = await Canvas.loadImage("./assets/logo.png");

ctx.drawImage(
logo,
canvas.width / 2 - 150,
frameY - 110,
260,
130
);


// 아바타
const avatar = await Canvas.loadImage(
member.user.displayAvatarURL({ extension: "png", size: 256 })
);

const avatarSize = 230;

const avatarX = frameX + 340;
const avatarY = frameY + frameHeight / 2;


// 네온 테두리
ctx.beginPath();
ctx.arc(avatarX, avatarY, avatarSize/2 + 8, 0, Math.PI * 2);
ctx.strokeStyle = "#9c6cff";
ctx.lineWidth = 6;
ctx.shadowColor = "#9c6cff";
ctx.shadowBlur = 20;
ctx.stroke();


// 아바타
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


// 텍스트 그림자
ctx.shadowColor = "rgba(0,0,0,0.9)";
ctx.shadowBlur = 18;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = 3;


// 텍스트 위치
const textX = avatarX + 250;
const textY = avatarY - 100;


// 닉네임
ctx.font = "56px SUITB";
ctx.fillStyle = "#ffffff";
ctx.strokeStyle = "rgba(0,0,0,0.6)";
ctx.lineWidth = 2;

ctx.strokeText(`${member.user.username}님 안녕하세요!`, textX, textY);
ctx.fillText(`${member.user.username}님 안녕하세요!`, textX, textY);


// 환영 문구
ctx.font = "40px SUITB";

ctx.strokeText("707 서버에 오신걸 환영합니다", textX, textY + 70);
ctx.fillText("707 서버에 오신걸 환영합니다", textX, textY + 70);


// 정보 텍스트
ctx.font = "30px SUITB";
ctx.fillStyle = "#f5f5ff";

ctx.strokeText(`ID : ${member.user.id}`, textX, textY + 150);
ctx.fillText(`ID : ${member.user.id}`, textX, textY + 150);

ctx.strokeText(
`Discord 가입 : ${member.user.createdAt.toLocaleDateString()}`,
textX,
textY + 190
);

ctx.fillText(
`Discord 가입 : ${member.user.createdAt.toLocaleDateString()}`,
textX,
textY + 190
);

ctx.strokeText(
`서버 가입 : ${new Date().toLocaleDateString()}`,
textX,
textY + 230
);

ctx.fillText(
`서버 가입 : ${new Date().toLocaleDateString()}`,
textX,
textY + 230
);


// 카드 이미지 생성
const attachment = new AttachmentBuilder(canvas.toBuffer(), {
name: "welcome.png"
});


// 버튼
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
.setLabel("⏳ 가입대기자")
.setStyle(ButtonStyle.Success)

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

const [roleType, userId] = interaction.customId.split("_");


// 새 유저만 클릭 가능
if (interaction.user.id !== userId) {
return interaction.reply({
content: "❌ 이 버튼은 새로 들어온 사용자만 사용할 수 있습니다.",
ephemeral: true
});
}


// 역할 이름
let roleName = "";

if (roleType === "mercenary") roleName = "용병";
if (roleType === "guest") roleName = "손님";
if (roleType === "waiting") roleName = "가입대기자";


const role = interaction.guild.roles.cache.find(r => r.name === roleName);

if (!role) {
return interaction.reply({
content: "❌ 역할을 찾을 수 없습니다.",
ephemeral: true
});
}


// 이미 역할 선택 확인
const rolesToCheck = ["용병","손님","가입대기자"];

for (const r of rolesToCheck) {

const checkRole = interaction.guild.roles.cache.find(x => x.name === r);

if (checkRole && interaction.member.roles.cache.has(checkRole.id)) {

return interaction.reply({
content: "⚠️ 이미 역할을 선택했습니다.",
ephemeral: true
});

}

}


// 역할 지급
await interaction.member.roles.add(role);


// 버튼 비활성화
const disabledRow = new ActionRowBuilder().addComponents(
interaction.message.components[0].components.map(button =>
ButtonBuilder.from(button).setDisabled(true)
)
);

await interaction.update({
components: [disabledRow]
});


// 신청서 채널
const applyChannel = interaction.guild.channels.cache.find(
c => c.name === "가입신청서"
);


// 가입대기자 안내
if (roleType === "waiting" && applyChannel) {

await interaction.followUp({
content: `📋 가입 신청은 여기에서 진행해주세요 → ${applyChannel}`,
ephemeral: true
});

}

});

client.login(process.env.DISCORD_TOKEN);