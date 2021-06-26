import './style.css'
import initRegl from 'regl'
import trackFragmentShader from './track.frag?raw'
import skyFragmentShader from './sky.frag?raw'
const regl = initRegl()

interface Props {
  scroll: number
}
const drawTrack = regl({
  frag: trackFragmentShader,
  vert: `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position;
    gl_Position = vec4(position, 0, 1);
  }`,
  attributes: {
    position: [
      [-1, -1],
      [-1, 0],
      [1, 0],
      [1, 0],
      [1, -1],
      [-1, -1]
    ]
  },
  uniforms: {
    scroll: regl.prop<Props, 'scroll'>('scroll')
  },
  count: 6
})

interface Props {
  scroll: number
}
const drawSky = regl({
  frag: skyFragmentShader,
  vert: `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position;
    gl_Position = vec4(position, 0, 1);
  }`,
  attributes: {
    position: [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, 1],
      [1, -1],
      [-1, -1]
    ]
  },
  uniforms: {
    scroll: regl.prop<Props, 'scroll'>('scroll')
  },
  count: 6
})

const scrollSpeed = 0.0005

let time = performance.now()
let scroll = 0
function loop() {
  let t2 = performance.now()
  let dt = t2 - time
  scroll += dt * scrollSpeed
  time = t2
  drawTrack({
    scroll
  })
  drawSky({ scroll })
  requestAnimationFrame(loop)
}

loop()
