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
  let openProductSelect = null;

  const closeProductSelect = (focusTrigger = true) => {
    if (!openProductSelect) return;
    openProductSelect.wrap.classList.remove("is-open");
    openProductSelect.trigger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("product-select-open");
    if (focusTrigger) openProductSelect.trigger.focus();
    openProductSelect = null;
  };

  document.addEventListener("click", (event) => {
    if (!openProductSelect || !(event.target instanceof Node)) return;
    if (openProductSelect.wrap.contains(event.target)) return;
    closeProductSelect(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openProductSelect) {
      closeProductSelect();
    }
  });

  const createProductSelect = (select, titleText) => {
    if (!select) return;

    const placeholderOption = Array.from(select.options).find((option) => !option.value);
    const placeholder = placeholderOption ? placeholderOption.textContent.trim() : "Select";

    select.classList.add("native-select");

    const wrap = document.createElement("div");
    wrap.className = "product-select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "product-select__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", titleText || "Choose an option");

    const triggerText = document.createElement("span");
    trigger.appendChild(triggerText);

    const menu = document.createElement("div");
    menu.className = "product-select__menu";

    const header = document.createElement("div");
    header.className = "product-select__header";

    const title = document.createElement("h3");
    title.className = "product-select__title";
    title.textContent = titleText || "Choose an option";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "product-select__close";
    closeBtn.setAttribute("aria-label", "Close options");
    closeBtn.textContent = "X";
    closeBtn.addEventListener("click", () => closeProductSelect());

    header.appendChild(title);
    header.appendChild(closeBtn);

    const searchWrap = document.createElement("div");
    searchWrap.className = "product-select__search-wrap";

    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "product-select__search";
    searchInput.placeholder = "Search size";
    searchInput.setAttribute("aria-label", "Search ring sizes");
    searchWrap.appendChild(searchInput);

    const list = document.createElement("div");
    list.className = "product-select__list";
    list.setAttribute("role", "listbox");

    const emptyState = document.createElement("p");
    emptyState.className = "product-select__empty";
    emptyState.textContent = "No sizes match that search.";

    const optionButtons = [];

    const getVisibleOptions = () => optionButtons.filter((button) => !button.hidden);

    const focusVisibleOption = (direction) => {
      const visibleOptions = getVisibleOptions();
      if (!visibleOptions.length) return;
      const currentIndex = visibleOptions.findIndex((button) => button === document.activeElement);
      const targetIndex = currentIndex >= 0
        ? (currentIndex + direction + visibleOptions.length) % visibleOptions.length
        : 0;
      visibleOptions[targetIndex].focus();
    };

    const scrollSelectedIntoView = () => {
      const selectedButton = optionButtons.find((button) => button.dataset.value === select.value && !button.hidden);
      if (!selectedButton) return;
      requestAnimationFrame(() => {
        selectedButton.scrollIntoView({ block: "nearest" });
      });
    };

    const filterOptions = () => {
      const query = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;

      optionButtons.forEach((button) => {
        const matches = !query || button.textContent.toLowerCase().includes(query);
        button.hidden = !matches;
        if (matches) visibleCount += 1;
      });

      emptyState.hidden = visibleCount > 0;
      if (!query) {
        scrollSelectedIntoView();
      }
    };

    const refresh = () => {
      const selectedOption = select.options[select.selectedIndex];
      const selectedText = selectedOption && selectedOption.value ? selectedOption.textContent.trim() : "";
      triggerText.textContent = selectedText || placeholder;
      trigger.dataset.hasValue = selectedText ? "true" : "false";

      Array.from(list.children).forEach((child) => {
        if (child instanceof HTMLButtonElement) {
          child.setAttribute("aria-selected", String(child.dataset.value === select.value));
        }
      });
    };

    Array.from(select.options).forEach((option) => {
      if (!option.value) return;
      const optionBtn = document.createElement("button");
      optionBtn.type = "button";
      optionBtn.className = "product-select__option";
      optionBtn.dataset.value = option.value;
      optionBtn.setAttribute("role", "option");
      optionBtn.textContent = option.textContent.trim();
      optionBtn.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        closeProductSelect(false);
        trigger.focus();
      });
      list.appendChild(optionBtn);
      optionButtons.push(optionBtn);
    });

    trigger.addEventListener("click", () => {
      const isOpen = wrap.classList.contains("is-open");
      if (openProductSelect && openProductSelect.wrap !== wrap) {
        closeProductSelect(false);
      }
      wrap.classList.toggle("is-open", !isOpen);
      trigger.setAttribute("aria-expanded", String(!isOpen));
      openProductSelect = !isOpen ? { wrap, trigger } : null;
      document.body.classList.toggle("product-select-open", !isOpen);
      if (!isOpen) {
        searchInput.value = "";
        filterOptions();
        requestAnimationFrame(() => searchInput.focus());
      }
    });

    searchInput.addEventListener("input", filterOptions);
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusVisibleOption(1);
      }
    });

    list.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusVisibleOption(1);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (document.activeElement === getVisibleOptions()[0]) {
          searchInput.focus();
          return;
        }
        focusVisibleOption(-1);
      }
    });

    select.addEventListener("change", refresh);

    menu.appendChild(header);
    menu.appendChild(searchWrap);
    menu.appendChild(list);
    menu.appendChild(emptyState);
    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    select.insertAdjacentElement("afterend", wrap);

    refresh();
    filterOptions();
  };

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
    createProductSelect(sizeSelect, "Select ring size");
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
