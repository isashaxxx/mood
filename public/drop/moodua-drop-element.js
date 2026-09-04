(function () {
  const scriptUrl = document.currentScript?.src || document.baseURI;
  const defaultBase = new URL('.', scriptUrl).href;
  const buildVersion = '20260904-2100';
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
          h1: 'Готова колекція мерчу, яку можна зробити своєю.',
          eyebrow: 'ЩО ЦЕ',
          intro: 'Ми спроєктували базові речі — футболки, худі, поло — і зібрали їх у Drop Collection. Обираєте вироби, налаштовуєте колір, матеріал і брендування під свою компанію — і отримуєте готову структуру дропу без розробки з нуля.',
          stats: [['6', 'базових виробів'], ['4+', 'кольори на кожен'], ['20 шт.', 'мінімальний тираж']],
          cta: 'Створити свою колекцію',
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
          h1: 'Готовая коллекция мерча, которую можно сделать своей.',
          eyebrow: 'ЧТО ЭТО',
          intro: 'Мы спроектировали базовые вещи — футболки, худи, поло — и собрали их в Drop Collection. Выбираете изделия, настраиваете цвет, материал и брендирование под свою компанию — и получаете готовую структуру дропа без разработки с нуля.',
          stats: [['6', 'базовых изделий'], ['4+', 'цвета на каждое'], ['20 шт.', 'минимальный тираж']],
          cta: 'Создать свою коллекцию',
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
          h1: 'A ready-made merch collection you can make your own.',
          eyebrow: 'WHAT IS THIS',
          intro: 'We designed core pieces — t-shirts, hoodies, polos — and put them together in a Drop Collection. Choose products, set the color, material and branding for your company, and get a ready-made drop structure without building from scratch.',
          stats: [['6', 'core products'], ['4+', 'colors each'], ['20 pcs', 'minimum run']],
          cta: 'Build your collection',
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

      if (!document.getElementById('moodua-seo-intro-styles')) {
        const introStyles = document.createElement('style');
        introStyles.id = 'moodua-seo-intro-styles';
        introStyles.textContent = `
          .moodua-seo-intro{font-family:'Manrope',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:1320px;margin:0 auto;padding:clamp(56px,7vw,96px) clamp(20px,5vw,64px);display:grid;grid-template-columns:minmax(0,1.2fr) minmax(220px,0.8fr);gap:clamp(28px,4vw,56px);align-items:center;color:#324158;box-sizing:border-box}
          .moodua-seo-intro *{box-sizing:border-box}
          .moodua-seo-intro-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:#f0f2f5;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#324158;width:max-content;margin:0 0 16px}
          .moodua-seo-intro h1{font-size:clamp(28px,3.6vw,46px);line-height:1.05;letter-spacing:-.03em;margin:0 0 16px;font-weight:700}
          .moodua-seo-intro-copy p{font-size:15px;line-height:1.6;color:#5e6d82;margin:0 0 20px;max-width:560px}
          .moodua-seo-intro-cta{display:inline-flex;align-items:center;gap:8px;padding:14px 26px;border-radius:999px;background:#324158;color:#fff;font-weight:700;font-size:14px;text-decoration:none}
          .moodua-seo-intro-stats{display:grid;gap:12px}
          .moodua-seo-intro-stat{display:flex;align-items:baseline;gap:10px;padding:16px 20px;border:1px solid #e3e7ec;border-radius:14px;background:#f0f2f5}
          .moodua-seo-intro-stat strong{font-size:clamp(20px,2.2vw,26px);font-weight:800;letter-spacing:-.02em;color:#324158;white-space:nowrap}
          .moodua-seo-intro-stat span{font-size:12.5px;color:#5e6d82}
          @media (max-width:760px){.moodua-seo-intro{grid-template-columns:1fr}}
        `;
        document.head.append(introStyles);
      }

      if (!this.querySelector('.moodua-seo-intro')) {
        const introWrap = document.createElement('div');
        introWrap.className = 'moodua-seo-intro';
        introWrap.setAttribute('slot', 'moodua-seo-intro');
        const copyCol = document.createElement('div');
        copyCol.className = 'moodua-seo-intro-copy';
        const eyebrow = document.createElement('p');
        eyebrow.className = 'moodua-seo-intro-eyebrow';
        eyebrow.textContent = seo.eyebrow;
        const seoH1 = document.createElement('h1');
        seoH1.textContent = seo.h1;
        const seoIntro = document.createElement('p');
        seoIntro.textContent = seo.intro;
        const cta = document.createElement('a');
        cta.className = 'moodua-seo-intro-cta';
        cta.href = '#builder';
        cta.textContent = seo.cta;
        copyCol.append(eyebrow, seoH1, seoIntro, cta);
        const statsCol = document.createElement('div');
        statsCol.className = 'moodua-seo-intro-stats';
        seo.stats.forEach(([num, label]) => {
          const stat = document.createElement('div');
          stat.className = 'moodua-seo-intro-stat';
          const strong = document.createElement('strong');
          strong.textContent = num;
          const span = document.createElement('span');
          span.textContent = label;
          stat.append(strong, span);
          statsCol.append(stat);
        });
        introWrap.append(copyCol, statsCol);
        this.append(introWrap);
      }

      if (!this.querySelector('h2')) {
        const frag = document.createDocumentFragment();
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

        const heroSection = main.querySelector('.hero');
        if (heroSection) {
          const seoSlot = source.createElement('slot');
          seoSlot.setAttribute('name', 'moodua-seo-intro');
          heroSection.insertAdjacentElement('afterend', seoSlot);
        }

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
