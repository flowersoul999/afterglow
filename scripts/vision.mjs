// 视觉识别脚本：调用 OpenCode Go 的 qwen3.6-plus 视觉模型识别图片
// 用法：
//   node scripts/vision.mjs [图片路径或URL] [问题]
// 示例：
//   node scripts/vision.mjs screenshot.png "这张截图里有什么错误信息？"
//   node scripts/vision.mjs "https://example.com/a.jpg" "描述这张图片"
//   node scripts/vision.mjs "描述这张图片"          // 自动找最新图片
// 配置：环境变量 OPENCODE_API_KEY（OpenCode Go 的 API Key）
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, dirname } from "node:path";
import { homedir } from "node:os";

// 自动从项目 .env 读取配置（如果环境变量没设置）
function loadEnv() {
	const envPath = join(process.cwd(), ".env");
	if (!existsSync(envPath)) return;
	for (const line of readFileSync(envPath, "utf8").split("\n")) {
		const m = line.match(/^([A-Z_]+)=(.*)$/);
		if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
	}
}
loadEnv();

const API_KEY = process.env.OPENCODE_API_KEY;
const BASE_URL = "https://opencode.ai/zen/go/v1";
// 视觉模型：qwen3.6-plus 在 OpenCode Go 上支持图片识别（实测验证）
// GLM-5.2 / MiMo / Hy3 / DeepSeek 在 Go 上是文本版，不支持图片
// 可用 OPENCODE_MODEL 环境变量覆盖（.env 里配置）
const MODEL = process.env.OPENCODE_MODEL || "qwen3.6-plus";

const args = process.argv.slice(2);

// 自动找最新图片：从 Claude Code 的 image-cache 目录找最近接收的图片
function findLatestImage() {
	const cacheDirs = [
		join(homedir(), ".claude", "image-cache"),
		join(process.cwd(), ".claude", "image-cache"),
	];
	const IMG_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
	const candidates = [];
	for (const dir of cacheDirs) {
		if (!existsSync(dir)) continue;
		for (const sub of readdirSync(dir)) {
			const p = join(dir, sub);
			if (statSync(p).isDirectory()) {
				for (const f of readdirSync(p)) {
					if (IMG_EXT.includes(extname(f).toLowerCase())) {
						candidates.push({ path: join(p, f), mtime: statSync(join(p, f)).mtimeMs });
					}
				}
			}
		}
	}
	candidates.sort((a, b) => b.mtime - a.mtime);
	return candidates[0]?.path;
}

let imageInput = args[0];
let question = args[1];

// 第一个参数不是图片（是问题），自动找图
if (imageInput && !existsSync(imageInput) && !/^https?:\/\//.test(imageInput) && !imageInput.includes(".")) {
	question = imageInput;
	imageInput = findLatestImage();
}
if (!imageInput) {
	imageInput = findLatestImage();
	if (!imageInput) {
		console.error("✗ 找不到图片。用法：node scripts/vision.mjs <图片路径或URL> [问题]");
		process.exit(1);
	}
	console.log(`（自动找到最近图片：${imageInput}）`);
}
question = question || "请识别这张图片的内容，并尽可能详细地描述。";
if (!API_KEY) {
	console.error("✗ 缺少 OPENCODE_API_KEY 环境变量（在 .env 里配置）");
	process.exit(1);
}

// 图片转 data URL（本地文件 → base64；URL → 直接传）
async function buildImageContent(input) {
	if (/^https?:\/\//.test(input)) {
		return { type: "image_url", image_url: { url: input } };
	}
	const ext = extname(input).toLowerCase().replace(".", "");
	const mime =
		ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
		ext === "png" ? "image/png" :
		ext === "webp" ? "image/webp" :
		ext === "gif" ? "image/gif" :
		"image/png";
	const b64 = readFileSync(input).toString("base64");
	return { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } };
}

const imageContent = await buildImageContent(imageInput);

const res = await fetch(`${BASE_URL}/chat/completions`, {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		Authorization: `Bearer ${API_KEY}`,
	},
	body: JSON.stringify({
		model: MODEL,
		max_tokens: 2048,
		messages: [
			{
				role: "user",
				content: [
					{ type: "text", text: question },
					imageContent,
				],
			},
		],
	}),
});

if (!res.ok) {
	const errText = await res.text();
	console.error(`✗ API 请求失败（HTTP ${res.status}）`);
	console.error(errText.slice(0, 500));
	process.exit(1);
}

const data = await res.json();
const answer = data.choices?.[0]?.message?.content || "（无输出）";
console.log(`\n📷 图片：${basename(imageInput)}`);
console.log(`❓ 问题：${question}\n`);
console.log(answer);
