const palette = [
  { name: 'Молочний', value: '#e8dfce' },
  { name: 'Графітовий', value: '#4a4d4c' },
  { name: 'Небесний', value: '#86b9c3' },
  { name: 'Оливковий', value: '#74795b' },
  { name: 'Пудровий', value: '#d59b9e' },
  { name: 'Помаранчевий', value: '#ed7027' },
  { name: 'Бірюзовий', value: '#008d78' },
  { name: 'Карамельний', value: '#c28f63' },
  { name: 'Шоколадний', value: '#65443b' },
  { name: 'Білий', value: '#f6f2e9' },
  { name: 'Теракотовий', value: '#c8754e' },
  { name: 'Цегляний', value: '#ad5043' },
  { name: 'Шавлієвий', value: '#a6aa8c' },
  { name: 'Смарагдовий', value: '#176452' },
  { name: 'Джинсовий', value: '#385d7b' },
  { name: 'Тауп', value: '#756e72' }
];

const product = {
  category: 'Худі',
  detail: 'Шнурок і манжети',
  description: 'Об’ємне худі з м’яким капюшоном і регульованим низом. Зручна основа для корпоративного мерчу.',
  price: 3890,
  baseVariants: {
    0: 'assets/hoodie-milk.jpg',
    7: 'assets/hoodie-caramel.jpg',
    3: 'assets/hoodie-olive.jpg',
    6: 'assets/hoodie-turquoise.jpg'
  },
  detailOptions: {
    0: [0, 8],
    7: [7, 8],
    3: [3, 9],
    6: [6, 9]
  },
  detailVariants: {
    '0:8': 'assets/cuffs-brown-milk.jpg',
    '7:8': 'assets/cuffs-brown-caramel.jpg',
    '3:9': 'assets/cuffs-cream-olive.jpg',
    '6:9': 'assets/cuffs-white-turquoise.jpg'
  }
};

const materials = [
  { name: 'Базовий футер', short: 'Футер', add: 0, colors: [0, 7, 3, 6], variants: product.baseVariants },
  { name: 'Футер тринитка', short: 'Тринитка', add: 300, colors: [0], variants: { 0: 'assets/material-three-thread.jpg' } },
  { name: 'М’який фліс', short: 'Фліс', add: 450, colors: [0, 10, 11, 4, 12], variants: {
    0: 'assets/material-fleece.jpg',
    10: 'assets/fleece-terracotta.jpg',
    11: 'assets/fleece-brick.jpg',
    4: 'assets/fleece-pink.jpg',
    12: 'assets/fleece-sage.jpg'
  } },
  { name: 'Преміум велюр', short: 'Велюр', add: 550, colors: [0, 13, 14], variants: {
    0: 'assets/material-velour.jpg',
    13: 'assets/velour-green.jpg',
    14: 'assets/velour-blue.jpg'
  } }
];

const prints = [
  { name: 'Вишивка тон у тон', short: 'Вишивка', add: 0, colors: null, variants: null },
  { name: 'Букле бежеве', short: 'Букле беж', add: 350, colors: [0], variants: { 0: 'assets/print-boucle-beige.jpg' } },
  { name: 'Букле контрастне', short: 'Букле контраст', add: 450, colors: [0, 15, 10, 4, 13], variants: {
    0: 'assets/print-boucle-white.jpg',
    15: 'assets/boucle-grey.jpg',
    10: 'assets/boucle-terracotta.jpg',
    4: 'assets/boucle-pink.jpg',
    13: 'assets/boucle-green.jpg'
  } },
  { name: 'Букле кремове', short: 'Букле крем', add: 400, colors: [0], variants: { 0: 'assets/print-boucle-cream.jpg' } }
];

const state = { body: 0, accent: 0, material: 0, print: 0 };
const $ = selector => document.querySelector(selector);
const formatPrice = value => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;

function availableBodyColors() {
  return prints[state.print].colors || materials[state.material].colors;
}

function availableColors(type) {
  if (type === 'body') return availableBodyColors();
  const canChangeDetails = state.material === 0 && state.print === 0;
  return canChangeDetails ? (product.detailOptions[state.body] || [state.body]) : [state.body];
}

function renderSwatches(container, selected, type) {
  $(container).innerHTML = availableColors(type).map(index => {
    const color = palette[index];
    return `<button class="swatch ${selected === index ? 'active' : ''}" style="--swatch:${color.value}" data-${type}="${index}" aria-label="${color.name}" aria-pressed="${selected === index}" title="${color.name}"></button>`;
  }).join('');

  document.querySelectorAll(`[data-${type}]`).forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset[type]);
    if (type === 'body') {
      state.body = index;
      state.accent = index;
    } else {
      state.accent = index;
    }
    update();
  }));
}

function renderSegments(container, items, selected, type) {
  $(container).innerHTML = items.map((item, index) => {
    const priceLabel = item.add ? `+${formatPrice(item.add)}` : 'Включено';
    return `<button class="segment ${selected === index ? 'active' : ''}" data-${type}="${index}" aria-pressed="${selected === index}"><span>${item.short}</span><small>${priceLabel}</small></button>`;
  }).join('');
  document.querySelectorAll(`[data-${type}]`).forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset[type]);
    if (type === 'material') {
      state.material = index;
      state.print = 0;
      state.body = materials[index].colors[0];
    } else {
      state.print = index;
      if (prints[index].colors) {
        state.material = 0;
        state.body = prints[index].colors[0];
      }
    }
    state.accent = state.body;
    update();
  }));
}

function resolveImage() {
  const printImage = prints[state.print].variants?.[state.body];
  if (printImage) return printImage;
  const materialImage = materials[state.material].variants[state.body];
  if (state.material !== 0) return materialImage;
  const detailImage = product.detailVariants[`${state.body}:${state.accent}`];
  return detailImage || materialImage || product.baseVariants[0];
}

function update() {
  const body = palette[state.body];
  const accent = palette[state.accent];
  const material = materials[state.material];
  const print = prints[state.print];

  document.documentElement.style.setProperty('--body-color', body.value);
  document.documentElement.style.setProperty('--detail-color', accent.value);
  const image = $('#productImage');
  const visual = $('#productVisual');
  const nextImage = resolveImage();

  visual.classList.add('photo-mode');
  if (image.getAttribute('src') !== nextImage) {
    visual.classList.add('changing');
    image.onload = () => visual.classList.remove('changing');
    image.onerror = () => visual.classList.remove('changing');
    image.src = nextImage;
    if (image.complete) requestAnimationFrame(() => visual.classList.remove('changing'));
  }
  image.alt = `${product.category} MOODua: ${body.name}, ${accent.name}, ${material.name}, ${print.name}`;
  $('#category').textContent = product.category;
  $('#description').textContent = product.description;
  $('#detailLabel').textContent = product.detail;
  $('#bodyColorName').textContent = body.name;
  $('#detailColorName').textContent = accent.name;
  $('#materialName').textContent = material.name;
  $('#printName').textContent = print.name;
  $('#printPreview').className = 'print-preview';
  $('#summaryText').textContent = `${body.name} / ${material.short} / ${print.short}`;
  $('#price').textContent = formatPrice(product.price + material.add + print.add);

  renderSwatches('#bodyColors', state.body, 'body');
  renderSwatches('#detailColors', state.accent, 'accent');
  renderSegments('#materials', materials, state.material, 'material');
  renderSegments('#prints', prints, state.print, 'print');
}

$('#resetButton').addEventListener('click', () => {
  Object.assign(state, { body: 0, accent: 0, material: 0, print: 0 });
  update();
});

$('#orderButton').addEventListener('click', () => {
  const toast = $('#toast');
  toast.classList.add('visible');
  $('#orderButton span:first-child').textContent = 'Конфігурацію збережено';
  setTimeout(() => {
    toast.classList.remove('visible');
    $('#orderButton span:first-child').textContent = 'Отримати прорахунок';
  }, 3000);
});

[
  ...Object.values(product.baseVariants),
  ...Object.values(product.detailVariants),
  ...materials.flatMap(item => Object.values(item.variants)),
  ...prints.flatMap(item => Object.values(item.variants || {}))
].forEach(src => { const image = new Image(); image.src = src; });

update();
