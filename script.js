document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("startBtn");
  const overlay = document.getElementById("overlay");
  const landing = document.getElementById("landing");
  const opening = document.getElementById("opening");
  const openingVideo = document.getElementById("openingVideo");
  const music = document.getElementById("music");
  const canvas = document.getElementById("canvas");

  if (openingVideo) {
    openingVideo.pause();
    openingVideo.currentTime = 0;
  }

  if (btn && overlay && landing && opening && openingVideo) {
    btn.addEventListener("click", () => {
      overlay.classList.add("hide");

      if (music) {
        music.play().catch(() => {});
      }

      openingVideo.play().catch((error) => {
        console.log("Video play failed:", error);
      });

      setTimeout(() => {
        overlay.style.display = "none";
      }, 500);
    });

    openingVideo.addEventListener("ended", () => {
      landing.classList.add("active");
      document.body.style.overflowY = "auto";

      setTimeout(() => {
        opening.style.display = "none";
      }, 50);
    });
  }

  if (!landing || !canvas) return;

  function updateLandingBlur() {
    const canvasTop = canvas.offsetTop;
    const scrollY = window.scrollY;
    const windowH = window.innerHeight;

    const startFade = canvasTop - windowH;
    const endFade = canvasTop;

    let progress = (scrollY - startFade) / (endFade - startFade);
    progress = Math.max(0, Math.min(progress, 1));

    landing.style.opacity = 1 - progress * 0.6;
    landing.style.filter = `blur(${progress * 18}px) brightness(${1 - progress * 0.2})`;
    landing.style.transform = `translateY(-${progress * 40}px)`;
  }

  window.addEventListener("scroll", updateLandingBlur);
  updateLandingBlur();
});