import * as THREE from "../node_modules/three/build/three.module.js";

class Skybox {
    constructor(texture, camera, renderer, args) {

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uSkybox: { type: "t", value: texture }
            },
            
            vertexShader: `
                varying vec3 vFragPos;

                void main() {
                    vFragPos = position.xyz;                                    //           v 0.0 v  <-- we don't want translations
                    // gl_Position = projectionMatrix * vec4((modelViewMatrix * vec4(position, 0.0)), 1.0);    

                    vec4 viewSpace = vec4(mat3(modelViewMatrix) * position, 0.0);
                    viewSpace.w = 1.0;
                    gl_Position = projectionMatrix * viewSpace;    
                }`,

            fragmentShader: `
                uniform sampler2D uSkybox;

                varying vec3 vFragPos;

                const float PI = 3.14159265359;

                void main() {

                    vec3 dir = normalize(vFragPos);
                    float v = (asin(dir.y) + PI * 0.5) / (PI); 
                    float u = (atan(dir.x, dir.z) + PI) / (PI * 2.0);

                    gl_FragColor = texture2D(uSkybox, vec2(u, v));
                }`,

            side: THREE.BackSide,
            depthWrite: false,
        });

        this.mesh     = new THREE.Mesh(new THREE.BoxBufferGeometry(10,10,10), this.material);
        this.camera   = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 100 );
        this.mainCamera = camera;
        this.renderer = renderer;

        this.scene = new THREE.Scene();
        this.scene.add(this.mesh);
    }

    render() {
        // I have to do it this way since camera.quaternion is read only
        var vector = new THREE.Vector3( 0, 0, - 1 );
        vector.applyQuaternion( this.mainCamera.quaternion );
        this.camera.lookAt( vector );

        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
    }
}

export { Skybox };