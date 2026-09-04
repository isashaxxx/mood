(function () {
  const scriptUrl = document.currentScript?.src || document.baseURI;
  const defaultBase = new URL('.', scriptUrl).href;
  const buildVersion = '20260904-1900';
  const versionedUrl = (path, base) => {
    const url = new URL(path, base);
    url.searchParams.set('v', buildVersion);
    return url.href;
  };
  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.append(script);
  });

  class MooduaDropCollection extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.cleanup = null;
    }

    async connectedCallback() {
      if (this.shadowRoot?.childElementCount) return;
      const assetBase = new URL(this.getAttribute('asset-base') || '.', defaultBase).href;
      this.setAttribute('asset-base', assetBase);

      const seoCopy = {
        uk: {
          h1: 'Make It Your MOOD — Drop Collection',
          intro: 'Колекція, що показує, яким може бути мерч вашої компанії. Оберіть вироби, налаштуйте колір, матеріал і брендування — отримайте готову структуру дропу.',
          schemaDescription: 'Корпоративний мерч і подарунки з логотипом під ключ: дизайн, брендування, виробництво та доставка.',
          sections: [
            { h2: 'Що таке MOODua Drop Collection?', p: 'Це готова колекція базового мерчу — футболки, худі, поло, лонгсліви — яку можна кастомізувати під бренд вашої компанії: колір, матеріал, принт і брендування.' },
            { h2: 'З яких виробів складається колекція?', p: 'Речі, з яких складається настрій: виварена футболка MINERAL, худі BARREL, поло VELLURA, лонгслів CIPHER, футболка з кишенею MANIFEST та худі з намистинами VERVIE.' },
            { h2: 'Як налаштувати колір, крій і брендування?', p: 'Колір, крій, матеріал і брендовані деталі адаптуємо під стиль вашої компанії — оберіть варіант просто в конструкторі на цій сторінці.' }
          ],
          stepsHeading: 'Як створити свою колекцію?',
          steps: ['Оберіть кілька виробів', 'Налаштуйте колір, матеріал і брендування кожного', 'Отримайте готову структуру майбутнього дропу'],
          faq: [
            { q: 'Яка мінімальна кількість на одну позицію?', a: 'Від 20 одиниць на виріб — можна комбінувати кольори, матеріали та брендування в межах цієї кількості.' },
            { q: 'Скільки часу займає виробництво?', a: 'Зазвичай 10–15 робочих днів від затвердження макету — залежить від кількості позицій і техніки нанесення.' },
            { q: 'Чи можна отримати зразок перед великим тиражем?', a: 'Так, ми готуємо контрольний зразок для затвердження кольору, матеріалу та нанесення перед запуском повного тиражу.' },
            { q: 'Які способи оплати доступні?', a: 'Працюємо за рахунком для юросіб і ФОП: передоплата 50% на старт виробництва, решта — перед відвантаженням.' },
            { q: 'Чи доставляєте по всій Україні?', a: 'Так, відправляємо Новою поштою по всій Україні, а за запитом організовуємо і міжнародну доставку.' }
          ],
          linksHeading: 'Дізнатися більше',
          links: [
            { text: 'корпоративний мерч', href: 'https://www.moodua.com/swag' },
            { text: 'каталог подарунків', href: 'https://www.moodua.com/shop' },
            { text: 'портфоліо проєктів', href: 'https://www.moodua.com/portfolio-cases' },
            { text: 'політика конфіденційності', href: 'https://www.moodua.com/confidentiality-policy' }
          ]
        },
        ru: {
          h1: 'Make It Your MOOD — Drop Collection',
          intro: 'Коллекция, которая показывает, каким может быть мерч вашей компании. Выберите изделия, настройте цвет, материал и брендирование — получите готовую структуру дропа.',
          schemaDescription: 'Корпоративный мерч и подарки с логотипом под ключ: дизайн, брендирование, производство и доставка.',
          sections: [
            { h2: 'Что такое MOODua Drop Collection?', p: 'Это готовая коллекция базового мерча — футболки, худи, поло, лонгсливы — которую можно кастомизировать под бренд вашей компании: цвет, материал, принт и брендирование.' },
            { h2: 'Из каких изделий состоит коллекция?', p: 'Вещи, из которых складывается настроение: вываренная футболка MINERAL, худи BARREL, поло VELLURA, лонгслив CIPHER, футболка с карманом MANIFEST и худи с бусинами VERVIE.' },
            { h2: 'Как настроить цвет, крой и брендирование?', p: 'Цвет, крой, материал и брендированные детали адаптируем под стиль вашей компании — выберите вариант прямо в конструкторе на этой странице.' }
          ],
          stepsHeading: 'Как создать свою коллекцию?',
          steps: ['Выберите несколько изделий', 'Настройте цвет, материал и брендирование каждого', 'Получите готовую структуру будущего дропа'],
          faq: [
            { q: 'Какое минимальное количество на одну позицию?', a: 'От 20 единиц на изделие — можно комбинировать цвета, материалы и брендирование в пределах этого количества.' },
            { q: 'Сколько времени занимает производство?', a: 'Обычно 10–15 рабочих дней от утверждения макета — зависит от количества позиций и техники нанесения.' },
            { q: 'Можно ли получить образец перед большим тиражом?', a: 'Да, мы готовим контрольный образец для утверждения цвета, материала и нанесения перед запуском полного тиража.' },
            { q: 'Какие способы оплаты доступны?', a: 'Работаем по счету для юрлиц и ФЛП: предоплата 50% на старт производства, остальное — перед отгрузкой.' },
            { q: 'Доставляете ли по всей Украине?', a: 'Да, отправляем Новой почтой по всей Украине, а по запросу организуем и международную доставку.' }
          ],
          linksHeading: 'Узнать больше',
          links: [
            { text: 'корпоративный мерч', href: 'https://www.moodua.com/swag' },
            { text: 'каталог подарков', href: 'https://www.moodua.com/shop' },
            { text: 'портфолио проектов', href: 'https://www.moodua.com/portfolio-cases' },
            { text: 'политика конфиденциальности', href: 'https://www.moodua.com/confidentiality-policy' }
          ]
        },
        en: {
          h1: 'Make It Your MOOD — Drop Collection',
          intro: 'A collection that shows what your company’s merch could look like. Choose products, customize color, material and branding — get a ready-made drop structure.',
          schemaDescription: 'Corporate merch and branded gifts, done for you: design, branding, production and delivery.',
          sections: [
            { h2: 'What is MOODua Drop Collection?', p: 'A ready-made collection of core merch — t-shirts, hoodies, polos, longsleeves — that you can customize for your brand: color, material, print and branding.' },
            { h2: 'What products are in the collection?', p: 'Items that shape the mood: the MINERAL washed tee, BARREL hoodie, VELLURA polo, CIPHER longsleeve, MANIFEST pocket tee and VERVIE beaded hoodie.' },
            { h2: 'How do I customize color, cut and branding?', p: 'Color, cut, material and branded details are adapted to your company’s style — just pick an option in the configurator on this page.' }
          ],
          stepsHeading: 'How to build your own collection?',
          steps: ['Choose a few products', 'Customize the color, material and branding of each', 'Get a ready-made structure for your upcoming drop'],
          faq: [
            { q: 'What’s the minimum quantity per item?', a: 'From 20 units per product — you can combine colors, materials and branding within that quantity.' },
            { q: 'How long does production take?', a: 'Usually 10–15 business days from artwork approval, depending on the number of items and print technique.' },
            { q: 'Can I get a sample before a large run?', a: 'Yes, we prepare a control sample to approve color, material and print before launching the full run.' },
            { q: 'What payment methods are available?', a: 'We invoice legal entities and sole proprietors: 50% upfront to start production, the rest before shipping.' },
            { q: 'Do you deliver across Ukraine?', a: 'Yes, we ship via Nova Poshta across Ukraine, and arrange international delivery on request.' }
          ],
          linksHeading: 'Learn more',
          links: [
            { text: 'corporate merch', href: 'https://www.moodua.com/swag' },
            { text: 'gift catalog', href: 'https://www.moodua.com/shop' },
            { text: 'portfolio', href: 'https://www.moodua.com/portfolio-cases' },
            { text: 'privacy policy', href: 'https://www.moodua.com/confidentiality-policy' }
          ]
        }
      };
      const pageLang = (document.documentElement.lang || 'uk').slice(0, 2).toLowerCase();
      const seo = seoCopy[pageLang] || seoCopy.uk;

      if (!this.querySelector('h1')) {
        const frag = document.createDocumentFragment();
        const seoH1 = document.createElement('h1');
        seoH1.textContent = seo.h1;
        frag.append(seoH1);
        const seoIntro = document.createElement('p');
        seoIntro.textContent = seo.intro;
        frag.append(seoIntro);
        seo.sections.forEach((section) => {
          const h2 = document.createElement('h2');
          h2.textContent = section.h2;
          const p = document.createElement('p');
          p.textContent = section.p;
          frag.append(h2, p);
        });
        const stepsH2 = document.createElement('h2');
        stepsH2.textContent = seo.stepsHeading;
        frag.append(stepsH2);
        const ol = document.createElement('ol');
        seo.steps.forEach((step) => {
          const li = document.createElement('li');
          li.textContent = step;
          ol.append(li);
        });
        frag.append(ol);
        seo.faq.forEach((item) => {
          const h2 = document.createElement('h2');
          h2.textContent = item.q;
          const p = document.createElement('p');
          p.textContent = item.a;
          frag.append(h2, p);
        });
        const linksH2 = document.createElement('h2');
        linksH2.textContent = seo.linksHeading;
        frag.append(linksH2);
        const linksP = document.createElement('p');
        seo.links.forEach((link, i) => {
          const a = document.createElement('a');
          a.href = link.href;
          a.textContent = link.text;
          linksP.append(a);
          if (i < seo.links.length - 1) linksP.append(document.createTextNode(' · '));
        });
        frag.append(linksP);
        this.prepend(frag);
      }

      if (!document.getElementById('moodua-drop-schema')) {
        const schema = document.createElement('script');
        schema.type = 'application/ld+json';
        schema.id = 'moodua-drop-schema';
        schema.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'MOODua',
          url: 'https://www.moodua.com',
          description: seo.schemaDescription
        });
        document.head.append(schema);
      }

      if (!document.getElementById('moodua-drop-fonts')) {
        const fonts = document.createElement('style');
        fonts.id = 'moodua-drop-fonts';
        fonts.textContent = `
          @font-face{font-family:'Manrope';font-style:normal;font-weight:400;font-display:swap;src:url('${new URL('assets/drop/manrope-400.ttf', assetBase).href}') format('truetype')}
          @font-face{font-family:'Manrope';font-style:normal;font-weight:500;font-display:swap;src:url('${new URL('assets/drop/manrope-500.ttf', assetBase).href}') format('truetype')}
          @font-face{font-family:'Manrope';font-style:normal;font-weight:600;font-display:swap;src:url('${new URL('assets/drop/manrope-600.ttf', assetBase).href}') format('truetype')}
          @font-face{font-family:'Manrope';font-style:normal;font-weight:700;font-display:swap;src:url('${new URL('assets/drop/manrope-700.ttf', assetBase).href}') format('truetype')}
          @font-face{font-family:'Manrope';font-style:normal;font-weight:800;font-display:swap;src:url('${new URL('assets/drop/manrope-800.ttf', assetBase).href}') format('truetype')}
        `;
        document.head.append(fonts);
      }

      try {
        const [, , htmlResponse, cssResponse] = await Promise.all([
          loadScript(versionedUrl('moodua-drop-data.js', assetBase)),
          loadScript(versionedUrl('moodua-drop.js', assetBase)),
          fetch(versionedUrl('moodua-drop.html', assetBase), { cache: 'no-store' }),
          fetch(versionedUrl('moodua-drop.css', assetBase), { cache: 'no-store' })
        ]);
        if (!htmlResponse.ok || !cssResponse.ok) throw new Error('MOODua files could not be loaded');

        const [html, rawCss] = await Promise.all([htmlResponse.text(), cssResponse.text()]);
        const source = new DOMParser().parseFromString(html, 'text/html');
        const main = source.querySelector('main');
        const dialog = source.querySelector('dialog');
        if (!main || !dialog) throw new Error('MOODua layout is incomplete');

        source.querySelectorAll('main img, dialog img').forEach((image) => {
          const src = image.getAttribute('src');
          if (src) image.setAttribute('src', new URL(src, assetBase).href);
        });

        const css = rawCss
          .replace(':root{', ':host{')
          .replace('body{', '.mood-root{')
          .replace(/url\(['"]?(assets\/[^'")]+)['"]?\)/g, (_, path) => `url("${new URL(path, assetBase).href}")`);
        this.shadowRoot.innerHTML = `<style>${css}:host{display:block;width:100%;contain:content}.mood-root{width:100%;overflow:hidden}</style><div class="mood-root">${main.outerHTML}${dialog.outerHTML}</div>`;
        this.cleanup = window.initMoodDrop(this.shadowRoot);
        this.dispatchEvent(new CustomEvent('moodua-ready', { bubbles: true, composed: true }));
      } catch (error) {
        console.error('MOODua Drop Collection failed to initialize', error);
        if (this.shadowRoot) this.shadowRoot.innerHTML = '<p style="padding:24px;font-family:Arial,sans-serif">Не вдалося завантажити колекцію.</p>';
      }
    }

    disconnectedCallback() {
      if (typeof this.cleanup === 'function') this.cleanup();
      this.cleanup = null;
    }
  }

  if (!customElements.get('moodua-drop-collection')) customElements.define('moodua-drop-collection', MooduaDropCollection);
})();
