document.querySelectorAll("[data-ring-config-page]").forEach((page) => {
  const productSlug = page.getAttribute("data-product-slug") || "";
  const productName = page.getAttribute("data-product-name") || "";
  const ctaLink = page.querySelector("[data-config-link]");
  const summary = page.querySelector("[data-selection-summary]");
  const priceOutput = page.querySelector("[data-price-output]");
  const priceSummary = page.querySelector(".selection-summary");
  const colourTypeField = page.querySelector("#customRingColourType");
  const gemstoneOptions = page.querySelector("[data-gemstone-options]");
  const fields = Array.from(page.querySelectorAll("[data-config-param]"));
  const sliders = Array.from(page.querySelectorAll("[data-option-slider]"));
  const sizeRanges = Array.from(page.querySelectorAll("[data-size-range]"));
  const discreteRanges = Array.from(page.querySelectorAll("[data-discrete-range]"));

  const formatCaratValue = (value) => {
    const numeric = Number.parseFloat(value);
    if (!Number.isFinite(numeric)) return "";
    if (numeric >= 8) return "8.0 ct+";
    return `${numeric.toFixed(1)} ct`;
  };

  const formatPrice = (value) => `£${Math.round(value).toLocaleString("en-GB")}`;

  const calculateLabDiamondPrice = (caratValue) => {
    const size = Number.parseFloat(caratValue);
    if (!Number.isFinite(size) || size <= 0.3) return 1499;
    if (size <= 0.5) return 1799;
    if (size <= 0.7) return 2199;
    if (size <= 1.0) return 2799;
    if (size <= 1.5) return 3799;
    if (size <= 2.0) return 4999;
    if (size <= 2.5) return 6499;
    if (size <= 3.0) return 8299;
    if (size <= 4.0) return 10999;
    if (size <= 5.0) return 14499;
    if (size <= 6.0) return 18499;
    if (size <= 7.0) return 22999;
    return 27499;
  };

  const readSelections = () => {
    return fields.reduce((acc, field) => {
      const key = field.getAttribute("data-config-param");
      if (!key) return acc;
      acc[key] = field.value || "";
      return acc;
    }, {});
  };

  const updateSummary = () => {
    if (!summary) return;
    const selections = readSelections();
    summary.innerHTML = [
      `<strong>Metal:</strong> ${selections.metal || "Select an option"}`,
      `<strong>Stone shape:</strong> ${selections.shape || "Select an option"}`,
      `<strong>Stone size:</strong> ${selections.stone_size || "Select an option"}`,
      `<strong>Colour:</strong> ${selections.colour || "Select an option"}`,
      `<strong>Clarity:</strong> ${selections.clarity || "Select an option"}`
    ].join("<br>");
  };

  const updateLink = () => {
    if (!ctaLink) return;
    const selections = readSelections();
    const params = new URLSearchParams();

    if (productSlug) params.set("reference", productSlug);
    if (productName) params.set("product", productName);
    if (selections.metal) params.set("metal", selections.metal);
    if (selections.shape) params.set("shape", selections.shape);
    if (selections.stone_size) {
      params.set("stone_size", selections.stone_size);
      params.set("size", selections.stone_size);
    }
    if (selections.colour) params.set("colour", selections.colour);
    if (selections.clarity) params.set("clarity", selections.clarity);

    ctaLink.href = `ring-form.html?${params.toString()}`;
  };

  const syncSliderState = () => {
    sliders.forEach((slider) => {
      const targetId = slider.getAttribute("data-option-slider");
      if (!targetId) return;
      const input = page.querySelector(`#${targetId}`);
      if (!input) return;
      slider.querySelectorAll("[data-option-value]").forEach((option) => {
        option.classList.toggle("is-active", option.getAttribute("data-option-value") === input.value);
      });
    });
  };

  const syncSizeRanges = () => {
    sizeRanges.forEach((range) => {
      const targetId = range.getAttribute("data-size-range");
      if (!targetId) return;
      const input = page.querySelector(`#${targetId}`);
      if (!input) return;
      const formattedValue = formatCaratValue(range.value);
      input.value = formattedValue;

      const output = page.querySelector(`[data-size-output="${targetId}"]`);
      if (output) {
        output.textContent = formattedValue || "0.3 ct";
      }
    });
  };

  const syncDiscreteRanges = () => {
    discreteRanges.forEach((range) => {
      const targetId = range.getAttribute("data-discrete-range");
      const values = (range.getAttribute("data-range-values") || "").split("|").filter(Boolean);
      if (!targetId || !values.length) return;
      const input = page.querySelector(`#${targetId}`);
      if (!input) return;
      const index = Math.max(0, Math.min(values.length - 1, Number.parseInt(range.value, 10) || 0));
      const selectedValue = values[index] || "";
      input.value = selectedValue;

      const output = page.querySelector(`[data-discrete-output="${targetId}"]`);
      if (output) {
        output.textContent = selectedValue;
      }
    });
  };

  const syncColourMode = () => {
    if (!colourTypeField || !gemstoneOptions) return;
    const colourField = page.querySelector("#customRingColour");
    const mode = colourTypeField.value || "Lab diamond";
    const isGemstone = mode === "Lab gemstone";

    gemstoneOptions.hidden = !isGemstone;

    if (!colourField) return;
    if (!isGemstone) {
      colourField.value = "Lab diamond";
    } else if (!colourField.value || colourField.value === "Lab diamond") {
      colourField.value = "Ruby";
    }
  };

  const updatePrice = () => {
    if (!priceOutput && !priceSummary) return;
    const sizeRange = page.querySelector("[data-size-range]");
    const price = calculateLabDiamondPrice(sizeRange?.value || "0.3");
    if (priceOutput) {
      priceOutput.textContent = formatPrice(price);
    } else if (priceSummary && productSlug === "create-your-own-ring") {
      priceSummary.innerHTML = `<strong>Total:</strong> ${formatPrice(price)}`;
    }
  };

  fields.forEach((field) => {
    field.addEventListener("change", () => {
      syncColourMode();
      syncSliderState();
      updateSummary();
      updatePrice();
      updateLink();
    });
  });

  sliders.forEach((slider) => {
    const targetId = slider.getAttribute("data-option-slider");
    if (!targetId) return;
    const input = page.querySelector(`#${targetId}`);
    if (!input) return;

    slider.querySelectorAll("[data-option-value]").forEach((option) => {
      option.addEventListener("click", () => {
        input.value = option.getAttribute("data-option-value") || "";
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  });

  sizeRanges.forEach((range) => {
    range.addEventListener("input", () => {
      syncSizeRanges();
      updateSummary();
      updatePrice();
      updateLink();
    });
  });

  discreteRanges.forEach((range) => {
    range.addEventListener("input", () => {
      syncDiscreteRanges();
      updateSummary();
      updatePrice();
      updateLink();
    });
  });

  syncSizeRanges();
  syncDiscreteRanges();
  syncColourMode();
  syncSliderState();
  updateSummary();
  updatePrice();
  updateLink();
});
