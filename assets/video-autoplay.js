(() => {
  const videos = () => Array.from(document.querySelectorAll("video"));

  const prepare = (video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("loop", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.removeAttribute("controls");
  };

  const play = (video) => {
    prepare(video);
    const attempt = video.play();
    if (attempt && typeof attempt.catch === "function") attempt.catch(() => {});
  };

  const playAll = () => videos().forEach(play);

  const initialise = () => {
    videos().forEach((video) => {
      prepare(video);
      video.addEventListener("loadeddata", () => play(video), { passive: true });
      video.addEventListener("canplay", () => play(video), { passive: true });
    });
    playAll();
    window.requestAnimationFrame(playAll);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }

  window.addEventListener("pageshow", playAll);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) playAll();
  });

  const retryAfterInteraction = () => playAll();
  document.addEventListener("pointerdown", retryAfterInteraction, { once: true, passive: true });
  document.addEventListener("touchstart", retryAfterInteraction, { once: true, passive: true });
  document.addEventListener("keydown", retryAfterInteraction, { once: true });
})();
