const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

async function main(runtimePath, threePath, pickup) {
  const command = pickup ? 'build:e8-pickup' : 'build:e8-director';
  if (!runtimePath) throw Error(`Usage: npm run ${command} -- <Easymap8 runtime directory> [matching Three.js package]`);
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, pickup ? 'web-hsr-pickup' : 'web-e8-director');
  const runtime = path.resolve(runtimePath);
  const mount = 'inc/javascript/easymap8';
  const three = 'vendor/three/three.module.min.js';
  const sdkThree = path.resolve(threePath ?? path.join(runtime, '../easymap8_sdk/third_src/maplibre-three-plugin/node_modules/three'));
  const loader = path.join(sdkThree, 'examples/jsm/loaders/GLTFLoader.js');
  const buildInfo = JSON.parse(fs.readFileSync(path.join(runtime, 'build-info.json'), 'utf8'));
  const addonVersion = JSON.parse(fs.readFileSync(path.join(sdkThree, 'package.json'), 'utf8')).version;
  if (addonVersion !== buildInfo.three) throw Error('The GLTFLoader package must match the E8 runtime Three.js version.');
  const shared = path.join(root, 'examples/e8-dir1');
  const example = pickup ? path.join(root, 'examples/hsr-pickup') : shared;
  const fixture = pickup ? example : path.join(root, 'examples/view-flow1');
  const assets = pickup
    ? ['pickup.scene.json', 'stage.glb', 'car.glb', 'passenger.glb']
    : ['check-valve.scene.json', 'synthetic-valve.glb'];
  for (const file of ['easymap.js', 'easymap.css', three]) fs.accessSync(path.join(runtime, file), fs.constants.R_OK);
  fs.accessSync(loader, fs.constants.R_OK);
  for (const file of assets) fs.accessSync(path.join(fixture, file), fs.constants.R_OK);
  fs.mkdirSync(output, {recursive: true});
  fs.cpSync(runtime, path.join(output, mount), {recursive: true});
  for (const file of ['index.html', 'style.css']) fs.copyFileSync(path.join(example, file), path.join(output, file));
  for (const file of assets) fs.copyFileSync(path.join(fixture, file), path.join(output, file));
  await esbuild.build({
    entryPoints: [path.join(shared, 'demo.mjs')],
    outfile: path.join(output, 'demo.js'), bundle: true, format: 'esm', target: 'es2022',
    plugins: [{name: 'e8-three', setup(build) {
      build.onResolve({filter: /^three$/}, () => ({path: './' + mount + '/' + three, external: true}));
      build.onResolve({filter: /^three\/addons\/loaders\/GLTFLoader\.js$/}, () => ({path: loader}));
    }}],
  });
  console.log(output);
}

const pickup = process.argv[2] === '--pickup';
const start = pickup ? 3 : 2;
main(process.argv[start], process.argv[start + 1], pickup).catch(error => { console.error(error.message); process.exitCode = 1; });
