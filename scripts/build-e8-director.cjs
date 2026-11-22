const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

async function main(runtimePath, threePath) {
  if (!runtimePath) throw Error('Usage: npm run build:e8-director -- <Easymap8 runtime directory> [matching Three.js package]');
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'web-e8-director');
  const runtime = path.resolve(runtimePath);
  const mount = 'inc/javascript/easymap8';
  const three = 'vendor/three/three.module.min.js';
  const sdkThree = path.resolve(threePath ?? path.join(runtime, '../easymap8_sdk/third_src/maplibre-three-plugin/node_modules/three'));
  const loader = path.join(sdkThree, 'examples/jsm/loaders/GLTFLoader.js');
  const buildInfo = JSON.parse(fs.readFileSync(path.join(runtime, 'build-info.json'), 'utf8'));
  const addonVersion = JSON.parse(fs.readFileSync(path.join(sdkThree, 'package.json'), 'utf8')).version;
  if (addonVersion !== buildInfo.three) throw Error('The GLTFLoader package must match the E8 runtime Three.js version.');
  const example = path.join(root, 'examples/e8-dir1');
  const fixture = path.join(root, 'examples/view-flow1');
  for (const file of ['easymap.js', 'easymap.css', three]) fs.accessSync(path.join(runtime, file), fs.constants.R_OK);
  fs.accessSync(loader, fs.constants.R_OK);
  fs.accessSync(path.join(fixture, 'synthetic-valve.glb'), fs.constants.R_OK);
  fs.mkdirSync(output, {recursive: true});
  fs.cpSync(runtime, path.join(output, mount), {recursive: true});
  for (const file of ['index.html', 'style.css']) fs.copyFileSync(path.join(example, file), path.join(output, file));
  for (const file of ['check-valve.scene.json', 'synthetic-valve.glb']) fs.copyFileSync(path.join(fixture, file), path.join(output, file));
  await esbuild.build({
    entryPoints: [path.join(example, 'demo.mjs')],
    outfile: path.join(output, 'demo.js'), bundle: true, format: 'esm', target: 'es2022',
    plugins: [{name: 'e8-three', setup(build) {
      build.onResolve({filter: /^three$/}, () => ({path: './' + mount + '/' + three, external: true}));
      build.onResolve({filter: /^three\/addons\/loaders\/GLTFLoader\.js$/}, () => ({path: loader}));
    }}],
  });
  console.log(output);
}

main(process.argv[2], process.argv[3]).catch(error => { console.error(error.message); process.exitCode = 1; });
