// Helper functions to create sold and product items
function createSoldItem(imgSrc, altText) {
  const wrapper = document.createElement('div');
  wrapper.className = 'image-wrapper';

  const img = document.createElement('img');
  img.src = imgSrc;
  img.alt = altText;
  img.loading = 'lazy';

  const soldTag = document.createElement('div');
  soldTag.className = 'sold-tag';
  soldTag.textContent = 'Sold';

  wrapper.appendChild(img);
  wrapper.appendChild(soldTag);

  return wrapper;
}

function createProductItem(productData) {
  const wrapper = document.createElement('div');
  wrapper.className = 'image-wrapper';

  const link = document.createElement('a');
  link.href = productData.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.textDecoration = 'none';
  link.style.color = 'inherit';
  link.style.display = 'block';

  const img = document.createElement('img');
  img.src = productData.imgSrc;
  img.alt = productData.altText;
  img.loading = 'lazy';

  const priceDiv = document.createElement('div');
  priceDiv.style.marginTop = '12px';
  priceDiv.style.fontWeight = 'bold';
  priceDiv.style.fontSize = '1.15em';
  priceDiv.style.color = '#111';
  priceDiv.style.textAlign = 'center';
  priceDiv.textContent = productData.price;

  const descDiv = document.createElement('div');
  descDiv.style.marginTop = '8px';
  descDiv.style.fontSize = '0.9em';
  descDiv.style.color = '#333';
  descDiv.style.lineHeight = '1.3em';
  descDiv.style.textAlign = 'center';
  descDiv.style.fontFamily = "'Poppins', sans-serif";
  descDiv.style.whiteSpace = 'pre-line';
  descDiv.textContent = productData.description;

  link.appendChild(img);
  link.appendChild(priceDiv);
  link.appendChild(descDiv);

  wrapper.appendChild(link);

  return wrapper;
}

async function loadGallery() {
  const gallery = document.querySelector('.gallery');
  gallery.innerHTML = ''; // Clear existing content

  // Load from products.json
  try {
    const res = await fetch('products.json');
    if (!res.ok) throw new Error('Failed to load products.json');
    const products = await res.json();

    products.forEach(product => {
      if (product.sold) {
        gallery.appendChild(createSoldItem(product.image, 'Diamond'));
      } else {
        gallery.appendChild(createProductItem({
          href: product.url,
          imgSrc: product.image,
          altText: 'Diamond',
          price: product.price,
          description: `${product.shape}\n${product.carat}\n${product.color}\n${product.clarity}`
        }));
      }
    });
  } catch (error) {
    console.error('Failed to load products:', error);
  }

  // Load a specific product from HTML file
  try {
    const response = await fetch('Products/LG696581247/LG696581247.html');
    if (!response.ok) throw new Error('Failed to load product HTML');

    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    const productDiv = doc.querySelector('#product-info');

    if (productDiv) {
      const imgTag = productDiv.querySelector('img');
      const imgSrc = imgTag ? imgTag.getAttribute('src') : 'images/diamond2.jpg';
      const altText = imgTag ? imgTag.getAttribute('alt') : 'Diamond 2 - LG696581247';

      const priceElem = productDiv.querySelector('.price');
      const price = priceElem ? priceElem.textContent.trim() : '$1,223';

      const descElem = productDiv.querySelector('.description');
      const description = descElem ? descElem.textContent.trim() : 
        `Cushion Modified Brilliant\n2.57Ct\nD\nVVS 1`;

      gallery.appendChild(createProductItem({
        href: 'Products/LG696581247/LG696581247.html',
        imgSrc,
        altText,
        price,
        description
      }));
    } else {
      console.warn('No #product-info found in external HTML');
    }
  } catch (error) {
    console.error('Error loading external product:', error);
  }

  // Add static sold items at the end
