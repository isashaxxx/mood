(function () {
  const scriptUrl = document.currentScript?.src || document.baseURI;
  const defaultBase = new URL('.', scriptUrl).href;
  const buildVersion = '20260904-1800';
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
          p: 'Колекція, що показує, яким може бути мерч вашої компанії. Оберіть вироби, налаштуйте колір, матеріал і брендування — отримайте готову структуру дропу.',
          schemaDescription: 'Корпоративний мерч і подарунки з логотипом під ключ: дизайн, брендування, виробництво та доставка.'
        },
        ru: {
          h1: 'Make It Your MOOD — Drop Collection',
          p: 'Коллекция, которая показывает, каким может быть мерч вашей компании. Выберите изделия, настройте цвет, материал и брендирование — получите готовую структуру дропа.',
          schemaDescription: 'Корпоративный мерч и подарки с логотипом под ключ: дизайн, брендирование, производство и доставка.'
        },
        en: {
          h1: 'Make It Your MOOD — Drop Collection',
          p: 'A collection that shows what your company’s merch could look like. Choose products, customize color, material and branding — get a ready-made drop structure.',
          schemaDescription: 'Corporate merch and branded gifts, done for you: design, branding, production and delivery.'
        }
      };
      const pageLang = (document.documentElement.lang || 'uk').slice(0, 2).toLowerCase();
      const seo = seoCopy[pageLang] || seoCopy.uk;

      if (!this.querySelector('h1')) {
        const seoH1 = document.createElement('h1');
        seoH1.textContent = seo.h1;
        const seoP = document.createElement('p');
        seoP.textContent = seo.p;
        this.prepend(seoP);
        this.prepend(seoH1);
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
        await loadScript(versionedUrl('moodua-drop-data.js', assetBase));
        await loadScript(versionedUrl('moodua-drop.js', assetBase));
        const [htmlResponse, cssResponse] = await Promise.all([
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
