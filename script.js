let scene, camera, renderer, controls;
let currentModel = null;
let grid, dirLight, ambientLight;
let showWireframe = false;

const loaders = {
  gltf: new THREE.GLTFLoader(),
  obj: new THREE.OBJLoader(),
  fbx: new THREE.FBXLoader(),
  stl: new THREE.STLLoader(),
  ply: new THREE.PLYLoader(),
  m3f: new THREE.ThreeMFLoader()
};

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5);

  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(0, 3, 8);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  grid = new THREE.GridHelper(20, 20);
  grid.material.opacity = 0.4;
  grid.material.transparent = true;
  scene.add(grid);

  dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  fileInput.onchange = loadFile;
  resetBtn.onclick = resetScene;
  gridToggle.oninput = e => grid.visible = e.target.checked;
  wireToggle.oninput = e => toggleWireframe(e.target.checked);
  lightColor.oninput = e => dirLight.color.set(e.target.value);
  dirIntensity.oninput = e => dirLight.intensity = e.target.value;
  ambIntensity.oninput = e => ambientLight.intensity = e.target.value;

  exportBtn.onclick = exportModel;

  initTheme();
}

function initTheme() {
  const btn = document.getElementById("btnSwitch");

  btn.addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.getAttribute("data-bs-theme") === "dark";
    root.setAttribute("data-bs-theme", dark ? "light" : "dark");
    syncSceneTheme(!dark);
    localStorage.setItem("theme", dark ? "light" : "dark");
  });

  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-bs-theme", saved);
  btn.checked = saved === "dark";
  syncSceneTheme(saved === "dark");
}

function syncSceneTheme(dark) {
  scene.background.set(dark ? 0x121212 : 0xf5f5f5);
  grid.material.color.set(dark ? 0x444444 : 0x888888);
  grid.material.opacity = dark ? 0.25 : 0.4;
  dirLight.intensity = dark ? 0.8 : 1;
  ambientLight.intensity = dark ? 0.6 : 0.4;
}

function loadFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  resetScene();

  const ext = file.name.split(".").pop().toLowerCase();
  const reader = new FileReader();

  if (ext === "obj") {
    reader.onload = ev => prepare(loaders.obj.parse(ev.target.result));
    reader.readAsText(file);
    return;
  }

  reader.onload = ev => {
    if (ext === "gltf" || ext === "glb")
      loaders.gltf.parse(ev.target.result, "", g => prepare(g.scene));
    else if (ext === "fbx")
      prepare(loaders.fbx.parse(ev.target.result));
    else if (ext === "stl")
      prepare(new THREE.Mesh(
        loaders.stl.parse(ev.target.result),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
      ));
    else if (ext === "ply")
      prepare(loaders.ply.parse(ev.target.result));
    else if (ext === "3mf")
      prepare(loaders.m3f.parse(ev.target.result));
  };

  reader.readAsArrayBuffer(file);
}

function prepare(obj) {
  if (!obj.isObject3D)
    obj = new THREE.Mesh(obj, new THREE.MeshStandardMaterial());

  obj.traverse(o => o.isMesh && (o.material.wireframe = showWireframe));

  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());

  obj.position.sub(center);
  obj.scale.multiplyScalar(4 / size);

  const scaledBox = new THREE.Box3().setFromObject(obj);
  obj.position.y -= scaledBox.min.y;

  currentModel = obj;
  scene.add(obj);
  updateStats(obj);

  const finalBox = new THREE.Box3().setFromObject(obj);
  const finalCenter = finalBox.getCenter(new THREE.Vector3());
  const finalSize = finalBox.getSize(new THREE.Vector3());

  controls.target.copy(finalCenter);
  controls.update();

  const maxDim = Math.max(finalSize.x, finalSize.y, finalSize.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

  camera.position.set(
    finalCenter.x,
    finalCenter.y + maxDim * 0.5,
    finalCenter.z + cameraZ
  );
  camera.lookAt(finalCenter);

  grid.position.x = finalCenter.x;
  grid.position.z = finalCenter.z;

  // Enable export button
  setExportEnabled(true);
}

function toggleWireframe(enabled) {
  showWireframe = enabled;
  currentModel?.traverse(o => o.isMesh && (o.material.wireframe = enabled));
}

function resetScene() {
  if (!currentModel) return;
  scene.remove(currentModel);
  currentModel = null;
  updateStats({ traverse: () => {} });
  setExportEnabled(false);
  exportNote.style.display = "none";
}

function updateStats(obj) {
  let m = 0, v = 0, t = 0;
  obj.traverse(o => {
    if (o.isMesh) {
      m++;
      const p = o.geometry.attributes.position;
      v += p.count;
      t += o.geometry.index ? o.geometry.index.count / 3 : p.count / 3;
    }
  });
  meshCount.textContent = m;
  vertexCount.textContent = v;
  triangleCount.textContent = t;
}

// ─── Export ───────────────────────────────────────────────────────────────────

function setExportEnabled(enabled) {
  exportBtn.disabled = !enabled;
  exportBtn.classList.toggle('btn-success', enabled);
  exportBtn.classList.toggle('btn-dark', !enabled);
  exportBtnText.style.textDecoration = enabled ? 'none' : 'line-through';
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showNote(msg) {
  exportNote.textContent = msg;
  exportNote.style.display = "block";
}

function exportModel() {
  if (!currentModel) return;

  const fmt = exportFormat.value;
  exportBtnText.textContent = "Exporting…";
  exportBtn.disabled = true;
  exportNote.style.display = "none";

  // Temporarily disable wireframe for export, restore after
  const wasWire = showWireframe;
  if (wasWire) currentModel.traverse(o => o.isMesh && (o.material.wireframe = false));

  const done = () => {
    if (wasWire) currentModel.traverse(o => o.isMesh && (o.material.wireframe = true));
    exportBtnText.textContent = "Export";
    exportBtn.disabled = false;
  };

  try {
    if (fmt === "glb" || fmt === "gltf") {
      const exporter = new THREE.GLTFExporter();
      const binary = fmt === "glb";
      exporter.parse(currentModel, result => {
        if (binary) {
          triggerDownload(new Blob([result], { type: "model/gltf-binary" }), "model.glb");
        } else {
          const json = JSON.stringify(result, null, 2);
          triggerDownload(new Blob([json], { type: "model/gltf+json" }), "model.gltf");
        }
        showNote(`✓ Saved as model.${fmt}`);
        done();
      }, { binary });

    } else if (fmt === "obj") {
      const exporter = new THREE.OBJExporter();
      const result = exporter.parse(currentModel);
      triggerDownload(new Blob([result], { type: "text/plain" }), "model.obj");
      showNote("✓ Saved as model.obj");
      done();

    } else if (fmt === "stl-bin" || fmt === "stl-ascii") {
      const exporter = new THREE.STLExporter();
      const binary = fmt === "stl-bin";
      const result = exporter.parse(currentModel, { binary });
      const blob = binary
        ? new Blob([result], { type: "application/octet-stream" })
        : new Blob([result], { type: "text/plain" });
      triggerDownload(blob, "model.stl");
      showNote(`✓ Saved as model.stl (${binary ? "binary" : "ASCII"})`);
      done();

    } else if (fmt === "ply-bin" || fmt === "ply-ascii") {
      const exporter = new THREE.PLYExporter();
      const binary = fmt === "ply-bin";
      exporter.parse(currentModel, result => {
        const blob = binary
          ? new Blob([result], { type: "application/octet-stream" })
          : new Blob([result], { type: "text/plain" });
        triggerDownload(blob, "model.ply");
        showNote(`✓ Saved as model.ply (${binary ? "binary" : "ASCII"})`);
        done();
      }, { binary });
    }

  } catch (err) {
    showNote("⚠ Export failed: " + err.message);
    console.error(err);
    done();
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (currentModel) currentModel.rotation.y += 0.01;
  controls.update();
  renderer.render(scene, camera);
}
