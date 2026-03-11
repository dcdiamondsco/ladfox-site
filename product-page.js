document.querySelectorAll("[data-product-config]").forEach((config) => {
  const formId = config.getAttribute("data-config-form");
  const form = formId ? document.getElementById(formId) : config.closest(".copy")?.querySelector("form");
  const summary = config.querySelector("[data-config-summary]");
  const metalTarget = form?.querySelector('[data-config-hidden="metal"]');
  const metalOptions = config.querySelectorAll('[data-config-input="metal_base"]');
  const karatOptions = config.querySelectorAll('[data-config-input="metal_karat"]');
  const karatGroup = config.querySelector("[data-metal-karat-group]");
  const rangeFields = config.querySelectorAll("[data-config-range]");

  const getRangeValues = (field) => (field.dataset.configValues || "").split("|");
  const getRangeLabels = (field) => (field.dataset.configLabels || "").split("|");
  const getFieldValue = (field) => {
    if (field.hasAttribute("data-config-range")) {
      const values = getRangeValues(field);
      return values[Number(field.value)] || "";
    }

    return field.value || "";
  };
  const syncRangeField = (field) => {
    const labels = getRangeLabels(field);
    const values = getRangeValues(field);
    const index = Number(field.value) || 0;
    const outputId = field.dataset.rangeOutput;
    const output = outputId ? document.getElementById(outputId) : null;
    const label = labels[index] || values[index] || field.dataset.emptyLabel || "";

    if (output) {
      output.textContent = label;
    }
  };

  const syncMetalOptions = () => {
    if (!metalOptions.length || !karatOptions.length || !karatGroup) return;

    const selectedMetal = config.querySelector('[data-config-input="metal_base"]:checked')?.value || "";
    const requiresKarat = selectedMetal && selectedMetal !== "Platinum";

    karatGroup.hidden = !requiresKarat;

    karatOptions.forEach((option, index) => {
      option.disabled = !requiresKarat;
      if (!requiresKarat) {
        option.checked = false;
        return;
      }

      if (!config.querySelector('[data-config-input="metal_karat"]:checked') && index === 0) {
        option.checked = true;
      }
    });
  };

  const syncConfig = () => {
    const values = {};
    const selectedMetal = config.querySelector('[data-config-input="metal_base"]:checked')?.value || "";
    const selectedKarat = config.querySelector('[data-config-input="metal_karat"]:checked')?.value || "";

    values.metal = selectedMetal === "Platinum"
      ? "Platinum"
      : [selectedKarat, selectedMetal].filter(Boolean).join(" ");

    config.querySelectorAll("[data-config-input]").forEach((field) => {
      const key = field.getAttribute("data-config-input");
      if (!key) return;
      if ((field.type === "radio" || field.type === "checkbox") && !field.checked) return;
      values[key] = getFieldValue(field);

      if (form) {
        const hidden = form.querySelector(`[data-config-hidden="${key}"]`);
        if (hidden) {
          hidden.value = values[key];
        }
      }
    });

    if (metalTarget) {
      metalTarget.value = values.metal;
    }

    if (summary) {
      const pieces = [
        values.metal,
        values.ring_size && `size ${values.ring_size}`,
        values.diamond_type,
        values.shape,
        values.total_carat && `${values.total_carat} ct`,
        values.clarity,
        values.colour,
        values.cut_grade
      ].filter(Boolean);

      summary.textContent = pieces.length
        ? pieces.join(" / ")
        : "Select the ring options you already know and leave the rest for us to refine.";
    }
  };

  metalOptions.forEach((field) => {
    field.addEventListener("change", () => {
      syncMetalOptions();
      syncConfig();
    });
  });

  karatOptions.forEach((field) => {
    field.addEventListener("change", syncConfig);
  });

  rangeFields.forEach((field) => {
    const handler = () => {
      syncRangeField(field);
      syncConfig();
    };

    field.addEventListener("input", handler);
    field.addEventListener("change", handler);
    syncRangeField(field);
  });

  config.querySelectorAll("[data-config-input]").forEach((field) => {
    if (field.getAttribute("data-config-input") === "metal_base" || field.getAttribute("data-config-input") === "metal_karat") {
      return;
    }
    if (field.hasAttribute("data-config-range")) {
      return;
    }
    field.addEventListener("change", syncConfig);
  });

  syncMetalOptions();
  syncConfig();
});
