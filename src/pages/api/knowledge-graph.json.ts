import { siteConfig } from "@/config";
import { getKnowledgeGraphData } from "@/utils/content-utils";

/**
 * 四层知识图谱数据端点（构建期预渲染成静态 JSON）。
 *
 * 走独立端点而不是内联进 /categories/ 的 data-* 属性：完整图有几百个节点，
 * 内联要 HTML 实体转义，而 HTML 每次导航都要重新下载；独立 JSON 可以长缓存，
 * 跨导航直接命中 HTTP 缓存。
 *
 * 首帧不等这个请求：分类图例与时间轴范围由 KnowledgeGraph.astro 内联的极小
 * meta（约几百字节）服务端渲染，画布数据到了再补。
 */
export async function GET(): Promise<Response> {
	// 图谱页面关闭时，其专属数据端点同样不可访问
	if (!siteConfig.pages.categories) {
		return new Response("Not Found", { status: 404 });
	}

	const graph = await getKnowledgeGraphData();

	return new Response(JSON.stringify(graph), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
		},
	});
}
