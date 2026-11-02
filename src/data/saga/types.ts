/**
 * 话本素材的原始形状（还没编号、还没分发）。
 *
 * 单独抽一个文件，是因为卷二、卷三要复用同一套类型——
 * 让卷二去 import 卷一的类型，读起来像是「第二卷依赖第一卷」，不合适。
 */

/** 一回的原始素材 */
export interface RawChapter {
	title: string;
	paragraphs: string[];
}

/** 一卷 */
export interface RawVolume {
	name: string;
	chapters: RawChapter[];
}
