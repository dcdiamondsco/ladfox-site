document.querySelectorAll("[data-metal-select]").forEach((metal) => {
  const karatId = metal.getAttribute("data-karat-target");
  if (!karatId) return;

  const karat = document.getElementById(karatId);
  if (!karat) return;

  const syncKarat = () => {
    const isPlatinum = metal.value === "Platinum";
    karat.disabled = isPlatinum || !metal.value;
    karat.required = !isPlatinum && !!metal.value;
    if (isPlatinum) {
      karat.value = "";
    }
  };

  metal.addEventListener("change", syncKarat);
  syncKarat();
});

document.querySelectorAll("[data-product-config]").forEach((config) => {
  const formId = config.getAttribute("data-config-form");
  const form = formId ? document.getElementById(formId) : config.closest(".copy")?.querySelector("form");
  const summary = config.querySelector("[data-config-summary]");

  const syncConfig = () => {
    const values = {};

    config.querySelectorAll("[data-config-input]").forEach((field) => {
      const key = field.getAttribute("data-config-input");
      if (!key) return;
      values[key] = field.value || "";

      if (form) {
        const hidden = form.querySelector(`[data-config-hidden="${key}"]`);
        if (hidden) {
          hidden.value = values[key];
        }
      }
    });

    if (summary) {
      const pieces = [
        values.metal,
        values.ring_size && `size ${values.ring_size}`,
        values.diamond_type,
        values.shape,
        values.total_carat && `${values.total_carat} ct`,
        values.clarity,
        values.colour,
        values.cut_grade,
        values.certificate
      ].filter(Boolean);

      summary.textContent = pieces.length
        ? pieces.join(" / ")
        : "Select the ring options you already know and leave the rest for us to guide.";
    }
  };

  config.querySelectorAll("[data-config-input]").forEach((field) => {
    field.addEventListener("change", syncConfig);
  });

  syncConfig();
});
