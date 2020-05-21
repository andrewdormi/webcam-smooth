import React, {useEffect, useRef, useState} from 'react';
import * as THREE from "three";
import './App.css';

let camera, scene, renderer, uniforms;

function App() {
    const [sigma, setSigma] = useState(10.0);
    const [radius, setRadius] = useState(1);
    const [threshold, setThreshold] = useState(0.05);

    const _video = useRef();
    const _canvas = useRef();

    const render = () => {
        const vid = _video.current;
        const width = vid.videoWidth
        const height = vid.videoHeight;
        if (!width || !height) {
            return;
        }
        if (!camera) {
            camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);
            camera.position.z = 1;
            scene = new THREE.Scene();

            const context = _canvas.current.getContext('webgl2', {alpha: false});
            renderer = new THREE.WebGLRenderer({
                alpha: true,
                antialias: true,
                canvas: _canvas.current,
                context: context
            });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(width, height);

            const texture = new THREE.VideoTexture(vid);
            const geometry = new THREE.PlaneGeometry(width, height);

            uniforms = {
                iChannel0: {type: "t", value: texture},
                resolution: {type: 'v2', value: new THREE.Vector2(width * 2, height * 2)},
                sigma: {type: "f", value: sigma},
                radius: {type: "f", value: radius},
                threshold: {type: "f", value: threshold},
            };
            const shaderMaterial = new THREE.ShaderMaterial({
                uniforms,
                fragmentShader: document.getElementById('fs').textContent.trim(),
                transparent: true,
                depthTest: false
            });
            shaderMaterial.needsUpdate = true;
            const mesh = new THREE.Mesh(geometry, shaderMaterial);
            scene.add(mesh);

        }
        renderer.render(scene, camera);
    }
    const update = (stream) => {
        requestAnimationFrame(() => update(stream));
        render(stream);
    };
    useEffect(() => {
        (async () => {
            const stream = await navigator.mediaDevices.getUserMedia({video: true});
            _video.current.srcObject = stream;
            update(stream);
        })()
    }, []);

    return (
        <div className="App">
            <div>
                <div><b>original</b></div>
                <video ref={_video} autoPlay playsInline/>
            </div>
            <div>
                <div><b>shader</b></div>
                <canvas ref={_canvas}/>
                <div>sigma</div>
                <input type="range" min="0" max="10" step="0.1"
                       value={sigma}
                       onChange={e => {
                           setSigma(e.target.value);
                           uniforms.sigma.value = e.target.value;
                       }}/>
                {sigma}
                <div>radius</div>
                <input type="range" min="0" max="10" step="0.1"
                       value={radius}
                       onChange={e => {
                           setRadius(e.target.value);
                           uniforms.radius.value = e.target.value;
                       }}/>
                {radius}
                <div>threshold</div>
                <input type="range" min="0" max="1" step="0.01"
                       value={threshold}
                       onChange={e => {
                           setThreshold(e.target.value);
                           uniforms.threshold.value = e.target.value;
                       }}/>
                {threshold}
            </div>
            <script id="fs" type="x-shader/x-fragment">
                {`
#define INV_SQRT_OF_2PI 0.39894228040143267793994605993439 // 1.0/SQRT_OF_2PI
#define INV_PI 0.31830988618379067153776752674503
uniform vec2      resolution;
uniform sampler2D iChannel0;
uniform float  sigma;
uniform float  radius;
uniform float  threshold;

vec4 smartDeNoise(sampler2D tex, vec2 uv, float sigma, float kSigma, float threshold)
{
    float radius = round(kSigma*sigma);
    float radQ = radius * radius;

    float invSigmaQx2 = .5 / (sigma * sigma);      // 1.0 / (sigma^2 * 2.0)
    float invSigmaQx2PI = INV_PI * invSigmaQx2;    // 1.0 / (sqrt(PI) * sigma)

    float invThresholdSqx2 = .5 / (threshold * threshold);     // 1.0 / (sigma^2 * 2.0)
    float invThresholdSqrt2PI = INV_SQRT_OF_2PI / threshold;   // 1.0 / (sqrt(2*PI) * sigma)

    vec4 centrPx = texture(tex,uv);

    float zBuff = 0.0;
    vec4 aBuff = vec4(0.0);
    vec2 size = vec2(textureSize(tex, 0));

    for(float x=-radius; x <= radius; x++) {
        float pt = sqrt(radQ-x*x);  // pt = yRadius: have circular trend
        for(float y=-pt; y <= pt; y++) {
            vec2 d = vec2(x,y);

            float blurFactor = exp( -dot(d , d) * invSigmaQx2 ) * invSigmaQx2PI;

            vec4 walkPx =  texture(tex,uv+d/size);

            vec4 dC = walkPx-centrPx;
            float deltaFactor = exp( -dot(dC, dC) * invThresholdSqx2) * invThresholdSqrt2PI * blurFactor;

            zBuff += deltaFactor;
            aBuff += deltaFactor*walkPx;
        }
    }
    return aBuff/zBuff;
}

void main( void )
{
    vec2 pos = gl_FragCoord.xy / resolution.xy;
     //gl_FragColor = vec4(1.0,pos.x,pos.y,1.0);
    //vec2 uv = vec2(gl_FragCoord.xy / wSize);
    gl_FragColor = smartDeNoise(iChannel0, vec2(pos.x,pos.y), sigma, radius, threshold);
    //gl_FragColor = texture2D( iChannel0, gl_FragCoord.xy );
}
                `}
            </script>
        </div>
    );
}

export default App;
