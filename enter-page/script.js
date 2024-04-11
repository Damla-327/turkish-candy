import * as THREE from "https://esm.sh/three";
import gsap from "https://esm.sh/gsap";
import { OrbitControls } from 'https://esm.sh/three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'https://esm.sh/three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'https://esm.sh/three/addons/geometries/TextGeometry.js';

const FONT_URL = 'https://esm.sh/three/examples/fonts/optimer_bold.typeface.json';

const canvas = document.querySelector("#canvas");
let D = { w: window.innerWidth, h: window.innerHeight };

let renderer, camera, controls, scene, textMesh, sphere, group;
let envMap, font;

function init() {
    /** Renderer */
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    console.log(renderer)
    renderer.setClearColor(0x000000);
    /** Camera */
    camera = new THREE.PerspectiveCamera(20, D.w / D.h, 0.1, 100);
    camera.position.set(0, -10, 14.5);
    /** Orbit Controls */
    controls = new OrbitControls(camera, renderer.domElement);
    /** Scene */
    scene = new THREE.Scene();
    /** Light */
    const light1 = new THREE.DirectionalLight(0xffffff, 2);
    light1.position.set(5, 2, 2);
    const light3 = new THREE.DirectionalLight(0xffffff, 1);
    light3.position.set(-2, 2, -2);
    scene.add(light1, light3);
    /** Group */
    group = new THREE.Group();
    group.position.y = 0.5;
    scene.add(group);
    /** Load envMap */
    new THREE.TextureLoader().load('https://evanjin.s3.ap-northeast-2.amazonaws.com/console/texture.abstract.64.jpg', _envMap => {
        _envMap.mapping = THREE.EquirectangularReflectionMapping
        envMap = _envMap
        createText()
    });
    /** Load Font */
    new FontLoader().load(FONT_URL, _font => {
        font = _font
        createText()
    });
}

/** Create Sphere */
function createCandy() {
    sphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 32, 32),
        new THREE.MeshStandardMaterial({
            map: envMap,
            metalness: 1,
            normalMap: envMap,
            envMap,
            envMapIntensity: 0.7
        })
    )
    sphere.position.y = 0.5
    group.add(sphere)

    const straw = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 5, 32),
        new THREE.MeshStandardMaterial({
            color: '#fff',
            metalness: 1,
            normalMap: envMap,
            envMap,
            envMapIntensity: 0.7
        })
    )
    straw.position.y = -2.5
    group.add(straw)
}

/** Create text mesh when font is loaded */
function createText() {
    if (!font || !envMap) return

    const textGeo = new TextGeometry('YUMMY CHUPA CHUPS', {
        font: font,
        size: 1,
        height: 0.1,
        curveSegments: 2,
    })
    textGeo.center()
    textGeo.scale(1, 1, 3.5)
    textGeo.rotateY(Math.PI / 2)
    textGeo.rotateZ(Math.PI / 2)
    textGeo.computeBoundingBox();

    textMesh = new THREE.Mesh(textGeo)
    textMesh.scale.x = 0.8
    textMesh.scale.z = 0.8

    splineTextMesh()
    createCandy()
}

/** Spline Text Mesh */
function splineTextMesh() {
    const points = []

    for (let i = 0; i < 100; i += 1) {
        const angle = i / 100 * Math.PI * 2;

        const x = Math.cos(angle) * 2.41;
        const y = 0;
        const z = Math.sin(angle) * 2.41;
        points.push(new THREE.Vector3(x, y, z))
    }

    const curve = new THREE.CatmullRomCurve3(points)
    curve.closed = true

    const cPoints = curve.getPoints(511)
    const cObjects = curve.computeFrenetFrames(511, true)

    const data = []
    cPoints.forEach(v => data.push(v.x, v.y, v.z, 0.0))
    cObjects.binormals.forEach(v => data.push(v.x, v.y, v.z, 0.0))
    cObjects.normals.forEach(v => data.push(v.x, v.y, v.z, 0.0))
    cObjects.tangents.forEach(v => data.push(v.x, v.y, v.z, 0.0))

    const dataTexture = new THREE.DataTexture(
        new Float32Array(data),
        512,
        4,
        THREE.RGBAFormat,
        THREE.FloatType
    )
    dataTexture.magFilter = THREE.NearestFilter
    dataTexture.needsUpdate = true

    const objBox = new THREE.Box3().setFromBufferAttribute(textMesh.geometry.attributes.position);
    const objSize = new THREE.Vector3()
    objBox.getSize(objSize);

    const objUniforms = {
        uSpatialTexture: { value: dataTexture },
        uTextureSize: { value: new THREE.Vector2(512, 4) },
        uTime: { value: 0 },
        uLengthRatio: { value: objSize.z / curve.cacheArcLengths[200] },
        uObjSize: { value: objSize },
    }
    const textMat = new THREE.MeshStandardMaterial({
        map: envMap,
        metalness: 1,
        roughness: 1,
        envMap: envMap,
        envMapIntensity: 0.7,
    })

    textMat.onBeforeCompile = (shader) => {
        shader.uniforms.uSpatialTexture = objUniforms.uSpatialTexture
        shader.uniforms.uTextureSize = objUniforms.uTextureSize
        shader.uniforms.uTime = objUniforms.uTime
        shader.uniforms.uLengthRatio = objUniforms.uLengthRatio
        shader.uniforms.uObjSize = objUniforms.uObjSize

        shader.vertexShader = shader.vertexShader = `
      uniform sampler2D uSpatialTexture;
      uniform vec2 uTextureSize;
      uniform float uTime;
      uniform float uLengthRatio;
      uniform vec3 uObjSize;

      struct splineData {
        vec3 point;
        vec3 binormal;
        vec3 normal;
      };

      splineData getSplineData(float t){
        float step = 1. / uTextureSize.y;
        float halfStep = step * 0.5;
        splineData sd;
        sd.point    = texture2D(uSpatialTexture, vec2(t, step * 0. + halfStep)).rgb;
        sd.binormal = texture2D(uSpatialTexture, vec2(t, step * 1. + halfStep)).rgb;
        sd.normal   = texture2D(uSpatialTexture, vec2(t, step * 2. + halfStep)).rgb;
        return sd;
      }
    ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
        #include <begin_vertex>
        vec3 pos = position;
        float wStep = 1. / (uTextureSize.x);
        float hWStep = wStep * 0.5;
        float d = pos.z / uObjSize.z;
        float t = fract(uTime + (d * uLengthRatio));
        float numPrev = floor(t / wStep);
        float numNext = numPrev + 1.;
        float tPrev = numPrev * wStep + hWStep;
        float tNext = numNext * wStep + hWStep;
        
        splineData splinePrev = getSplineData(tPrev);
        splineData splineNext = getSplineData(tNext);
        float f = (t - tPrev) / wStep;
        
        vec3 P = mix(splinePrev.point, splineNext.point, f);
        vec3 B = mix(splinePrev.binormal, splineNext.binormal, f);
        vec3 N = mix(splinePrev.normal, splineNext.normal, f);
        transformed = P + (N * pos.x) + (B * pos.y);
      `,
        )

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `gl_FragColor += vec4(0.3, 0.0, 0.0, 1.0);`
        )

        textMat.userData.shader = shader
    }

    textMesh.material = textMat

    group.add(textMesh)
}

/** Render Loop */
function tick(t) {
    if (textMesh) {
        textMesh.position.y = Math.sin(t) * 0.3 - 1.5
        textMesh.rotation.x = Math.sin(t) * 0.2
        // textMesh.rotation.z = 0.01
    }

    if (textMesh?.material?.userData?.shader) {
        textMesh.material.userData.shader.uniforms.uTime.value = t * 0.1
    }

    if (sphere) {
        sphere.rotation.y = -t * 0.5
    }

    controls.update()
    renderer.render(scene, camera);
}

/** Resize Handler */
function resize() {
    D = { w: window.innerWidth, h: window.innerHeight };

    renderer.setSize(D.w, D.h);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));

    camera.aspect = D.w / D.h;
    camera.updateProjectionMatrix();
}

init();
resize();
gsap.ticker.add(tick);
window.addEventListener("resize", resize);