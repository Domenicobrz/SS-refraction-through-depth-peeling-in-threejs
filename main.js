import * as THREE from "./node_modules/three/build/three.module.js";
import { OrbitControls } from "./node_modules/three/examples/jsm/controls/OrbitControls.js"; //'three/examples/jsm/controls/OrbitControls.js';
import { DoubleDepthBuffer } from "./programs/doubleDepthBuffer.js";
import { Blit } from "./programs/blit.js";
import { Skybox } from "./programs/skybox.js";
import { SSRTGlass } from "./programs/ssrtGlass.js";
import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import * as dat   from "../node_modules/dat.gui/build/dat.gui.module.js";

window.addEventListener("load", init);

let scene; 
let camera;
let controls;
let renderer;


let ddbProgram;
let blitProgram;
let skyboxProgram;
let ssrtGlassProgram;

let dlCount = 0;


function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild( renderer.domElement );

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 100 );

    controls = new OrbitControls( camera, renderer.domElement );
    controls.enableDamping = true;
	controls.dampingFactor = 0.0375;
    controls.enablePan = true;
	controls.panSpeed = 0.5;
    controls.screenSpacePanning = true;
    
    //controls.update() must be called after any manual changes to the camera's transform
    camera.position.set( 0, 5, -10 );
    controls.target.set( 0, 2, 0 );
    controls.update();



    let path = "assets/aerodynamics_workshop.jpg";
    // path = "assets/wooden_motel_4k.jpg";
    // path = "assets/reading_room.jpg";
    // path = "assets/birbeck_street_underpass.jpg";
    // path = "assets/sculpture_exhibition.jpg";
    path = "assets/aerodynamics_workshop_blur3.jpg";

    let radpath = path;
    radpath = "assets/aerodynamics_workshop.jpg";
    // radpath = "assets/sculpture_exhibition.jpg";
    // radpath = "assets/birbeck_street_underpass.jpg";

    // here's a list of good ones:
    let skybox = new THREE.TextureLoader().load(path, function(texture) {
        // ************    necessary to avoid seams in the equirectangular map !!    ***************
        texture.generateMipmaps = false;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        // ************ necessary to avoid seams in the equirectangular map !! - END ***************

        skybox = texture;
        onDlComplete();
    });

    let radbox = new THREE.TextureLoader().load(radpath, function(texture) {
        radbox = texture;
        radbox.wrapS = THREE.ClampToEdgeWrapping;
        radbox.wrapT = THREE.ClampToEdgeWrapping;
        radbox.magFilter = THREE.LinearMipmapLinearFilter;
        radbox.minFilter = THREE.LinearMipmapLinearFilter;
        onDlComplete();
    });

    let mesh;
    new GLTFLoader().load("assets/statue.glb",
        function ( gltf ) {
            mesh = gltf.scene.children[0];
            mesh.position.set(0,0,0);
            // mesh.rotation.x = Math.PI * 0.5;
            mesh.scale.set(2, 2, 2);
            // necessary since the mesh by default is rotated
            mesh.rotation.set(0,0,0);

            // manually recalculating normals & positions
            mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    let normals = child.geometry.attributes.normal.array;
                    for(let i = 0; i < normals.length; i+=3) {
                        let temp = normals[i+2];
                        normals[i+2] = normals[i+1]; 
                        normals[i+1] = -temp;
                    }

                    let positions = child.geometry.attributes.position.array;
                    for(let i = 0; i < positions.length; i+=3) {
                        let temp = positions[i+2];
                        positions[i+2] = positions[i+1]; 
                        positions[i+1] = -temp;
                    }
                }
            }); 

            onDlComplete();
        }
    );


    function onDlComplete() {
        dlCount++;
        if(dlCount < 3) return;

        // ************** THIS MESH IS CLONED INSIDE DDB & SSRT **************
        // let mesh = new THREE.Mesh(
        //     // new THREE.SphereBufferGeometry(0.5,15,15),
        //     // new THREE.BoxBufferGeometry(2,2,2),
        //     new THREE.TorusKnotBufferGeometry( 1, 0.45, 100, 16 ),
        //     new THREE.MeshBasicMaterial({ color: 0xff0000 })
        // );
        scene.add(mesh);
        // ************** THIS MESH IS CLONED INSIDE DDB & SSRT - END **************


    
    
        blitProgram      = new Blit(renderer, "gl_FragColor = vec4(texture2D(uTexture, vUv).www, 1.0);");
        ddbProgram       = new DoubleDepthBuffer(mesh, camera, renderer);
        skyboxProgram    = new Skybox(skybox, camera, renderer);
        ssrtGlassProgram = new SSRTGlass(mesh, radbox, camera, renderer);
    
        initGUI();
        animate();
    }
}

function animate(now) {
    now *= 0.001;

    requestAnimationFrame( animate );

    controls.update();  

    skyboxProgram.render();
    ddbProgram.compute(6);
    ssrtGlassProgram.render(now, ddbProgram.getBackFaceTexture(), ddbProgram.getFrontFaceTexture());
}


function initGUI() {
    var FizzyText = function() {
        // this.extintionColor1 = [255 - Math.floor(0.25 * 255), 255 - Math.floor(0.7 * 255),  255 - Math.floor(0.9 * 255)];
        this.extintionColor1 = [192, 123, 25];
        this.extintionColor2 = [255 - Math.floor(0.9 * 255), 255 - Math.floor(0.35 * 255),  255 - Math.floor(0.25 * 255)];
        this.extintionFactor = 5;
        this.reflectionFactor = 1;
        this.exposure = 0;
        this.extintionCol1Random = false;
        this.extintionCol2Random = false;
        this.waveRaymarch = false;
        this.targRadMult = 1.0;
        this.copy = () => {
            ssrtGlassProgram.material.uniforms.uExtintionColor2.value.x = (1 - this.extintionColor1[0] / 255);
            ssrtGlassProgram.material.uniforms.uExtintionColor2.value.y = (1 - this.extintionColor1[1] / 255);
            ssrtGlassProgram.material.uniforms.uExtintionColor2.value.z = (1 - this.extintionColor1[2] / 255);
        };
        this.uncopy = () => {
            ssrtGlassProgram.material.uniforms.uExtintionColor2.value.x = (1 - this.extintionColor2[0] / 255);
            ssrtGlassProgram.material.uniforms.uExtintionColor2.value.y = (1 - this.extintionColor2[1] / 255);
            ssrtGlassProgram.material.uniforms.uExtintionColor2.value.z = (1 - this.extintionColor2[2] / 255);
        };
    };
    
    var text = new FizzyText();

    var gui = new dat.GUI();
    gui.add(text, 'extintionFactor', 0, 10).onChange((value) => {
        ssrtGlassProgram.material.uniforms.uExtintionFactor.value = value;
    });
    gui.add(text, 'reflectionFactor', 0, 2).onChange((value) => {
        ssrtGlassProgram.material.uniforms.uReflectionFactor.value = value;
    });
    gui.add(text, 'exposure', -1, 2).onChange((value) => {
        ssrtGlassProgram.material.uniforms.uExposure.value = value;
    });
    gui.addColor(text, 'extintionColor1').onChange((value) => {
        ssrtGlassProgram.material.uniforms.uExtintionColor1.value.x = (1 - value[0] / 255);
        ssrtGlassProgram.material.uniforms.uExtintionColor1.value.y = (1 - value[1] / 255);
        ssrtGlassProgram.material.uniforms.uExtintionColor1.value.z = (1 - value[2] / 255);
    });
    gui.addColor(text, 'extintionColor2').onChange((value) => {
        ssrtGlassProgram.material.uniforms.uExtintionColor2.value.x = (1 - value[0] / 255);
        ssrtGlassProgram.material.uniforms.uExtintionColor2.value.y = (1 - value[1] / 255);
        ssrtGlassProgram.material.uniforms.uExtintionColor2.value.z = (1 - value[2] / 255);
    });
    gui.add(text, 'copy');
    gui.add(text, 'uncopy');
    var fx = gui.addFolder("FX");
    fx.add(text, 'extintionCol1Random').onChange((value) => {
        ssrtGlassProgram.material.uniforms.uExtinctionFX1.value.x = value ? 1 : 0;
    });
    fx.add(text, 'extintionCol2Random').onChange((value) => {
        ssrtGlassProgram.material.uniforms.uExtinctionFX1.value.y = value ? 1 : 0;
    });
    fx.add(text, 'waveRaymarch').onChange((value) => {
        ssrtGlassProgram.material.uniforms.uExtinctionFX1.value.z = value ? 1 : 0;
    });
    fx.add(text, 'targRadMult', 0, 2).onChange((value) => {
        ssrtGlassProgram.material.uniforms.uExtinctionFX1.value.w = value;
    });
    fx.open();
}