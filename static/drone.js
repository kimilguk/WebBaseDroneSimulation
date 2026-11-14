
// 설치: npm install ws express express-ws
// 서버 실행: node server.js
// 접속 주소: http://localhost:8080/
import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';
import {GLTFLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/loaders/DRACOLoader.js';
import {OrbitControls} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/loaders/RGBELoader.js';
import { Sky } from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/objects/Sky.js';
var wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
var ws = new WebSocket(wsProtocol + '//' + window.location.host + '/');

var scene = new THREE.Scene();
// 하늘 설정
const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);

const skyUniforms = sky.material.uniforms;

skyUniforms['turbidity'].value = 5;
skyUniforms['rayleigh'].value = 2;
skyUniforms['mieCoefficient'].value = 0.005;
skyUniforms['mieDirectionalG'].value = 0.5;

// 태양 위치 설정
const sun = new THREE.Vector3();

function updateSunPosition() {
    const theta = Math.PI * (0.45 - 0.5);
    const phi = 2 * Math.PI * (0.25 - 0.5);

    sun.x = Math.cos(phi);
    sun.y = Math.sin(phi) * Math.sin(theta);
    sun.z = Math.sin(phi) * Math.cos(theta);

    sky.material.uniforms['sunPosition'].value.copy(sun);
}

updateSunPosition();
var camera = new THREE.PerspectiveCamera(
    75, window.innerWidth / window.innerHeight, 0.1, 1000);
var renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
var mixer;

// Draco 디코더를 사용하는 GLTF 로더
const rgbeLoader = new RGBELoader();
rgbeLoader.load('/models/cloud_layers_2k.hdr', function (texture) {
  texture.mapping = THREE.EquirectangularReflectionMapping;
});

var drone_two;
var loader = new GLTFLoader();
loader.setDRACOLoader(new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/v1/decoders/'));
var drone;
loader.load(
    '/models/Drone.glb',
    function(gltf) {
      drone = gltf.scene;
      drone.position.y = 0;
      drone.position.x = 0;
      drone.position.z = 0;
      drone.scale.set(5,5,5);
      drone.traverse(function(child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          //child.material.color.setHex(0xffffff, 1);
        }
      });

      scene.add(drone);
      document.querySelector('#reset-button').disabled = false;
      mixer = new THREE.AnimationMixer(drone);
      gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
    },
    undefined,
    function(error) {
      console.error(error);
    });


function scale(value, inMin, inMid, inMax, outMin, outMid, outMax) {
  if (value <= inMid) {
    return (value - inMin) * (outMid - outMin) / (inMid - inMin) + outMin;
  } else {
    return ((value - inMid) * (outMax - outMid) / (inMax - inMid) + outMid);
  }
}

var scan_two;
var scan_three;
var last_yaw = 0;
var camera_yaw = 0;
var camera_pitch = 0;
var droneCameraPitchOffset = 0;
var droneCameraYawOffset = 0;
var cameraMoveMode = false;
var lastCameraMoveSignal = false;
var euler = new THREE.Euler(0, 0, 0, 'YXZ');  // 'YXZ' 회전 순서를 지정합니다.
var quaternion = new THREE.Quaternion();
var pitch = 0;
var desiredAltitude = 0;

// 이전 속도 값을 저장하는 변수
var lastPitchSpeed = 0;
var lastRollSpeed = 0;
var lastThrottleSpeed = 0;

var drone_at_ground_last_x = 0;
var drone_at_ground_last_z = 0;
// 텍스처 추가
var texture = new THREE.TextureLoader().load('/models/ground.jpg');
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.castShadow = false;
texture.repeat.set(5, 5);

loader.load('/models/mount.glb', function(gltf) {
  var mount = gltf.scene;
  mount.position.y = 5;
  mount.position.x = -120;
  mount.position.z = 0;
  mount.scale.set(50,50,50);
  mount.traverse(function(child) {
    if (child.isMesh) {
      child.material.map = texture;
      child.castShadow = false;
      child.receiveShadow = false;
      child.material.color.setHex(0xffffff, 1);
      child.material.side = THREE.DoubleSide;
  
    }

  });

  scene.add(mount);


},
undefined,

function(error) {
  console.error(error);
}
);
loader.load(
    '/models/scan.gltf',
    function(gltf) {
      var scan = gltf.scene;
      scan.position.y = 0;
      scan.position.x = -20;
      scan.position.z = 20;
      scan.rotation.y = Math.PI/2;
      //scene.add(scan);

      scan.traverse(function(child) {
        if (child.isMesh) {
          child.material.color.setHex(0xaaaaaa, 0.5);
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scan_two = scan.clone();
      scan_two.position.set(10, 0, 30); 
      //scene.add(scan_two);

      scan_three = scan.clone();
      scan_three.position.set(-18, 0, 60);
      scan_three.scale.set(0.7, 0.7, 0.7);
      //scene.add(scan_three);
        

    },
    undefined,
    function(error) {
      console.error(error);
    });


  var light = new THREE.AmbientLight(0x888888,1);
  var pointLight = new THREE.PointLight(0xffffff, 0.5, 100);
  pointLight.position.set(10, 20, 10);
  scene.add(light, pointLight);
  
  scene.background = new THREE.Color(0xffffff);
  //scene.add(new THREE.GridHelper(1000, 100, 0x000000, 0x000000));
  scene.add(new THREE.AxesHelper(1000));
 
  scene.fog = new THREE.Fog(0xCCBDC5, 30, 120);
 
  camera.position.set(0, 5, -10);
  var controls = new OrbitControls(camera, renderer.domElement);
  controls.update();

  var bombDropped = false;
  var bombAnimation = false;


  var joystickVertical = document.querySelector('#joystick-vertical');
  var joystickHorizontal = document.querySelector('#joystick-horizontal');
  function applyControls(data) {
    var cameraMoveToggleRequested =
        data.V === true && !lastCameraMoveSignal;
    lastCameraMoveSignal = data.V === true;

    // 앱에서 전송한 E 키 신호 수신 시 resetDrone() 실행
    if (data.E === true) {
      resetDrone();
      return;
    }

    if (data.pitch < 0) {
      data.pitch += 256;
    }
    if (data.roll < 0) {
      data.roll += 256;
    }
    if (data.yaw < 0) {
      data.yaw += 256;
    }
    if (data.throttle < 0) {
      data.throttle += 256;
    }

    // 값 스케일링
    var roll = scale(data.roll, 241, 134, 19, Math.PI / 4, 0, -Math.PI / 4);
    pitch = scale(data.pitch, 17, 134, 243, Math.PI / 4, 0, -Math.PI / 4);
    var yaw = scale(data.yaw, 19, 134, 244, Math.PI, 0, -Math.PI);
    desiredAltitude = scale(data.throttle, 20, 134, 244, 1, 0, -1);

    if (cameraMoveToggleRequested) {
      toggleCameraMoveMode();
    }

    if (cameraMoveMode) {
      droneCameraPitchOffset = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, droneCameraPitchOffset + pitch * 0.01));
      droneCameraYawOffset += yaw * 0.01;
      if (droneCameraYawOffset > Math.PI) {
        droneCameraYawOffset -= 2 * Math.PI;
      }
      if (droneCameraYawOffset < -Math.PI) {
        droneCameraYawOffset += 2 * Math.PI;
      }
    } else {
      // yaw 값을 last_yaw에 더해 갱신
      last_yaw += yaw * 0.01;

      // 수평 이동 계산
      if (last_yaw > Math.PI) {
        last_yaw -= 2 * Math.PI;
      }
      if (last_yaw < -Math.PI) {
        last_yaw += 2 * Math.PI;
      }


      euler.set(pitch, last_yaw, roll);
      quaternion.setFromEuler(euler);
      drone.quaternion.copy(quaternion);

      var forward = new THREE.Vector3(0, 0, 1);
      var right = new THREE.Vector3(-1, 0, 0);
      var up = new THREE.Vector3(0, 1, 0);

      forward.applyQuaternion(quaternion);
      right.applyQuaternion(quaternion);
      up.applyQuaternion(quaternion);


      var pitchSpeed = lastPitchSpeed * 0.99 + pitch * 0.01;
      var rollSpeed = lastRollSpeed * 0.99 + roll * 0.01;
      var throttleSpeed = lastThrottleSpeed * 0.8 + desiredAltitude * 0.2;

      // 갱신된 속도 값으로 드론 위치 업데이트
      drone.position.add(forward.multiplyScalar(pitchSpeed));
      drone.position.add(right.multiplyScalar(rollSpeed));
      drone.position.add(up.multiplyScalar(throttleSpeed));

      lastPitchSpeed = pitchSpeed;
      lastRollSpeed = rollSpeed;
      lastThrottleSpeed = throttleSpeed;

      if (drone.position.y < 0) {
        drone.position.y = 0;
        drone.position.x = drone_at_ground_last_x;
        drone.position.z = drone_at_ground_last_z;

        drone.rotation.x = 0;
        drone.rotation.z = 0;

        drone.traverse(function(child) {
          if (child.isMesh) {
            child.material.color.setHex(0xff0000, 1);
          }
        });
      } else {
        drone_at_ground_last_x = drone.position.x;
        drone_at_ground_last_z = drone.position.z;

        drone.traverse(function(child) {
          if (child.isMesh) {
            child.material.color.setHex(0xffffff, 1);
          }
        });
      }
    }

    if (cameraMoveMode) {
      droneView = true;
      bottomView = false;
      fix_camera = false;
    } else {
      if (data.gear > 10 && data.gear < 20) {
        droneView = true;
        bottomView = false;
        fix_camera = false;
      } else if (data.gear > 20 && data.gear < 50) {
        bottomView = true;
        droneView = false;
        fix_camera = false;
      } else if (data.gear > 50 && data.gear < 70) {
        droneView = false;
        bottomView = false;
        fix_camera = true;
      } else if (data.gear > 70 && data.gear < 90) {
        fix_camera = true;
        droneView = false;
        bottomView = false;
      } else if (data.gear > 90 && data.gear < 110) {
        fix_camera = false;
        droneView = false;
        bottomView = false;
      }
    }
    updateCameraButtons();

    var scaledRoll = scale(roll, Math.PI / 4, 0, -Math.PI / 4, 97, 60, -2);
    var scaledPitch = scale(pitch, Math.PI / 4, 0, -Math.PI / 4, 20, 60, 101);

    var scaledYaw = scale(yaw, Math.PI, 0, -Math.PI, 0, 60, 120);
    var scaledThrottle = scale(desiredAltitude, 1, 0, -1, 0, 60, 120);

    joystickHorizontal.style.left = `${scaledRoll}px`;
    joystickHorizontal.style.top = `${scaledPitch}px`;

    joystickVertical.style.left = `${scaledYaw}px`;
    joystickVertical.style.top = `${scaledThrottle}px`;

    if (data.leftSwitch == -1) {
      bombDropped = true;
      bombAnimation = true;
    }


    if (data.leftSwitch == 0) {
      bombDropped = false;
      bombAnimation = false;
    }
  }

  ws.onmessage = function(event) {
    applyControls(JSON.parse(event.data));
  };

  function mapJoystickAxis(value, negativeValue, positiveValue) {
    return Math.round(value < 0
      ? 134 + -value * (negativeValue - 134)
      : 134 + value * (positiveValue - 134));
  }

  function bindJoystick(container, stick, axes) {
    var activePointerId = null;
    var updateInterval = null;
    var controls = {
      roll: 134,
      pitch: 134,
      yaw: 134,
      throttle: 134,
      leftSwitch: 0,
      gear: 0
    };

    function updateControls(event) {
      var rect = container.getBoundingClientRect();
      var centerX = rect.left + container.clientLeft + container.clientWidth / 2;
      var centerY = rect.top + container.clientTop + container.clientHeight / 2;
      var maxX = (container.clientWidth - stick.offsetWidth) / 2;
      var maxY = (container.clientHeight - stick.offsetHeight) / 2;
      var x = Math.max(-1, Math.min(1, (event.clientX - centerX) / maxX));
      var y = Math.max(-1, Math.min(1, (event.clientY - centerY) / maxY));

      if (axes.horizontal) {
        controls.roll = mapJoystickAxis(x, 19, 241);
        controls.pitch = mapJoystickAxis(y, 17, 243);
      } else {
        controls.yaw = mapJoystickAxis(x, 19, 244);
        controls.throttle = mapJoystickAxis(y, 20, 244);
      }

      applyControls(controls);
    }

    container.addEventListener('pointerdown', function(event) {
      if (activePointerId !== null) {
        return;
      }

      activePointerId = event.pointerId;
      container.setPointerCapture(activePointerId);
      updateControls(event);
      updateInterval = window.setInterval(function() {
        applyControls(controls);
      }, 1000 / 60);
    });

    container.addEventListener('pointermove', function(event) {
      if (event.pointerId === activePointerId) {
        updateControls(event);
      }
    });

    function releasePointer(event) {
      if (event.pointerId !== activePointerId) {
        return;
      }

      window.clearInterval(updateInterval);
      updateInterval = null;
      activePointerId = null;
      controls.roll = 134;
      controls.pitch = 134;
      controls.yaw = 134;
      controls.throttle = 134;
      applyControls(controls);
    }

    container.addEventListener('pointerup', releasePointer);
    container.addEventListener('pointercancel', releasePointer);

    return function() {
      controls.roll = 134;
      controls.pitch = 134;
      controls.yaw = 134;
      controls.throttle = 134;
      applyControls(controls);
    };
  }

  var resetHorizontalJoystick = bindJoystick(
    document.querySelector('#joystick-container-horizontal'),
    joystickHorizontal,
    { horizontal: true }
  );
  var resetVerticalJoystick = bindJoystick(
    document.querySelector('#joystick-container-vertical'),
    joystickVertical,
    { horizontal: false }
  );

      // 제어 데이터 보간 함수
      function interpolateData(data, steps) {
        const interpolatedData = [];

        for (let i = 0; i < data.length - 1; i++) {
          const start = data[i];
          const end = data[i + 1];

          for (let j = 0; j < steps; j++) {
            const t = j / steps;
            const interpolatedControl = {
              roll: start.roll + t * (end.roll - start.roll),
              pitch: start.pitch + t * (end.pitch - start.pitch),
              yaw: start.yaw + t * (end.yaw - start.yaw),
              throttle: start.throttle + t * (end.throttle - start.throttle)
            };

            interpolatedData.push(interpolatedControl);
          }
        }

        return interpolatedData;
      }

      // Fetch the controls and interpolate them
      fetch('/controls.json')
          .then(response => {
            if (!response.ok) {
              throw new Error('Network response was not ok');
            }
            return response.json();
          })
          .then(controlsArray => {
            interpolatedControls = interpolateData(controlsArray, 10);
          })
          .catch(error => {
            console.error('Failed to fetch file:', error);
          });



  var speed = 0;
  var lastPosition = new THREE.Vector3();

  function updateInfo() {
    var speedElement = document.getElementById('speed');
    var positionElement = document.getElementById('position');

    // 마지막 프레임 이후 이동한 거리를 기준으로 속도 계산
    var distance = drone.position.distanceTo(lastPosition);
    speed = distance / (1 / 60);  // animate 함수가 초당 60프레임으로 실행된다고 가정

    speedElement.innerText = 'Speed: ' + speed.toFixed(2);
    positionElement.innerText = 'Position: (' + drone.position.x.toFixed(2) +
        ', ' + drone.position.y.toFixed(2) + ', ' +
        drone.position.z.toFixed(2) + ')';
  }

var cameraoffset = new THREE.Vector3(10, 10, -10);
var cameraLerpFactor = 0.005; // 보간 속도 제어 (0.05부터 시작하는 것이 좋습니다.)

function resetDrone() {
  if (!drone) {
    return;
  }

  drone.position.set(0, 0, 0);
  drone.quaternion.identity();
  droneView = false;
  bottomView = false;
  fix_camera = false;
  cameraMoveMode = false;
  updateCameraButtons();
  last_yaw = 0;
  pitch = 0;
  droneCameraPitchOffset = 0;
  droneCameraYawOffset = 0;
  desiredAltitude = 0;
  lastPitchSpeed = 0;
  lastRollSpeed = 0;
  lastThrottleSpeed = 0;
  drone_at_ground_last_x = 0;
  drone_at_ground_last_z = 0;
  lastPosition.set(0, 0, 0);
  bombDropped = false;
  bombAnimation = false;
  camera.position.copy(cameraoffset);
  camera.lookAt(drone.position);
  resetHorizontalJoystick();
  resetVerticalJoystick();
}

document.querySelector('#reset-button').addEventListener('click', resetDrone);


// 조이스틱

var clock = new THREE.Clock();

var droneCamera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000);
droneCamera.position.set(0, 2, -5); // droneCamera를 드론 뒤쪽에 배치

var droneCameraTwo = droneCamera.clone();


var droneView = false;  // 기본적으로 메인 카메라 시점 사용
var bottomView = false;  // 드론 아래쪽 시점 사용
var fix_camera = false;  // 고정 카메라 사용 여부

function updateCameraButtons() {
  document.querySelector('#drone-camera-button')
      .setAttribute('aria-pressed', String(droneView));
  document.querySelector('#bottom-camera-button')
      .setAttribute('aria-pressed', String(bottomView));
  document.querySelector('#camera-move-button')
      .setAttribute('aria-pressed', String(cameraMoveMode));
}

function toggleDroneView() {
  if (cameraMoveMode) {
    cameraMoveMode = false;
    lastPitchSpeed = 0;
    lastRollSpeed = 0;
    lastThrottleSpeed = 0;
  }
  droneView = !droneView;
  bottomView = false;
  updateCameraButtons();
}

function toggleBottomView() {
  if (cameraMoveMode) {
    cameraMoveMode = false;
    lastPitchSpeed = 0;
    lastRollSpeed = 0;
    lastThrottleSpeed = 0;
  }
  bottomView = !bottomView;
  droneView = false;
  updateCameraButtons();
}

function toggleCameraMoveMode() {
  cameraMoveMode = !cameraMoveMode;
  if (cameraMoveMode) {
    droneView = true;
    bottomView = false;
    fix_camera = false;
    lastPitchSpeed = 0;
    lastRollSpeed = 0;
    lastThrottleSpeed = 0;
  }
  updateCameraButtons();
}

document.querySelector('#drone-camera-button')
    .addEventListener('click', toggleDroneView);
document.querySelector('#bottom-camera-button')
    .addEventListener('click', toggleBottomView);
document.querySelector('#camera-move-button')
    .addEventListener('click', toggleCameraMoveMode);

window.addEventListener('keydown', function(event) {
  if (event.key === 'C' || event.key === 'c') {
    toggleDroneView();
  } else if (event.key === 'M' || event.key === 'm') {
    toggleBottomView();
  }
});

window.addEventListener('keydown', function(event) {
  if (event.key === 'E' || event.key === 'e') {
    resetDrone();
  } 
});

window.addEventListener('keydown', function(event) {
  if (!event.repeat && (event.key === 'V' || event.key === 'v')) {
    toggleCameraMoveMode();
  }
});

var bomb;
var mixerbomb;
loader.load(
    '/models/bomb2.glb',
    function(gltf) {
      bomb = gltf.scene;
      bomb.scale.set(0.1,0.1,0.1);
      bomb.position.set(0, -0.2, 0); // 초기 위치는 원점
      scene.add(bomb);

          // AnimationMixer 인스턴스를 만들고 드론에 연결
          mixerbomb = new THREE.AnimationMixer(bomb);
  
          // glTF 모델에서 모든 애니메이션 가져오기
          gltf.animations.forEach((clip) => {
              // 각 애니메이션의 AnimationAction을 만들고 재생
              mixerbomb.clipAction(clip).play();
          });
          document.querySelector('#bomb-button').disabled = false;

    },
    undefined,
    function(error) {
      console.error(error);
    });



function dropBomb() {
  if (!bomb) {
    return;
  }

  bombDropped = true;
  bombAnimation = true;
}

document.querySelector('#bomb-button').addEventListener('click', dropBomb);

window.addEventListener('keydown', function(event) {
  if (event.key === 'B' || event.key === 'b') {
    dropBomb();
  }
});


// animate 함수 내부
var animate = function() {
  requestAnimationFrame(animate);


  var activeCamera;
  if (droneView) {
    activeCamera = droneCamera;
  } else if (bottomView) {
    activeCamera = droneCameraTwo;
  } else {
    activeCamera = camera;
  }

  if (droneView) {
    // 카메라를 드론과 같은 위치에 배치
    droneCamera.position.copy(drone.position);

    // 카메라 회전 설정
    var cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    var cameraQuaternion = new THREE.Quaternion();

    // 특히 pitch와 yaw 각도를 사용해 카메라 방향 설정
    // 드론의 yaw 각도와 필요에 따라 pitch 각도를 사용할 수 있습니다.
    // Roll은 보통 짐벌 카메라에서 안정화하므로 변경하지 않습니다.
    camera_yaw = last_yaw + Math.PI;
    cameraEuler.set(
        droneCameraPitchOffset, camera_yaw + droneCameraYawOffset,
        0);  // yaw 각도만 사용해 카메라 회전
    cameraQuaternion.setFromEuler(cameraEuler);

    // 카메라 쿼터니언 설정
    droneCamera.quaternion.copy(cameraQuaternion);

    // 카메라 추가 조정
    // 예를 들어 카메라를 약간 뒤쪽과 위쪽으로 이동해 드론이 시야에
    // 들어오도록 할 수 있습니다.
    droneCamera.position.add(
        new THREE.Vector3(0, -0.3, 0.8).applyQuaternion(drone.quaternion));

  } else if (bottomView) {
    droneCameraTwo.position.copy(drone.position);
    droneCameraTwo.position.y -= 0.2;  // 카메라를 드론 위쪽에 배치
    droneCameraTwo.position.z -= 0.2;  // 카메라를 드론 뒤쪽에 배치
    // 카메라 회전 설정
    var cameraEulerBomb = new THREE.Euler(0, 0, 0, 'YXZ');
    var cameraQuaternionBomb = new THREE.Quaternion();

    camera_yaw = last_yaw + Math.PI;
    camera_pitch = -Math.PI / 2;
    cameraEulerBomb.set(
        camera_pitch, camera_yaw,
        0);  // yaw 각도만 사용해 카메라 회전
    cameraQuaternionBomb.setFromEuler(cameraEulerBomb);

    // 카메라 쿼터니언 설정
    droneCameraTwo.quaternion.copy(cameraQuaternionBomb);
  } else if (fix_camera) {
    camera.position.set(0, 5, -10);
    camera.lookAt(drone.position);
  } else {
    camera.lookAt(drone.position);
  }

  var deltaTime = clock.getDelta();
  if (mixer) {
    mixer.update(scale(desiredAltitude, -1, 0, 1, 0, 0.5, 5));
  }

  var targetPosition = new THREE.Vector3();
  targetPosition.copy(drone.position).add(cameraoffset);

  // 카메라 위치를 목표 위치로 보간
  if (!droneView) {
    camera.position.lerp(targetPosition, cameraLerpFactor);
  }

  if (!bombDropped) {
    bomb.position.copy(drone.position);
    bomb.position.y -= 0.4;
    bomb.position.z -= 0.1;
    bomb.quaternion.copy(drone.quaternion);
  }

  if (bombDropped) {
    bomb.position.y -= 0.1;  // 폭탄 낙하 속도를 조절하려면 이 값을 변경
    if (bomb.position.y <= 0) {
      bomb.position.y = 0;
    }
  }

  if (bomb.position.y == 0 && bombAnimation) {
    mixerbomb.update(deltaTime * drone.position.y * 0.5);
  } else {
    mixerbomb.update(0);
  }

  renderer.render(scene, activeCamera);
  updateInfo();
};

animate();
