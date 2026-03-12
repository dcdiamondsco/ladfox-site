document.querySelectorAll("[data-product-page]").forEach((page) => {
  const sizeSelect = page.querySelector("[data-ring-size]");
  const enquireLink = page.querySelector("[data-enquire-link]");
  const customLink = page.querySelector("[data-custom-link]");
  const heroImage = page.querySelector("[data-product-image]");
  const frontImage = heroImage?.getAttribute("data-image-front") || heroImage?.getAttribute("src") || "";
  const backImage = heroImage?.getAttribute("data-image-back") || "";
  const productName = page.getAttribute("data-product-name") || "";
  const productSlug = page.getAttribute("data-product-slug") || "";
  let visitorLocation = "Unknown";

  const updateLinks = () => {
    const size = sizeSelect?.value || "";
    const params = new URLSearchParams();

    if (productSlug) params.set("ring", productSlug);
    if (productName) params.set("product", productName);
    if (size) params.set("size", size);

    if (enquireLink) {
      enquireLink.href = `ring-form.html?${params.toString()}`;
    }

    if (customLink) {
      const customParams = new URLSearchParams();
      if (productSlug) customParams.set("reference", productSlug);
      customLink.href = `ring-form.html?${customParams.toString()}`;
    }
  };

  const sendBuyIntent = () => {
    if (!enquireLink) return;

    const payload = new URLSearchParams();
    payload.set("form-name", "product-buy-intent");
    payload.set("product_name", productName);
    payload.set("product_slug", productSlug);
    payload.set("selected_ring_size", sizeSelect?.value || "");
    payload.set("location", visitorLocation);
    payload.set("destination", enquireLink.href);

    if (navigator.sendBeacon) {
      const blob = new Blob([payload.toString()], {
        type: "application/x-www-form-urlencoded;charset=UTF-8"
      });
      navigator.sendBeacon("/", blob);
      return;
    }

    fetch("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: payload.toString(),
      keepalive: true
    }).catch(() => {});
  };

  if (sizeSelect) {
    sizeSelect.addEventListener("change", updateLinks);
  }

  if (enquireLink) {
    enquireLink.addEventListener("click", () => {
      sendBuyIntent();
    });
  }

  if (heroImage && backImage) {
    heroImage.addEventListener("mouseenter", () => {
      heroImage.src = backImage;
    });

    heroImage.addEventListener("mouseleave", () => {
      heroImage.src = frontImage;
    });
  }

  fetch("https://ipapi.co/json/")
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((data) => {
      const location = [data.city, data.region, data.country_name].filter(Boolean).join(", ");
      visitorLocation = location || "Unknown";
    })
    .catch(() => {});

  updateLinks();
});
