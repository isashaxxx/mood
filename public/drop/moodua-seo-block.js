(function () {
  const copy = {
    uk: {
      eyebrow: 'ЩО ЦЕ',
      h2a: 'Готова колекція мерчу,',
      h2b: 'яку можна зробити своєю.',
      p: 'Ми спроєктували базові речі — футболки, худі, поло — і зібрали їх у Drop Collection. Обираєте вироби, налаштовуєте колір, матеріал і брендування під свою компанію — і отримуєте готову структуру дропу без розробки з нуля.',
      stats: [
        ['6', 'базових виробів'],
        ['4+', 'кольори на кожен'],
        ['20 шт.', 'мінімальний тираж']
      ],
      cta: { text: 'Створити свою колекцію', href: '#top' }
    },
    ru: {
      eyebrow: 'ЧТО ЭТО',
      h2a: 'Готовая коллекция мерча,',
      h2b: 'которую можно сделать своей.',
      p: 'Мы спроектировали базовые вещи — футболки, худи, поло — и собрали их в Drop Collection. Выбираете изделия, настраиваете цвет, материал и брендирование под свою компанию — и получаете готовую структуру дропа без разработки с нуля.',
      stats: [
        ['6', 'базовых изделий'],
        ['4+', 'цвета на каждое'],
        ['20 шт.', 'минимальный тираж']
      ],
      cta: { text: 'Создать свою коллекцию', href: '#top' }
    },
    en: {
      eyebrow: 'WHAT IS THIS',
      h2a: 'A ready-made merch collection',
      h2b: 'you can make your own.',
      p: 'We designed core pieces — t-shirts, hoodies, polos — and put them together in a Drop Collection. Choose products, set the color, material and branding for your company, and get a ready-made drop structure without building from scratch.',
      stats: [
        ['6', 'core products'],
        ['4+', 'colors each'],
        ['20 pcs', 'minimum run']
      ],
      cta: { text: 'Build your collection', href: '#top' }
    }
  };

  const STYLE_ID = 'moodua-seo-block-styles';
  const css = `
    .moodua-seo{font-family:'Manrope',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:1320px;margin:0 auto;padding:clamp(56px,7vw,96px) clamp(20px,5vw,64px);display:grid;grid-template-columns:minmax(0,1.2fr) minmax(220px,0.8fr);gap:clamp(28px,4vw,56px);align-items:center;color:#324158;box-sizing:border-box}
    .moodua-seo *{box-sizing:border-box}
    .moodua-seo-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:#f0f2f5;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#324158;width:max-content;margin:0 0 16px}
    .moodua-seo h2{font-size:clamp(28px,3.6vw,46px);line-height:1.05;letter-spacing:-.03em;margin:0 0 16px;font-weight:700}
    .moodua-seo h2 em{font-style:italic;color:#2eb4b9}
    .moodua-seo-copy p{font-size:15px;line-height:1.6;color:#5e6d82;margin:0 0 20px;max-width:560px}
    .moodua-seo-cta{display:inline-flex;align-items:center;gap:8px;padding:14px 26px;border-radius:999px;background:#324158;color:#fff;font-weight:700;font-size:14px;text-decoration:none}
    .moodua-seo-stats{display:grid;gap:12px}
    .moodua-seo-stat{display:flex;align-items:baseline;gap:10px;padding:16px 20px;border:1px solid #e3e7ec;border-radius:14px;background:#f0f2f5}
    .moodua-seo-stat strong{font-size:clamp(20px,2.2vw,26px);font-weight:800;letter-spacing:-.02em;color:#324158;white-space:nowrap}
    .moodua-seo-stat span{font-size:12.5px;color:#5e6d82}
    @media (max-width:760px){.moodua-seo{grid-template-columns:1fr}}
  `;

  class MooduaSeoBlock extends HTMLElement {
    connectedCallback() {
      if (this.dataset.rendered === '1') return;
      this.dataset.rendered = '1';

      if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = css;
        document.head.append(style);
      }

      const lang = (this.getAttribute('lang') || document.documentElement.lang || 'uk').slice(0, 2).toLowerCase();
      const t = copy[lang] || copy.uk;

      const section = document.createElement('div');
      section.className = 'moodua-seo';

      const copyCol = document.createElement('div');
      copyCol.className = 'moodua-seo-copy';
      const eyebrow = document.createElement('p');
      eyebrow.className = 'moodua-seo-eyebrow';
      eyebrow.textContent = t.eyebrow;
      const h2 = document.createElement('h2');
      h2.append(document.createTextNode(t.h2a + ' '));
      const em = document.createElement('em');
      em.textContent = t.h2b;
      h2.append(em);
      const p = document.createElement('p');
      p.textContent = t.p;
      const cta = document.createElement('a');
      cta.className = 'moodua-seo-cta';
      cta.href = t.cta.href;
      cta.textContent = t.cta.text;
      copyCol.append(eyebrow, h2, p, cta);

      const statsCol = document.createElement('div');
      statsCol.className = 'moodua-seo-stats';
      t.stats.forEach(([num, label]) => {
        const stat = document.createElement('div');
        stat.className = 'moodua-seo-stat';
        const strong = document.createElement('strong');
        strong.textContent = num;
        const span = document.createElement('span');
        span.textContent = label;
        stat.append(strong, span);
        statsCol.append(stat);
      });

      section.append(copyCol, statsCol);
      this.append(section);
    }
  }

  if (!customElements.get('moodua-seo-block')) customElements.define('moodua-seo-block', MooduaSeoBlock);
})();
