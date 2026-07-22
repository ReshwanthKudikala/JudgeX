import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1/problems/two-sum', {
  waitUntil: 'networkidle',
  timeout: 60000,
});
await page.waitForTimeout(2000);

const data = await page.evaluate(() => {
  const pick = (el, name) => {
    if (!el) return { name, missing: true };
    const cs = getComputedStyle(el);
    return {
      name,
      className: String(el.className || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 12)
        .join(' '),
      clientHeight: Math.round(el.clientHeight),
      scrollHeight: Math.round(el.scrollHeight),
      expands: el.scrollHeight > el.clientHeight + 2,
      height: cs.height,
      minHeight: cs.minHeight,
      overflowY: cs.overflowY,
    };
  };

  const statement = document.querySelector('[aria-label="Problem statement"]');
  const editor = document.querySelector('[aria-label="Code editor panel"]');
  const main = document.querySelector('main');
  const root = document.getElementById('root');
  const mainLayout = root?.firstElementChild;

  const chain = [];
  let el = statement;
  while (el && chain.length < 14) {
    chain.unshift(pick(el, el.getAttribute('aria-label') || el.tagName.toLowerCase()));
    el = el.parentElement;
  }

  return {
    viewport: { w: innerWidth, h: innerHeight },
    doc: {
      deScroll: document.documentElement.scrollHeight,
      deClient: document.documentElement.clientHeight,
      canDocumentScroll: document.documentElement.scrollHeight > window.innerHeight + 2,
    },
    html: pick(document.documentElement, 'html'),
    body: pick(document.body, 'body'),
    root: pick(root, '#root'),
    mainLayout: pick(mainLayout, 'mainLayout'),
    main: pick(main, 'main'),
    statement: pick(statement, 'statement'),
    editor: pick(editor, 'editor'),
    chain,
    path: location.pathname,
  };
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
