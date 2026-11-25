/**
 * 顶部导航胶囊的灵动岛音乐面。
 *
 * Navbar 挂在 Swup 容器外，DOM 跨导航持久存在，所以这里用 window guard 防重复绑定，
 * 并用 AbortController 统一清理。视觉参考 my-blog 的 DynamicIsland 收起态：
 * 页面面 / 音乐面 3D 翻转，歌名跑马灯，波形柱兼播放暂停按钮。
 */

interface DiTrack {
  name?: string;
  artist?: string;
  pic?: string;
}

interface DiWindow extends Window {
  __navbarDynamicIslandReady?: boolean;
}

export function initNavbarDynamicIsland(): void {
  const w = window as DiWindow;
  if (w.__navbarDynamicIslandReady) return;
  w.__navbarDynamicIslandReady = true;

  const navbarEl = document.getElementById("navbar");
  const island = document.querySelector<HTMLElement>("[data-navbar-di]");
  const toggleEl = document.getElementById("nav-di-toggle");
  if (!navbarEl || !island || !toggleEl) return;
  const navbar: HTMLElement = navbarEl;
  const toggle: HTMLElement = toggleEl;

  const lyricEl = island.querySelector<HTMLElement>("[data-di-lyric-inner]");
  const coverEl = island.querySelector<HTMLImageElement>("[data-di-cover]");
  const playBtn = island.querySelector<HTMLButtonElement>("[data-di-play]");
  const template = island.dataset.nowPlaying || "正在播放 {name}";
  const ac = new AbortController();

  function setFace(face: "page" | "music"): void {
    navbar.dataset.diFace = face;
    toggle.setAttribute("aria-pressed", String(face === "music"));
  }

  function renderTrack(track: DiTrack | null): void {
    const name = track?.name ?? "";
    if (lyricEl) {
      lyricEl.textContent = name ? template.replace("{name}", name) : "";
      // 歌名越长跑马灯越慢，给后半段留够露出时间（6–16s）
      const duration = Math.min(16, 6 + Math.max(0, name.length - 10) * 0.8);
      lyricEl.style.setProperty("--di-marquee-duration", `${duration}s`);
    }
    if (coverEl) {
      if (track?.pic) {
        coverEl.src = track.pic;
        coverEl.classList.remove("is-empty");
      } else {
        coverEl.removeAttribute("src");
        coverEl.classList.add("is-empty");
      }
    }
  }

  toggle.addEventListener(
    "click",
    () => setFace(navbar.dataset.diFace === "music" ? "page" : "music"),
    { signal: ac.signal },
  );

  playBtn?.addEventListener(
    "click",
    () => window.__fireflyMusic?.togglePlay(),
    { signal: ac.signal },
  );

  window.addEventListener(
    "fm:track",
    (event) => {
      const detail = (event as CustomEvent<{ track?: DiTrack }>).detail;
      renderTrack(detail?.track ?? null);
      setFace("music");
    },
    { signal: ac.signal },
  );

  window.addEventListener(
    "fm:play-state",
    (event) => {
      const playing = (event as CustomEvent<{ isPlaying?: boolean }>).detail?.isPlaying;
      island.dataset.playing = String(Boolean(playing));
      playBtn?.setAttribute("aria-label", playing ? "暂停" : "播放");
    },
    { signal: ac.signal },
  );

  // 引擎可能先于组件初始化完成，首帧补一次
  const state = window.__fireflyMusic?.getState?.();
  if (state?.track) renderTrack(state.track as DiTrack);
}
