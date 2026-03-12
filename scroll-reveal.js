(() => {
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (reducedMotionQuery.matches) {
    return;
  }

  const selectors = [
    "header > *",
    "main > *",
    "main section",
    "main article",
    "main .panel",
    "main .card",
    "main .copy",
    "main .media",
    "main .layout",
    "main .spec-card",
    "main .size-panel",
    "main .similar-cta",
    "main .faq",
    "main .faq-list details",
    "footer > *"
  ];

  const targets = Array.from(
    new Set(
      selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    )
  ).filter((element) => !element.closest("#quickMessagePanel"));

  if (!targets.length) {
    return;
  }

  targets.forEach((element) => {
    element.classList.add("scroll-blackout");
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  targets.forEach((element) => {
    observer.observe(element);
  });
})();
