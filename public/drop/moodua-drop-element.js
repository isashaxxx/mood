(function () {
  const scriptUrl = document.currentScript?.src || document.baseURI;
  const defaultBase = new URL('.', scriptUrl).href;
  const buildVersion = '20260904-1530';
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
