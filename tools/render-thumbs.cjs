// Renders a transparent thumbnail of every item in src/tryon/catalog.ts to
// public/thumbs/<id>.webp, for the HUD's item carousel. Dev tooling.
//   PORT=5191 pnpm dev   (serves /models)
//   PLAYWRIGHT_FROM=<folder with @playwright/test> node tools/render-thumbs.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require(require.resolve('@playwright/test', { paths: [process.env.PLAYWRIGHT_FROM || __dirname] }));

const ROOT = path.resolve(__dirname, '..');
const ids = [...fs.readFileSync(path.join(ROOT, 'src/tryon/catalog.ts'), 'utf8').matchAll(/\{ id: "([a-z0-9-]+)"/g)].map((m) => m[1]);
const BASE = `http://localhost:${process.env.PORT || 5191}`;
/** Render size, and the saved thumbnail's size after cropping to the item. */
const SIZE = 384;
const OUT = 128;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
  // A blank page at the dev server's origin (so /models loads same-origin),
  // and the project's own three.js under /__three/.
  await page.route(`${BASE}/__three/**`, (route) => {
    const rel = new URL(route.request().url()).pathname.replace('/__three/', '');
    route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, 'node_modules/three', rel), 'utf8') });
  });
  await page.route(`${BASE}/__thumbs.html`, (route) => route.fulfill({
    contentType: 'text/html',
    body: '<html><head><script type="importmap">{"imports":{"three":"/__three/build/three.module.js","three/addons/":"/__three/examples/jsm/"}}</script></head><body style="margin:0;background:transparent"></body></html>',
  }));
  await page.goto(`${BASE}/__thumbs.html`);

  await page.evaluate((o) => { window.OUT = o; }, OUT);
  await page.evaluate(async (size) => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(1, 2, 3);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.001, 10);
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    window.renderThumb = async (url) => {
      const root = (await loader.loadAsync(url)).scene;
      scene.add(root);
      // A gentle three-quarter view from the front (the models face +Z).
      root.rotation.set(0.12, -0.45, 0);
      root.updateMatrixWorld(true);
      // Frame the parts you can see: hidden parts sit at scale 0.
      const box = new THREE.Box3();
      const part = new THREE.Box3();
      root.traverse((o) => {
        if (!o.isMesh || Math.abs(o.matrixWorld.determinant()) < 1e-15) return;
        for (let p = o; p; p = p.parent) if (!p.visible) return;
        o.geometry.computeBoundingBox();
        box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
      });
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      const r = Math.max(s.x, s.y, s.z) * 0.6;
      camera.position.set(c.x, c.y, c.z + r / Math.tan((camera.fov * Math.PI) / 360));
      camera.lookAt(c);
      renderer.render(scene, camera);
      scene.remove(root);
      // Crop to the drawn pixels (square, 6 % margin) so every item fills
      // its tile the same way, whatever its proportions.
      const src = document.createElement('canvas');
      src.width = size; src.height = size;
      const sctx = src.getContext('2d');
      sctx.drawImage(renderer.domElement, 0, 0);
      const { data } = sctx.getImageData(0, 0, size, size);
      let x0 = size, y0 = size, x1 = 0, y1 = 0;
      for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
        if (data[(y * size + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
      const side = Math.max(x1 - x0, y1 - y0) * 1.12;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const out = document.createElement('canvas');
      out.width = out.height = window.OUT;
      const octx = out.getContext('2d');
      octx.imageSmoothingQuality = 'high';
      octx.drawImage(src, cx - side / 2, cy - side / 2, side, side, 0, 0, window.OUT, window.OUT);
      return out.toDataURL('image/webp', 0.9);
    };
  }, SIZE);

  for (const id of ids) {
    const data = await page.evaluate((u) => window.renderThumb(u), `${BASE}/models/vincentt-${id}.glb`);
    fs.writeFileSync(path.join(ROOT, 'public/thumbs', `${id}.webp`), Buffer.from(data.split(',')[1], 'base64'));
    console.log(id);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
