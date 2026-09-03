(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MoodDropData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PRODUCTS = {
    tee: {
      name: 'Футболка', code: 'MINERAL', image: 'assets/drop/cutouts/mineral.png',
      colors: [{ name: 'Мʼята', hex: '#9fd9d2' }, { name: 'Графіт', hex: '#263b59' }, { name: 'Молочний', hex: '#e9e4d9' }, { name: 'Корал', hex: '#f47b48' }],
      materials: ['Щільна бавовна 240 г', 'Organic cotton 220 г'],
      branding: ['Багатошаровий патч', 'Шовкодрук', 'Вишивка']
    },
    pocketTee: {
      name: 'Футболка з кишенею', code: 'MANIFEST', image: 'assets/drop/cutouts/manifest.png',
      colors: [{ name: 'Бірюза', hex: '#53bfc0' }, { name: 'Графіт', hex: '#263b59' }, { name: 'Молочний', hex: '#e9e4d9' }],
      materials: ['Виварена бавовна 240 г', 'Щільна бавовна 260 г'],
      branding: ['Кастомна кишеня', 'Комбінований друк', 'Нашивка']
    },
    longsleeve: {
      name: 'Лонгслів', code: 'CIPHER', image: 'assets/drop/cutouts/cipher.png',
      colors: [{ name: 'Мʼята', hex: '#9fd9d2' }, { name: 'Графіт', hex: '#263b59' }, { name: 'Молочний', hex: '#e9e4d9' }],
      materials: ['Бавовна 220 г', 'Бавовна з еластаном'],
      branding: ['3D-вишивка', 'Екошкіра', 'Шовкодрук']
    },
    polo: {
      name: 'Тепле поло', code: 'VELLURA', image: 'assets/drop/vellura-front-cutout.png',
      colors: [{ name: 'Молочний', hex: '#e9e4d9' }, { name: 'Мʼята', hex: '#9fd9d2' }, { name: 'Графіт', hex: '#263b59' }],
      materials: ['Футер 320 г', 'Трикотаж 280 г'],
      branding: ['Кастомний комір', 'Вишивка', 'Принт на спині']
    },
    hoodie: {
      name: 'Худі', code: 'VERVIE', image: 'assets/drop/cutouts/vervie.png',
      colors: [{ name: 'Молочний', hex: '#e9e4d9' }, { name: 'Графіт', hex: '#263b59' }, { name: 'Мʼята', hex: '#9fd9d2' }, { name: 'Корал', hex: '#f47b48' }],
      materials: ['Футер тринитка 350 г', 'Organic cotton 380 г'],
      branding: ['Намистини та принт', 'Обʼємне тиснення', 'Вишивка']
    },
    embossedHoodie: {
      name: 'Худі з тисненням', code: 'BARREL', image: 'assets/drop/cutouts/barrel.png',
      colors: [{ name: 'Молочний', hex: '#e9e4d9' }, { name: 'Графіт', hex: '#263b59' }, { name: 'Корал', hex: '#f47b48' }],
      materials: ['Футер тринитка 380 г', 'Бавовна premium 400 г'],
      branding: ['Обʼємне тиснення', 'Вишивка', 'Жакардова бірка'],
      palette: [
        { name: 'Молочний', hex: '#e8dfce' },
        { name: 'Графітовий', hex: '#4a4d4c' },
        { name: 'Небесний', hex: '#86b9c3' },
        { name: 'Оливковий', hex: '#74795b' },
        { name: 'Пудровий', hex: '#d59b9e' },
        { name: 'Помаранчевий', hex: '#ed7027' },
        { name: 'Бірюзовий', hex: '#008d78' },
        { name: 'Карамельний', hex: '#c28f63' },
        { name: 'Шоколадний', hex: '#65443b' },
        { name: 'Білий', hex: '#f6f2e9' },
        { name: 'Теракотовий', hex: '#c8754e' },
        { name: 'Цегляний', hex: '#ad5043' },
        { name: 'Шавлієвий', hex: '#a6aa8c' },
        { name: 'Смарагдовий', hex: '#176452' },
        { name: 'Джинсовий', hex: '#385d7b' },
        { name: 'Тауп', hex: '#756e72' }
      ],
      configurator: {
        detailLabel: 'Манжети та шнурки',
        baseVariants: {
          0: 'assets/drop/configurator/assets/hoodie-milk.jpg',
          7: 'assets/drop/configurator/assets/hoodie-caramel.jpg',
          3: 'assets/drop/configurator/assets/hoodie-olive.jpg',
          6: 'assets/drop/configurator/assets/hoodie-turquoise.jpg'
        },
        detailOptions: { 0: [0, 8], 7: [7, 8], 3: [3, 9], 6: [6, 9] },
        detailVariants: {
          '0:8': 'assets/drop/configurator/assets/cuffs-brown-milk.jpg',
          '7:8': 'assets/drop/configurator/assets/cuffs-brown-caramel.jpg',
          '3:9': 'assets/drop/configurator/assets/cuffs-cream-olive.jpg',
          '6:9': 'assets/drop/configurator/assets/cuffs-white-turquoise.jpg'
        },
        materials: [
          { name: 'Базовий футер', short: 'Футер', colors: [0, 7, 3, 6], variants: null },
          { name: 'Футер тринитка', short: 'Тринитка', colors: [0], variants: { 0: 'assets/drop/configurator/assets/material-three-thread.jpg' } },
          { name: 'Мʼякий фліс', short: 'Фліс', colors: [0, 10, 11, 4, 12], variants: {
            0: 'assets/drop/configurator/assets/material-fleece.jpg',
            10: 'assets/drop/configurator/assets/fleece-terracotta.jpg',
            11: 'assets/drop/configurator/assets/fleece-brick.jpg',
            4: 'assets/drop/configurator/assets/fleece-pink.jpg',
            12: 'assets/drop/configurator/assets/fleece-sage.jpg'
          } },
          { name: 'Преміум велюр', short: 'Велюр', colors: [0, 13, 14], variants: {
            0: 'assets/drop/configurator/assets/material-velour.jpg',
            13: 'assets/drop/configurator/assets/velour-green.jpg',
            14: 'assets/drop/configurator/assets/velour-blue.jpg'
          } }
        ],
        prints: [
          { name: 'Вишивка тон у тон', short: 'Вишивка', colors: null, variants: null },
          { name: 'Букле бежеве', short: 'Букле беж', colors: [0], variants: { 0: 'assets/drop/configurator/assets/print-boucle-beige.jpg' } },
          { name: 'Букле контрастне', short: 'Букле контраст', colors: [0, 15, 10, 4, 13], variants: {
            0: 'assets/drop/configurator/assets/print-boucle-white.jpg',
            15: 'assets/drop/configurator/assets/boucle-grey.jpg',
            10: 'assets/drop/configurator/assets/boucle-terracotta.jpg',
            4: 'assets/drop/configurator/assets/boucle-pink.jpg',
            13: 'assets/drop/configurator/assets/boucle-green.jpg'
          } },
          { name: 'Букле кремове', short: 'Букле крем', colors: [0], variants: { 0: 'assets/drop/configurator/assets/print-boucle-cream.jpg' } }
        ]
      }
    }
  };

  let nextId = 1;

  function createItem(productId) {
    const product = PRODUCTS[productId];
    if (!product) throw new Error(`Unknown product: ${productId}`);
    if (product.configurator) {
      const cfg = product.configurator;
      return {
        id: nextId++, productId,
        body: 0, accent: 0, materialIndex: 0, printIndex: 0,
        color: product.palette[0].name,
        material: cfg.materials[0].name,
        branding: cfg.prints[0].name,
        quantity: 50
      };
    }
    return {
      id: nextId++, productId,
      color: product.colors[0].name,
      material: product.materials[0],
      branding: product.branding[0],
      quantity: 50
    };
  }

  function updateItem(items, id, patch) {
    return items.map((item) => item.id === id ? { ...item, ...patch, id: item.id } : item);
  }

  function duplicateItem(items, id) {
    const source = items.find((item) => item.id === id);
    return source ? [...items, { ...source, id: nextId++ }] : items.slice();
  }

  function removeItem(items, id) { return items.filter((item) => item.id !== id); }

  function summarizeCollection(items) {
    const total = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const list = items.map((item) => `${PRODUCTS[item.productId].name} — ${item.color}, ${item.material}, ${item.branding}, ${item.quantity} шт.`).join('\n');
    return `${items.length} вироби · ${total} одиниць\n${list}`;
  }

  return { PRODUCTS, createItem, updateItem, duplicateItem, removeItem, summarizeCollection };
});
