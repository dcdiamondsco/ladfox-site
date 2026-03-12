document.querySelectorAll("[data-product-config]").forEach((config) => {
  const formId = config.getAttribute("data-config-form");
  const form = formId ? document.getElementById(formId) : config.closest(".copy")?.querySelector("form");
  const mediaPanel = config.closest(".layout")?.querySelector(".media");
  const productImage = mediaPanel?.querySelector("[data-product-image]");
  const productTitle = config.closest(".layout")?.querySelector(".product-title");
  const metalTarget = form?.querySelector('[data-config-hidden="metal"]');
  const metalOptions = config.querySelectorAll('[data-config-input="metal_base"]');
  const karatOptions = config.querySelectorAll('[data-config-input="metal_karat"]');
  const karatGroup = config.querySelector("[data-metal-karat-group]");
  const rangeFields = config.querySelectorAll("[data-config-range]");
  let imageView = "front";
  let imageRequest = 0;
  let mobileToggleButtons = [];

  const getRangeValues = (field) => (field.dataset.configValues || "").split("|");
  const getRangeLabels = (field) => (field.dataset.configLabels || "").split("|");
  const slugify = (value) => (value || "").toLowerCase().trim().replace(/\s+/g, "-");
  const getMetalSlug = (value) => {
    if (!value) return "";

    if (value === "Gold") return "yellow-gold";
    if (value === "White Gold") return "white-gold";
    if (value === "Rose Gold") return "rose-gold";
    if (value === "Platinum") return "platinum";

    return slugify(value);
  };
  const getShapeSlug = (value) => {
    if (!value) return "";
    if (value === "Marquise") return "marquise";
    return slugify(value);
  };
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
  const applyImageSource = (src) => {
    if (productImage) {
      productImage.src = src;
    }
  };
  const loadFirstAvailableImage = (sources, fallback) => {
    if (!sources.length) {
      applyImageSource(fallback);
      return;
    }

    const requestId = ++imageRequest;
    const trySource = (index) => {
      if (index >= sources.length) {
        if (requestId === imageRequest) {
          applyImageSource(fallback);
        }
        return;
      }

      const candidate = sources[index];
      const probe = new Image();

      probe.onload = () => {
        if (requestId === imageRequest) {
          applyImageSource(candidate);
        }
      };

      probe.onerror = () => {
        if (requestId === imageRequest) {
          trySource(index + 1);
        }
      };

      probe.src = candidate;
    };

    trySource(0);
  };
  const syncProductImage = () => {
    if (!productImage) return;

    const productSlug = productImage.getAttribute("data-product-slug");
    const defaultFront = productImage.getAttribute("data-default-front") || "";
    const defaultBack = productImage.getAttribute("data-default-back") || defaultFront;
    const selectedMetal = config.querySelector('[data-config-input="metal_base"]:checked')?.value || "";
    const selectedShape = config.querySelector('[data-config-input="shape"]:checked')?.value || "";
    const metalSlug = getMetalSlug(selectedMetal);
    const shapeSlug = getShapeSlug(selectedShape);

    if (!productSlug || !metalSlug || !shapeSlug) {
      const fallback = imageView === "back" ? defaultBack : defaultFront;
      const metalBase = metalSlug
        ? `Images/products/${productSlug}/${metalSlug}/_base-${imageView}.png`
        : "";
      loadFirstAvailableImage(metalBase ? [metalBase] : [], fallback);
      return;
    }

    const variantSuffix = imageView === "back" ? "-back" : "";
    const fallback = imageView === "back" ? defaultBack : defaultFront;
    const candidates = [
      `Images/products/${productSlug}/${metalSlug}/${shapeSlug}${variantSuffix}.png`,
      `Images/products/${productSlug}/${metalSlug}/_base-${imageView}.png`
    ];

    loadFirstAvailableImage(candidates, fallback);
  };
  const syncMobileToggleState = () => {
    mobileToggleButtons.forEach((button) => {
      const label = imageView === "front" ? "Show rear view" : "Show front view";

      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.disabled = false;
    });
  };
  const setImageView = (nextView) => {
    imageView = nextView === "back" ? "back" : "front";
    syncProductImage();
    syncMobileToggleState();
  };
  const handleMobileViewToggle = (event) => {
    if (!productImage) return;

    const mobileQuery = window.matchMedia("(max-width: 900px)");
    if (!mobileQuery.matches) return;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    setImageView(imageView === "front" ? "back" : "front");
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

    syncProductImage();
  };
  const getConfigValues = () => {
    const values = {};
    const selectedMetal = config.querySelector('[data-config-input="metal_base"]:checked')?.value || "";
    const selectedKarat = config.querySelector('[data-config-input="metal_karat"]:checked')?.value || "";

    values.product_name = (productTitle?.textContent || "").trim();
    values.selected_metal = selectedMetal === "Platinum"
      ? "Platinum"
      : [selectedKarat, selectedMetal].filter(Boolean).join(" ");

    config.querySelectorAll("[data-config-input]").forEach((field) => {
      const key = field.getAttribute("data-config-input");
      if (!key) return;
      if ((field.type === "radio" || field.type === "checkbox") && !field.checked) return;

      values[`selected_${key}`] = getFieldValue(field);
    });

    return values;
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

  if (productImage) {
    const mobileQuery = window.matchMedia("(max-width: 900px)");

    if (mediaPanel) {
      const prevButton = document.createElement("button");
      const nextButton = document.createElement("button");

      prevButton.type = "button";
      nextButton.type = "button";
      prevButton.className = "media-toggle media-toggle--prev";
      nextButton.className = "media-toggle media-toggle--next";
      prevButton.innerHTML = "&#8249;";
      nextButton.innerHTML = "&#8250;";

      [prevButton, nextButton].forEach((button) => {
        button.addEventListener("pointerup", handleMobileViewToggle);
        button.addEventListener("click", handleMobileViewToggle);
        mediaPanel.appendChild(button);
      });

      mobileToggleButtons = [prevButton, nextButton];
      syncMobileToggleState();
    }

    productImage.addEventListener("mouseenter", () => {
      if (!mobileQuery.matches) {
        setImageView("back");
      }
    });

    productImage.addEventListener("mouseleave", () => {
      if (!mobileQuery.matches) {
        setImageView("front");
      }
    });

    const resetImageView = () => {
      if (!mobileQuery.matches) {
        setImageView("front");
      }
    };

    if (typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", resetImageView);
    } else if (typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(resetImageView);
    }
  }

  config.closest(".copy")?.querySelectorAll("[data-product-enquiry-link]").forEach((link) => {
    link.addEventListener("click", () => {
      try {
        sessionStorage.setItem("ladfoxRingEnquiryConfig", JSON.stringify(getConfigValues()));
      } catch (_) {}
    });
  });
});
