const { createHash } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const RELEASE = {
  assembled: 'c7e6231e50028f8e1a1966f6b40b98961ffbeb80b4a99795ee1bafe0b544cf4b',
  exploded: 'd8c1d67f4d193895742646e76ce0211a777b2e0f05a1681047a79049fa17640d',
};
const INLET = 'Valve_Body_Inlet_Female';
const PARTS = [
  INLET, 'Valve_Seal_Ring', 'Valve_Disc_Rubber',
  'Valve_Spring', 'Valve_Cage_Black', 'Valve_Body_Outlet_Male',
];
const UNSCREW_END = 3.75;
const SCREW_START = 14.75;

async function readPose(io, sourceDir, pose) {
  const filename = path.join(sourceDir, `check_valve_${pose}.glb`);
  const bytes = await readFile(filename);
  if (createHash('sha256').update(bytes).digest('hex') !== RELEASE[pose]) {
    throw new Error(`Expected the approved v1.0.2 ${pose} GLB at ${filename}`);
  }
  return io.readBinary(bytes);
}

function attachTrack(document, clip, node, targetPath, input, output, interpolation) {
  const sampler = document.createAnimationSampler().setInput(input).setOutput(output)
    .setInterpolation(interpolation);
  const channel = document.createAnimationChannel()
    .setTargetNode(node).setTargetPath(targetPath).setSampler(sampler);
  clip.addSampler(sampler).addChannel(channel);
}

function addTrack(document, buffer, clip, node, targetPath, input, closed, spread) {
  const size = closed.length;
  const keyframes = [closed, closed, spread, spread, closed, closed];
  // glTF cubic keys store in-tangent, value, out-tangent. Zero tangents ease into each hold.
  const samples = new Float32Array(keyframes.length * size * 3);
  keyframes.forEach((value, index) => samples.set(value, (index * 3 + 1) * size));
  const output = document.createAccessor('', buffer)
    .setType(size === 1 ? 'SCALAR' : 'VEC3').setArray(samples);
  attachTrack(document, clip, node, targetPath, input, output, 'CUBICSPLINE');
}

function addInletMotion(document, buffer, clip, node, spread) {
  const [closedX, y, z] = node.getTranslation();
  const releasedX = closedX - .009;
  // Two full turns make the 9 mm of engagement readable at 30 fps.
  const releasedTurns = -2;
  const stops = [
    [0, closedX, 0], [2.5, closedX, 0],
    [UNSCREW_END, releasedX, releasedTurns], [5, spread[0], releasedTurns],
    [13.6, spread[0], releasedTurns], [SCREW_START, releasedX, releasedTurns],
    [16, closedX, 0], [19, closedX, 0],
  ];
  const times = [], translations = [], rotations = [];
  function sample(time, x, turns) {
    const angle = Math.PI * turns;
    times.push(time);
    translations.push(x, y, z);
    rotations.push(Number.isInteger(turns) ? 0 : Math.sin(angle), 0, 0, Math.cos(angle));
  }
  for (let i = 1; i < stops.length; i++) {
    const [start, fromX, fromTurns] = stops[i - 1];
    const [end, toX, toTurns] = stops[i];
    // Shared samples couple axial travel to rotation and keep consecutive quaternions close.
    const samples = fromX === toX ? 1 : Math.ceil((end - start) * 30);
    for (let step = 0; step < samples; step++) {
      const t = step / samples;
      const ease = t * t * (3 - 2 * t);
      sample(start + t * (end - start), fromX + ease * (toX - fromX), fromTurns + ease * (toTurns - fromTurns));
    }
  }
  sample(...stops.at(-1));
  const input = document.createAccessor('Inlet_Time', buffer).setType('SCALAR')
    .setArray(new Float32Array(times));
  const position = document.createAccessor('', buffer).setType('VEC3')
    .setArray(new Float32Array(translations));
  const rotation = document.createAccessor('', buffer).setType('VEC4')
    .setArray(new Float32Array(rotations));
  attachTrack(document, clip, node, 'translation', input, position, 'LINEAR');
  attachTrack(document, clip, node, 'rotation', input, rotation, 'LINEAR');
}

function addReleasedSpring(document, buffer, closed, spread) {
  const mesh = closed.getMesh();
  const [installed] = mesh.listPrimitives();
  const [released] = spread.getMesh().listPrimitives();
  const target = document.createPrimitiveTarget('Spring_Released');
  // Both spring exports share index order. Their wire contours differ along X.
  for (const semantic of ['POSITION', 'NORMAL']) {
    const base = installed.getAttribute(semantic).getArray();
    const next = released.getAttribute(semantic).getArray();
    const delta = Float32Array.from(base, (value, index) => next[index] - value);
    target.setAttribute(semantic, document.createAccessor('', buffer).setType('VEC3').setArray(delta));
  }
  installed.addTarget(target);
  mesh.setWeights([0]);
}

async function main() {
  const { NodeIO } = await import('@gltf-transform/core');
  const io = new NodeIO();
  const sourceDir = process.argv[2] ?? path.resolve(__dirname,
    '../../../../3wa_3D_Assets/props/view-valve1-check-valve/glb');
  const [document, exploded] = await Promise.all([
    readPose(io, sourceDir, 'assembled'), readPose(io, sourceDir, 'exploded'),
  ]);
  const root = document.getRoot();
  const [buffer] = root.listBuffers();
  for (const clip of root.listAnimations()) clip.dispose();
  const clip = document.createAnimation('Valve_Disassemble_Assemble');
  const inner = document.createAccessor('Internal_Parts_Time', buffer).setType('SCALAR')
    .setArray(new Float32Array([0, UNSCREW_END, 5, 12, 14.7, 19]));
  const outlet = document.createAccessor('Outlet_Time', buffer).setType('SCALAR')
    .setArray(new Float32Array([0, UNSCREW_END, 5, 13.6, SCREW_START, 19]));
  const closedNodes = root.listNodes();
  const spreadNodes = exploded.getRoot().listNodes();
  for (const name of PARTS) {
    const closed = closedNodes.find(node => node.getName() === name);
    const spread = spreadNodes.find(node => node.getName() === name);
    if (name === INLET) {
      addInletMotion(document, buffer, clip, closed, spread.getTranslation());
      continue;
    }
    const input = name.startsWith('Valve_Body_') ? outlet : inner;
    addTrack(document, buffer, clip, closed, 'translation', input, closed.getTranslation(), spread.getTranslation());
    if (name === 'Valve_Spring') {
      addReleasedSpring(document, buffer, closed, spread);
      addTrack(document, buffer, clip, closed, 'weights', input, [0], [1]);
    }
  }
  const output = path.join(__dirname, 'check_valve_assembly_demo.glb');
  await io.write(output, document);
  console.log(output);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
