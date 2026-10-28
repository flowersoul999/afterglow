import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { LinkPreset, type NavBarLink } from "@/types/config";

export const LinkPresets: { [key in LinkPreset]: NavBarLink } = {
	[LinkPreset.Home]: {
		name: i18n(I18nKey.home),
		url: "/",
		icon: "material-symbols:home",
	},
	[LinkPreset.About]: {
		name: i18n(I18nKey.about),
		url: "/about/",
		icon: "material-symbols:person",
	},
	[LinkPreset.Archive]: {
		name: i18n(I18nKey.archive),
		url: "/archive/",
		icon: "material-symbols:archive",
	},
	[LinkPreset.Friends]: {
		name: i18n(I18nKey.friends),
		url: "/friends/",
		icon: "material-symbols:group",
	},
	[LinkPreset.Sponsor]: {
		name: i18n(I18nKey.sponsor),
		url: "/sponsor/",
		icon: "material-symbols:favorite",
	},
	[LinkPreset.Guestbook]: {
		name: i18n(I18nKey.guestbook),
		url: "/guestbook/",
		icon: "material-symbols:chat",
	},
	[LinkPreset.Bangumi]: {
		name: i18n(I18nKey.bangumi),
		url: "/bangumi/",
		icon: "material-symbols:camera-outdoor",
	},
	[LinkPreset.Books]: {
		name: i18n(I18nKey.books),
		url: "/books/",
		icon: "material-symbols:book-5",
	},
	[LinkPreset.MoviesGames]: {
		name: i18n(I18nKey.moviesGames),
		url: "/movies-games/",
		icon: "material-symbols:movie",
	},
	[LinkPreset.MusicPage]: {
		name: i18n(I18nKey.musicPage),
		url: "/music/",
		icon: "material-symbols:music-note",
	},
	[LinkPreset.Changelog]: {
		name: i18n(I18nKey.changelog),
		url: "/changelog/",
		icon: "material-symbols:history",
	},
	[LinkPreset.Posts]: {
		name: i18n(I18nKey.postList),
		url: "/posts/",
		icon: "material-symbols:article-outline",
	},
	[LinkPreset.Circle]: {
		name: i18n(I18nKey.circle),
		url: "/circle/",
		icon: "material-symbols:public",
	},
};
