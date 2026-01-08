let currentMode = null;
let capturedPhotos = [];
let currentUploadIndex = 0;
let uploadedFiles = [];
let stream = null;
let countdownInterval = null;
let currentPhotoIndex = 0;
let isCancelled = false;

const shutterSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUA0PVKzn77JfGgU+ltryxnMpBSl+zPLaizsIGGS57OihUxENT6Xh8LdjHQU2jtDzzn0vBSh6yPDajkALElyx6OyrWRcLQ5zi8r1uIwYwhM/z1YU2Bhxqvu7mnlIPD1Om5O+zYBoGPJPY8sd0KwYpfMvy3Ik8CRdhtuvkn1EODlKo5PC1ZBsGNYzP88p6LwUme8jv3I5BCRJbr+jqqloYC0OZ4PK8bSQGMIHM89SENwcdabe');

let cropState = {
  imageElement: null,
  cropBox: null,
  mask: null,
  isDragging: false,
  cropX: 0,
  cropY: 0,
  cropWidth: 0,
  cropHeight: 0,
  zoom: 80,
  imageWidth: 0,
  imageHeight: 0,
  dragStartX: 0,
  dragStartY: 0
};

function selectMode(mode) {
  currentMode = mode;
  
  // apply theme to body and container
  const body = document.body;
  const container = document.querySelector('.container');
  
  if (mode === 'vintage') {
    body.classList.add('vintage-theme');
    body.classList.remove('modern-theme');
    container.classList.add('vintage-theme');
    container.classList.remove('modern-theme');
  } else {
    body.classList.add('modern-theme');
    body.classList.remove('vintage-theme');
    container.classList.add('modern-theme');
    container.classList.remove('vintage-theme');
  }
  
  document.getElementById('home-screen').classList.add('hidden');
  
  if (mode === 'vintage') {
    // vintage goes straight to camera
    document.getElementById('camera-screen').classList.remove('hidden');
    initCamera();
  } else {
    // modern shows choices
    document.getElementById('upload-choice-screen').classList.remove('hidden');
  }
}

async function initCamera() {
  try {
    isCancelled = false; // reset cancel flag
    const videoContainer = document.getElementById('video-container');
    const video = document.getElementById('video');
    
    if (currentMode === 'vintage') {
      videoContainer.classList.remove('modern');
      video.classList.add('vintage-filter');
    } else {
      videoContainer.classList.add('modern');
      video.classList.remove('vintage-filter');
    }
    
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'user',
        width: { ideal: currentMode === 'vintage' ? 720 : 1280 },
        height: { ideal: currentMode === 'vintage' ? 960 : 720 }
      },
      audio: false 
    });
    
    video.srcObject = stream;
    
    capturedPhotos = [];
    currentPhotoIndex = 0;
    
    document.getElementById('photo-counter').textContent = `Photo 1 of 4`;
    
    setTimeout(() => {
      if (!isCancelled) { // only start countdown if not cancelled
        startCountdown();
      }
    }, 1000);
    
  } catch (err) {
    alert('Could not access camera. Please ensure camera permissions are granted.');
    goHome();
  }
}

async function startCamera() {
  document.getElementById('upload-choice-screen').classList.add('hidden');
  document.getElementById('camera-screen').classList.remove('hidden');
  await initCamera();
}

function startCountdown() {
  if (isCancelled) return; // don't start if cancelled
  
  let count = 3;
  const countdownDisplay = document.getElementById('countdown-display');
  
  countdownDisplay.textContent = count;
  countdownDisplay.style.display = 'block';
  
  countdownInterval = setInterval(() => {
    if (isCancelled) { // check if cancelled during countdown
      clearInterval(countdownInterval);
      countdownDisplay.style.display = 'none';
      return;
    }
    
    count--;
    if (count > 0) {
      countdownDisplay.textContent = count;
    } else {
      countdownDisplay.style.display = 'none';
      clearInterval(countdownInterval);
      if (!isCancelled) { // only capture if not cancelled
        capturePhoto();
      }
    }
  }, 1000);
}

function capturePhoto() {
  if (isCancelled) return; // don't capture if cancelled
  
  const video = document.getElementById('video');
  const canvas = document.getElementById('hidden-canvas');
  const ctx = canvas.getContext('2d');
  
  if (currentMode === 'vintage') {
    canvas.width = 600;
    canvas.height = 800;
  } else {
    canvas.width = 800;
    canvas.height = 600;
  }
  
  const videoAspect = video.videoWidth / video.videoHeight;
  const canvasAspect = canvas.width / canvas.height;
  
  let sourceX = 0, sourceY = 0, sourceWidth = video.videoWidth, sourceHeight = video.videoHeight;
  
  if (videoAspect > canvasAspect) {
    sourceWidth = video.videoHeight * canvasAspect;
    sourceX = (video.videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = video.videoWidth / canvasAspect;
    sourceY = (video.videoHeight - sourceHeight) / 2;
  }
  
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, -canvas.width, 0, canvas.width, canvas.height);
  ctx.restore();
  
  if (currentMode === 'vintage') {
    applyVintageFilter(ctx, canvas.width, canvas.height);
  }
  
  const photoData = canvas.toDataURL('image/jpeg');
  capturedPhotos.push(photoData);
  currentPhotoIndex++;
  
  if (currentMode === 'vintage' && !isCancelled) {
    triggerFlash();
    playShutterSound();
  }
  
  if (isCancelled) return; // check again after capture
  
  if (currentPhotoIndex < 4) {
    document.getElementById('photo-counter').textContent = `Photo ${currentPhotoIndex + 1} of 4`;
    setTimeout(() => {
      if (!isCancelled) { // only continue if not cancelled
        startCountdown();
      }
    }, 1500);
  } else {
    stopCameraForCompletion();
    showCustomization();
  }
}

function applyVintageFilter(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const contrast = 1.3;
    let adjusted = ((avg - 128) * contrast) + 128;
    adjusted = Math.max(0, Math.min(255, adjusted));
    
    data[i] = adjusted;
    data[i + 1] = adjusted;
    data[i + 2] = adjusted;
  }
  
  ctx.putImageData(imageData, 0, 0);
}

function triggerFlash() {
  const flash = document.getElementById('flash');
  flash.classList.add('active');
  setTimeout(() => {
    flash.classList.remove('active');
  }, 100);
}

function playShutterSound() {
  shutterSound.currentTime = 0;
  shutterSound.play().catch(() => {});
}

function stopCamera() {
  isCancelled = true; // set cancel flag
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  // hide countdown display
  const countdownDisplay = document.getElementById('countdown-display');
  if (countdownDisplay) {
    countdownDisplay.style.display = 'none';
  }
  
  document.getElementById('camera-screen').classList.add('hidden');
  
  // always go home when manually stopping camera (cancel button)
  goHome();
}

function stopCameraForCompletion() {
  // separate function for when all 4 photos are taken successfully
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  const countdownDisplay = document.getElementById('countdown-display');
  if (countdownDisplay) {
    countdownDisplay.style.display = 'none';
  }
  
  document.getElementById('camera-screen').classList.add('hidden');
}

function chooseUpload() {
  document.getElementById('upload-choice-screen').classList.add('hidden');
  document.getElementById('upload-screen').classList.remove('hidden');
}

function handleFileUpload(e) {
  const files = Array.from(e.target.files);
  
  // check if exactly 4 photos were uploaded
  if (files.length !== 4) {
    alert('Please upload exactly 4 photos.');
    e.target.value = ''; // reset file input
    return;
  }
  
  uploadedFiles = files;
  capturedPhotos = [];
  currentUploadIndex = 0;

  document.querySelector('.upload-area').style.display = 'none';
  document.getElementById('crop-container').classList.remove('hidden');

  cropState.zoom = 80;
  document.getElementById('zoom-slider').value = 80;

  loadImageForCropping(0);
}

function loadImageForCropping(index) {
  if (index >= uploadedFiles.length) {
    showUploadPreviews();
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('crop-image');
    img.src = e.target.result;
    document.getElementById('crop-photo-number').textContent = index + 1;

    img.onload = () => setupCropBox(img);
  };
  reader.readAsDataURL(uploadedFiles[index]);
}

function setupCropBox(img) {
  const mask = document.getElementById('image-mask');
  const cropBox = document.getElementById('crop-box');

  cropState.imageElement = img;
  cropState.cropBox = cropBox;
  cropState.mask = mask;

  cropState.imageWidth = img.offsetWidth;
  cropState.imageHeight = img.offsetHeight;

  updateCropBoxSize();

  cropBox.addEventListener('mousedown', startDrag);
  cropBox.addEventListener('touchstart', startDrag);
}

function updateCropBoxSize() {
  const zoom = cropState.zoom / 100;
  const targetAspect = currentMode === 'modern' ? 4 / 3 : 3 / 4;
  
  const imgWidth = cropState.imageWidth;
  const imgHeight = cropState.imageHeight;
  const imgAspect = imgWidth / imgHeight;

  let boxWidth, boxHeight;

  if (imgAspect > targetAspect) {
    boxHeight = imgHeight * zoom;
    boxWidth = boxHeight * targetAspect;
  } else {
    boxWidth = imgWidth * zoom;
    boxHeight = boxWidth / targetAspect;
  }

  if (boxWidth > imgWidth) {
    boxWidth = imgWidth;
    boxHeight = boxWidth / targetAspect;
  }
  if (boxHeight > imgHeight) {
    boxHeight = imgHeight;
    boxWidth = boxHeight * targetAspect;
  }

  cropState.cropWidth = boxWidth;
  cropState.cropHeight = boxHeight;

  cropState.cropX = Math.max(0, Math.min(cropState.cropX, imgWidth - boxWidth));
  cropState.cropY = Math.max(0, Math.min(cropState.cropY, imgHeight - boxHeight));

  cropState.cropBox.style.width = boxWidth + 'px';
  cropState.cropBox.style.height = boxHeight + 'px';
  cropState.cropBox.style.left = cropState.cropX + 'px';
  cropState.cropBox.style.top = cropState.cropY + 'px';
}

function updateCropZoom() {
  cropState.zoom = +document.getElementById('zoom-slider').value;
  updateCropBoxSize();
}

function startDrag(e) {
  e.preventDefault();
  cropState.isDragging = true;

  const point = e.touches ? e.touches[0] : e;
  const rect = cropState.mask.getBoundingClientRect();
  
  cropState.dragStartX = point.clientX - rect.left - cropState.cropX;
  cropState.dragStartY = point.clientY - rect.top - cropState.cropY;

  document.addEventListener('mousemove', drag);
  document.addEventListener('touchmove', drag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchend', stopDrag);
}

function drag(e) {
  if (!cropState.isDragging) return;
  e.preventDefault();

  const point = e.touches ? e.touches[0] : e;
  const rect = cropState.mask.getBoundingClientRect();

  let newX = point.clientX - rect.left - cropState.dragStartX;
  let newY = point.clientY - rect.top - cropState.dragStartY;

  newX = Math.max(0, Math.min(newX, cropState.imageWidth - cropState.cropWidth));
  newY = Math.max(0, Math.min(newY, cropState.imageHeight - cropState.cropHeight));

  cropState.cropX = newX;
  cropState.cropY = newY;

  cropState.cropBox.style.left = newX + 'px';
  cropState.cropBox.style.top = newY + 'px';
}

function stopDrag() {
  cropState.isDragging = false;
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('touchmove', drag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchend', stopDrag);
}

function confirmCrop() {
  const img = cropState.imageElement;
  const canvas = document.getElementById('hidden-canvas');
  const ctx = canvas.getContext('2d');

  const scaleX = img.naturalWidth / cropState.imageWidth;
  const scaleY = img.naturalHeight / cropState.imageHeight;

  const sx = cropState.cropX * scaleX;
  const sy = cropState.cropY * scaleY;
  const sw = cropState.cropWidth * scaleX;
  const sh = cropState.cropHeight * scaleY;

  canvas.width = currentMode === 'modern' ? 800 : 600;
  canvas.height = currentMode === 'modern' ? 600 : 800;

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  capturedPhotos.push(canvas.toDataURL('image/jpeg', 1.0));

  currentUploadIndex++;
  loadImageForCropping(currentUploadIndex);
}

function showUploadPreviews() {
  document.getElementById('crop-container').classList.add('hidden');

  const grid = document.getElementById('upload-preview');
  grid.innerHTML = '';

  capturedPhotos.forEach(photoData => {
    const img = document.createElement('img');
    img.src = photoData;
    grid.appendChild(img);
  });

  document.getElementById('upload-proceed-btn').disabled = capturedPhotos.length !== 4;
}

function cancelUpload() {
  goHome();
}

function proceedToCustomization() {
  if (capturedPhotos.length === 4) {
    document.getElementById('upload-screen').classList.add('hidden');
    showCustomization();
  }
}

function showCustomization() {
  const previewStrip = document.getElementById('preview-strip');
  previewStrip.innerHTML = '';
  
  capturedPhotos.forEach(photoData => {
    const img = document.createElement('img');
    img.src = photoData;
    
    // Apply grayscale filter to vintage preview images
    if (currentMode === 'vintage') {
      img.style.filter = 'grayscale(100%)';
    }
    
    previewStrip.appendChild(img);
  });
  
  if (currentMode === 'modern') {
    document.getElementById('frame-option').classList.remove('hidden');
    document.getElementById('note-option').classList.remove('hidden');
    document.getElementById('background-option').classList.add('hidden');
  } else {
    document.getElementById('frame-option').classList.add('hidden');
    document.getElementById('note-option').classList.add('hidden');
    document.getElementById('background-option').classList.remove('hidden');
  }
  
  document.getElementById('customization-screen').classList.remove('hidden');
}

function selectBackground(color) {
  document.querySelectorAll('#background-option .color-option').forEach(el => {
    el.classList.remove('selected');
  });
  event.target.classList.add('selected');
}

function selectFrameColor(color) {
  document.querySelectorAll('#frame-option .color-option').forEach(el => {
    el.classList.remove('selected');
  });
  event.target.classList.add('selected');
}

function toggleDate() {
  // Handled in generation
}

function updateNote() {
  // Handled in generation
}

function generatePhotostrip() {
  const canvas = document.getElementById('photostrip-canvas');
  const ctx = canvas.getContext('2d');
  
  const includeDate = document.getElementById('include-date').checked;
  const note = document.getElementById('note-input')?.value || '';
  
  // ALWAYS vertical strip for both modes
  const stripWidth = 400;
  const padding = 20;
  const photoPadding = 15;
  
  let photoWidth = stripWidth - (padding * 2);
  let photoHeight;
  
  if (currentMode === 'vintage') {
    // Vintage: 3:4 ratio (portrait photos)
    photoHeight = (photoWidth / 3) * 4;
  } else {
    // Modern: 4:3 ratio (landscape photos)
    photoHeight = (photoWidth / 4) * 3;
  }
  
  // calculate space needed for date/note
  let dateNoteSpace = 10; // minimum padding at bottom
  if (currentMode === 'modern') {
    if (note && includeDate) {
      dateNoteSpace = 80; // space for both note and date
    } else if (note || includeDate) {
      dateNoteSpace = 50; // space for just one
    }
  } else {
    // vintage mode
    if (includeDate) {
      dateNoteSpace = 60;
    }
  }
  
  canvas.width = stripWidth;
  canvas.height = (photoHeight * 4) + (photoPadding * 5) + (padding * 2) + dateNoteSpace;
  
  let bgColor, frameColor;
  
  if (currentMode === 'vintage') {
    const selectedBg = document.querySelector('#background-option .color-option.selected');
    bgColor = selectedBg ? window.getComputedStyle(selectedBg).backgroundColor : 'white';
    frameColor = bgColor;
  } else {
    const selectedFrame = document.querySelector('#frame-option .color-option.selected');
    frameColor = selectedFrame ? window.getComputedStyle(selectedFrame).backgroundColor : '#FFE4E1';
    bgColor = frameColor;
  }
  
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const promises = capturedPhotos.map((photoData, index) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const y = padding + (index * (photoHeight + photoPadding));
        
        // Draw frame
        ctx.fillStyle = frameColor;
        ctx.fillRect(padding - 5, y - 5, photoWidth + 10, photoHeight + 10);
        
        // Draw photo
        ctx.drawImage(img, padding, y, photoWidth, photoHeight);
        resolve();
      };
      img.src = photoData;
    });
  });
  
  Promise.all(promises).then(() => {
    if (includeDate || note) {
      let textY = padding + (photoHeight * 4) + (photoPadding * 4) + 30;
      
      if (currentMode === 'vintage') {
        ctx.fillStyle = bgColor === 'rgb(0, 0, 0)' ? 'white' : 'black';
        ctx.font = '18px "Courier New", monospace';
        ctx.textAlign = 'center';
        
        if (includeDate) {
          const today = new Date();
          const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}.${today.getFullYear()}`;
          
          ctx.fillText(dateStr, stripWidth / 2, textY);
        }
      } else {
        ctx.textAlign = 'center';
        
        if (note) {
          ctx.fillStyle = '#333';
          ctx.font = 'italic 24px "Courier New"';
          ctx.fillText(note, stripWidth / 2, textY);
          textY += 30;
        }
        
        if (includeDate) {
          const today = new Date();
          const dateStr = today.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });
          
          ctx.fillStyle = '#666';
          ctx.font = '16px "Courier New"';
          ctx.fillText(dateStr, stripWidth / 2, textY);
        }
      }
    }
    
    document.getElementById('customization-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    
    if (currentMode === 'modern') {
      canvas.className = 'show modern-reveal';
    } else {
      canvas.className = 'show vintage-drop';
    }
  });
}

function downloadPhotostrip() {
  const canvas = document.getElementById('photostrip-canvas');
  const link = document.createElement('a');
  link.download = `ashleys-photobooth-${Date.now()}.jpg`;
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
}

function goHome() {
  // stop camera and clear all intervals first
  isCancelled = true;
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  // hide countdown display
  const countdownDisplay = document.getElementById('countdown-display');
  if (countdownDisplay) {
    countdownDisplay.style.display = 'none';
  }
  
  capturedPhotos = [];
  currentPhotoIndex = 0;
  currentMode = null;
  uploadedFiles = [];
  currentUploadIndex = 0;
  
  // remove theme classes
  const body = document.body;
  const container = document.querySelector('.container');
  body.classList.remove('vintage-theme', 'modern-theme');
  container.classList.remove('vintage-theme', 'modern-theme');
  
  document.querySelectorAll('.container > div').forEach(el => {
    el.classList.add('hidden');
  });
  
  document.getElementById('home-screen').classList.remove('hidden');
  document.getElementById('upload-preview').innerHTML = '';
  document.getElementById('file-input').value = '';
  document.getElementById('include-date').checked = false;
  
  if (document.getElementById('note-input')) {
    document.getElementById('note-input').value = '';
  }
  
  document.querySelector('.upload-area').style.display = 'block';
  document.getElementById('crop-container').classList.add('hidden');
}