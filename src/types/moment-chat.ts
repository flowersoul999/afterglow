import type {
	GuestbookChatMessage,
	GuestbookEmojiPack,
	GuestbookImageAttachment,
} from "./guestbook-chat";

export interface MomentQuote {
	id: string;
	published: string;
	excerpt: string;
}

export interface MomentChatMessage extends GuestbookChatMessage {
	momentQuote?: MomentQuote | null;
}

export type MomentEmojiPack = GuestbookEmojiPack;
export type MomentImageAttachment = GuestbookImageAttachment;
export type MomentMessageLocalState = GuestbookChatMessage["localState"];
