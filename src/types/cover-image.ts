/** `<picture>` 里优于回退格式的一个候选（如 avif） */
export type CoverImageFormatSource = {
	type: string;
	srcset: string;
};

/** 构建期算好的封面图渲染数据，由 buildCoverImage() 产出 */
export type CoverImageSource = {
	/** `<img src>`，多格式时为回退格式的地址 */
	src: string;
	/** `<img srcset>`；public 图与远程图无法在构建期切档，没有该值 */
	srcset?: string;
	sizes?: string;
	/** 为空则不需要 `<picture>` 包裹 */
	sources: CoverImageFormatSource[];
	/** 实际输出尺寸，可用于 aspect-ratio 占位 */
	width?: number;
	height?: number;
	/** 占位背景声明（本项目不使用 LQIP，恒为空） */
	lqipStyle?: string;
	referrerPolicy?: "no-referrer";
};
