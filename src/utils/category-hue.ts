/**
 * 分类名 → 色相（0-359）
 *
 * 用 FNV-1a 哈希把分类名映射到固定色相，同名分类在任何页面都是同一个颜色。
 * 归档树、文章卡片、置顶卡片共用这一份实现，颜色才不会各算各的。
 */
export function getCategoryHue(category: string): number {
	let hash = 2166136261;
	for (let index = 0; index < category.length; index++) {
		hash ^= category.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) % 360;
}
