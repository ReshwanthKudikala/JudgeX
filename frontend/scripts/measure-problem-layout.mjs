import { chromium } from 'playwright';

const mockProblem = {
  success: true,
  data: {
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'easy',
    statement: 'LINE\n\n'.repeat(80),
    constraintsText: '- c\n'.repeat(30),
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    totalSubmissions: 10,
    totalAccepted: 5,
    acceptanceRate: 50,
    isPublished: true,
    examples: [
      { input: '1\n', output: '1\n', explanation: 'demo' },
      { input: '2\n', output: '2\n', explanation: 'demo' },
    ],
  },
  error: null,
  meta: {},
};

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const reqs = [];

page.on('request', (r) => {
  if (r.url().includes('/api') || r.url().includes('4000') || r.url().includes('problems')) {
    reqs.push(r.url());
  }
});

await page.route('**/*', async (route) => {
  const url = route.request().url();
  if (url.includes('/api/v1/problems/two-sum') || url.includes('/problems/two-sum')) {
    if (url.includes('/submissions') || url.includes('/discussions') || url.includes('/editorial')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null, error: null, meta: {} }),
      });
      return;
    }
    if (url.includes('/api/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockProblem),
      });
      return;
    }
  }
  if (url.includes('/api/')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null, error: null, meta: {} }),
    });
    return;
  }
  await route.continue();
});

await page.goto('http://127.0.0.1:5173/problems/two-sum', {
  waitUntil: 'networkidle',
  timeout: 60000,
});
await page.waitForTimeout(2000);

const snapshot = await page.evaluate(() => ({
  text: document.body.innerText.slice(0, 500),
  hasStatement: Boolean(document.querySelector('[aria-label="Problem statement"]')),
  hasError: document.body.innerText.includes('Couldn'),
  mainClass: document.querySelector('main')?.className,
}));

console.log('SNAPSHOT', JSON.stringify(snapshot, null, 2));
console.log('REQS', reqs.slice(0, 20));

if (!snapshot.hasStatement) {
  await browser.close();
  process.exit(1);
}

const data = await page.evaluate(() => {
  const pick = (el, name) => {
    if (!el) return { name, missing: true };
    const cs = getComputedStyle(el);
    return {
      name,
      className: String(el.className || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 10)
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
  const grid = statement?.parentElement || null;
  const layoutRoot = grid?.parentElement || null;

  const chain = [];
  let el = statement;
  while (el && chain.length < 16) {
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
    main: pick(main, 'main'),
    layoutRoot: pick(layoutRoot, 'ProblemLayout'),
    grid: pick(grid, 'grid'),
    statement: pick(statement, 'statement'),
    editor: pick(editor, 'editor'),
    chain,
  };
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
