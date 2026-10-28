export const SEARCH_MODAL_TOGGLE_EVENT = "firefly:search-modal-toggle";

type SearchModalController = {
	toggle: () => void;
};

type SearchModalWindow = Window & {
	__fireflySearchModalController?: SearchModalController;
	__fireflySearchModalPendingToggle?: boolean;
	__fireflySearchModalUnbind?: () => void;
};

function getWindow(windowRef?: Window): SearchModalWindow | null {
	if (windowRef) return windowRef as SearchModalWindow;
	if (typeof window !== "undefined") return window as SearchModalWindow;
	return null;
}

export function requestSearchModalToggle(windowRef?: Window): void {
	const targetWindow = getWindow(windowRef);
	if (!targetWindow) return;

	const controller = targetWindow.__fireflySearchModalController;
	if (controller) {
		controller.toggle();
		return;
	}

	targetWindow.__fireflySearchModalPendingToggle = true;
}

export function bindSearchModalController(
	windowRef: Window,
	controller: SearchModalController,
): () => void {
	const targetWindow = getWindow(windowRef);
	if (!targetWindow) return () => {};

	targetWindow.__fireflySearchModalUnbind?.();
	targetWindow.__fireflySearchModalController = controller;

	if (targetWindow.__fireflySearchModalPendingToggle) {
		targetWindow.__fireflySearchModalPendingToggle = false;
		queueMicrotask(() => {
			if (targetWindow.__fireflySearchModalController === controller) {
				controller.toggle();
			}
		});
	}

	function unbind() {
		if (
			targetWindow &&
			targetWindow.__fireflySearchModalController === controller
		) {
			delete targetWindow.__fireflySearchModalController;
		}
		if (targetWindow && targetWindow.__fireflySearchModalUnbind === unbind) {
			delete targetWindow.__fireflySearchModalUnbind;
		}
	}

	targetWindow.__fireflySearchModalUnbind = unbind;
	return unbind;
}
