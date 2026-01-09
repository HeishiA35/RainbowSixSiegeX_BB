const canvas = document.getElementById('js-canvasMap');
const canvasContainer = document.getElementById('js-canvasContainer');
const canvasContainerWidth = canvasContainer.clientWidth;
const canvasContainerHeight = canvasContainer.clientHeight;
const context = canvas.getContext('2d');
const mapImage = new Image();

let currentImageScale;
let imageScaleIndex;
let initialLogicalDrawWidth, initialLogicalDrawHeight;

let translateX = 0; //MapImageの切り抜き開始X座標
let translateY = 0; //MapImageの切り抜き開始Y座標

let drawnLines = {
  basement2nd: [],
  basement: [],
  floor1st: [],
  floor2nd: [],
  floor3rd: [],
  roof: []
};

let drawnStamps = {
  basement2nd: [],
  basement: [],
  floor1st: [],
  floor2nd: [],
  floor3rd: [],
  roof: []
};

let drawnLegendStamps = {
  basement2nd: [],
  basement: [],
  floor1st: [],
  floor2nd: [],
  floor3rd: [],
  roof: []
};

let translateXBuf = 0;
let translateYBuf = 0;
let mouseDragX, mouseDragY;

let currentLinePoints = [];

let stampNumber = 0;
let currentStamp;
let currentStamps = [];

let press = false;
let isErasing = false; 
let stampMode = false;
let hookStampMoving = false;
let isCheckInRect = false;
let stampRelocateMode = false;
let hookStampLocating = false;

const buttonLineClear = document.querySelector('#js-lineClear');
const buttonStampClear = document.querySelector('#js-stampClear');
const buttonAllClear = document.querySelector('#js-allClear');
const stamps = document.querySelectorAll('.js-stamp');
const deleteStampContainer = document.getElementById('js-stampDelete');

/*setting*/
const maxScale = 8.0; //最大拡大率。
const minScale = 1.0; //最小拡大率。
const scaleStep = 0.2; //１操作あたりの拡大率。
const stampSize = 3;


/*calculation*/
//高解像度化処理。以降の座標操作を論理ピクセルで扱える。
function resizeCanvas() {
  const resolutionMultiplier = 2;
  const dpr = window.devicePixelRatio || 1;
  const scaleFactor = dpr * resolutionMultiplier;

  canvas.width = canvasContainer.clientWidth * scaleFactor;
  canvas.height = canvasContainer.clientHeight * scaleFactor;
  
  context.scale(scaleFactor, scaleFactor);
  context.imageSmoothingEnabled = false;
};

//親要素(コンテナ)に収まる最大サイズを計算。
function calculateMapImageSize(mapImageWidth, mapImageHeight, canvasContainerWidthReloaded, canvasContainerHeightReloaded) {
  const mapImageAspectRatio = mapImageWidth / mapImageHeight;
  const canvasContainerAspectRatio = canvasContainerWidthReloaded / canvasContainerHeightReloaded;

  let mapDrawWidth, mapDrawHeight;

  if (mapImageAspectRatio < canvasContainerAspectRatio) { 
    //コンテナよりも縦長の画像は、上下に合わせる。
    mapDrawHeight = canvasContainerHeightReloaded;
    mapDrawWidth = mapDrawHeight * mapImageAspectRatio;
  } else { //コンテナよりも横長の画像は左右に合わせる。
    mapDrawWidth = canvasContainerWidthReloaded;
    mapDrawHeight = mapDrawWidth / mapImageAspectRatio;
  }

  return { mapDrawWidth, mapDrawHeight }; //画像サイズを返す。
};

function viewportToLogical(vX, vY) {
  const imageDrawX = vX - translateX;
  const imageDrawY = vY - translateY;

  const scaledX = imageDrawX / currentImageScale;
  const scaledY = imageDrawY / currentImageScale;

  const lX = scaledX / initialLogicalDrawWidth;
  const lY = scaledY / initialLogicalDrawHeight;

  return { x: lX, y: lY};
}

function logicalToViewport(lX, lY) {
  const scaledX = lX * initialLogicalDrawWidth;
  const scaledY = lY * initialLogicalDrawHeight;

  const imageDrawX = scaledX * currentImageScale;
  const imageDrawY = scaledY * currentImageScale;

  const vX = imageDrawX + translateX;
  const vY = imageDrawY + translateY;

  return {x: vX, y: vY};
}

function isRectColliding(e, rect, adjustment = 0) {
  const vX = e.clientX;
  const vY = e.clientY;
  const isCheckRectColliding = vX > (rect.left + adjustment)&&
    vX < (rect.right + adjustment)&&
    vY > (rect.top + adjustment) &&
    vY < (rect.bottom + adjustment);
  return isCheckRectColliding;
}

function getPointerLocalPosition(e) {
  const rect = e.target.getBoundingClientRect();
  const rectX = e.clientX - rect.left;
  const rectY = e.clientY - rect.top;

  return {x: rectX, y: rectY};
}

function mouseMove(e) {
  let canvasRect = e.target.getBoundingClientRect();

  if (press) {
    mouseDragX = e.clientX - canvasRect.left;
    mouseDragY = e.clientY - canvasRect.top;

    translateX = translateXBuf - (mouseX - mouseDragX);
    translateY = translateYBuf - (mouseY - mouseDragY);
  } else {
    mouseX = e.clientX - canvasRect.left;
    mouseY = e.clientY - canvasRect.top;
  }
};

/*canvas*/
function updateCanvas() { //キャンバスに描画。
  //mapの描写
  context.clearRect(0, 0, canvasContainerWidth, canvasContainerHeight);

  const destX = translateX;
  const destY = translateY;
  const destWidth = initialLogicalDrawWidth * currentImageScale;
  const destHeight = initialLogicalDrawHeight * currentImageScale;

  context.drawImage(
    mapImage,
    0, //描画開始X座標
    0, //描画開始Y座標
    mapImage.width, //描画サイズ横
    mapImage.height, //描画サイズ縦
    destX, //画像の切り抜き開始X座標
    destY, //画像の切り抜き開始Y座標
    destWidth, //画像の切り抜きサイズ横
    destHeight //画像の切り抜きサイズ縦
  );

  const scaleRatioElement = document.getElementById('js-scaleRatio');
  const displayScaleRatio = Math.floor((imageScaleIndex * scaleStep + 1) * 10) / 10;

  scaleRatioElement.textContent = displayScaleRatio.toFixed(1) + 'x';

  //線の描写
  drawnLines[selectedFloor].forEach(line => {
    context.beginPath();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = line.lineWidth;
    context.strokeStyle = line.color;

    if(line.points.length > 0) {
      let startPoint = logicalToViewport(line.points[0].x, line.points[0].y);
      context.moveTo(startPoint.x, startPoint.y);

      for(let i = 1; i < line.points.length; i++) {
        let nextPoint = logicalToViewport(line.points[i].x, line.points[i].y);
        context.lineTo(nextPoint.x, nextPoint.y);
      }

      context.stroke();
    }
  });

  //スタンプの描写
  drawnStamps[selectedFloor].forEach(stamp => {
    const newStamp = new Image();

    if (stamp.points) {
      newStamp.src = stamp.img;

      const stampSizePx = window.innerWidth * stampSize / 100;
      const halfStampSize = stampSizePx / 2;

      const stampPoints = logicalToViewport(stamp.points.x, stamp.points.y);

      context.drawImage(
        newStamp,
        stampPoints.x - halfStampSize,
        stampPoints.y - halfStampSize,
        stampSizePx,
        stampSizePx
      );
    }
  });
};

function loadMap() { //最初のマップ描画。
  const mapData = selectedMap ? selectedMap.blueprint[selectedFloor] : ''; 

  if(!mapData) return; // URLがない場合は処理しない

  mapImage.src = mapData;

  mapImage.onload = () => {
    const canvasContainerWidthReloaded = canvasContainer.clientWidth;
    const canvasContainerHeightReloaded = canvasContainer.clientHeight;
    const { mapDrawWidth, mapDrawHeight } = calculateMapImageSize( //切り抜きサイズを計算し、オブジェクトに格納。
      mapImage.width,
      mapImage.height,
      canvasContainerWidthReloaded,
      canvasContainerHeightReloaded
    );

    initialLogicalDrawWidth = mapDrawWidth;
    initialLogicalDrawHeight = mapDrawHeight;

    //画像を中央に配置する座標を translateX/Y に設定
    translateX = (canvasContainerWidthReloaded - initialLogicalDrawWidth) / 2;
    translateY = (canvasContainerHeightReloaded - initialLogicalDrawHeight) / 2;

    // ズーム/パンを初期値に設定。
    currentImageScale = 1;
    imageScaleIndex = 0;

    updateCanvas();
  };
};


/*zoom*/
function zoomByWheel(e) {
  const wheeldelta = e.deltaY ? -(e.deltaY) : e.wheelDelta;
  //e.deltaYが存在すれば、e.deltaYの符号を逆転した値が定義。e.deltaYが存在しなければe.wheelDeltaYが定義。(後者はブラウザ互換性対応)

  let nextScale;

  if (wheeldelta > 0) { // 拡大
      nextScale = Math.min(maxScale, currentImageScale + scaleStep);
  } else { // 縮小
      nextScale = Math.max(minScale, currentImageScale - scaleStep);
  }

  if (nextScale === currentImageScale) {
    return;
  } 

  //マウス位置に準拠したズーム中心点の計算
  const canvasPosition = getPointerLocalPosition(e);
  const scaleRatio = nextScale / currentImageScale; // 拡縮比率

  //マウス座標を中心として、画像の新しい左上座標(translate)を計算
  // 新しい座標 = マウス位置 - (マウス位置 - 現在の画像座標) * 比率　(左上の隠れている部分の座標を引いている。)
  let nextTranslateX = canvasPosition.x - (canvasPosition.x - translateX) * scaleRatio;
  let nextTranslateY = canvasPosition.y - (canvasPosition.y - translateY) * scaleRatio;
  
  //値の更新
  currentImageScale = nextScale;
  imageScaleIndex = Math.round((currentImageScale - 1) / scaleStep); //拡縮段階の計算。
  translateX = nextTranslateX;
  translateY = nextTranslateY;

  if(currentImageScale === minScale){
    translateX = (canvasContainerWidth - initialLogicalDrawWidth) / 2;
    translateY = (canvasContainerHeight - initialLogicalDrawHeight) / 2;
  }

  updateCanvas();
};

function disableScroll() {
  document.addEventListener("mousewheel", scrollControl, { passive: false });
}

function enableScroll() {
  document.removeEventListener("mousewheel", scrollControl, { passive: false });
}

function scrollControl(e) {
  e.preventDefault();
}

function zoomByButton(zoom) {
  let nextScale;
  const isZoomUp = zoom === 'up';
  const isZoomDown = zoom === 'down'; 

  if(isZoomUp && imageScaleIndex >= 20) {
    return; 
  } else if(isZoomDown && imageScaleIndex <= 0) {
    return;
  } else if(isZoomUp) {
    nextScale = Math.min(maxScale, currentImageScale + scaleStep);
  } else {
    nextScale = Math.max(minScale, currentImageScale - scaleStep);
  }

  const scaleRatio = nextScale / currentImageScale;
  const centerX = canvasContainerWidth / 2;
  const centerY = canvasContainerHeight / 2;

  let nextTranslateX = centerX - (centerX - translateX) * scaleRatio;
  let nextTranslateY = centerY - (centerY - translateY) * scaleRatio;

  currentImageScale = nextScale;
  imageScaleIndex = Math.round((currentImageScale - 1) / scaleStep); //拡縮段階の計算。
  translateX = nextTranslateX;
  translateY = nextTranslateY;

  if(currentImageScale === minScale){
    translateX = (canvasContainerWidth - initialLogicalDrawWidth) / 2;
    translateY = (canvasContainerHeight - initialLogicalDrawHeight) / 2;
  }

  updateCanvas();
};


/*draw*/
function drawLine(e) {
  const canvasPosition = getPointerLocalPosition(e);
  
  if(!press) {
    return;
  }
  
  context.lineCap = 'round';
  context.lineJoin = 'round';
  
  context.lineWidth = penBoldValue;
  context.strokeStyle = currentColor;

  if(press) {
    context.lineTo(canvasPosition.x, canvasPosition.y);
    context.stroke();

    const logicalPositions = viewportToLogical(canvasPosition.x, canvasPosition.y);
    currentLinePoints.push(logicalPositions);
  }
};

function drawLineStart(e) {
  const canvasPosition = getPointerLocalPosition(e);

  context.beginPath();
  context.moveTo(canvasPosition.x, canvasPosition.y);
};

function drawLineEnd() {
  context.closePath();

  if(press && currentLinePoints.length > 1) {
    drawnLines[selectedFloor].push({
      color: currentColor,
      lineWidth: penBoldValue,
      points: currentLinePoints,
    });
  }

  currentLinePoints = [];
};

function isSegmentColliding(logicalPosition1, logicalPosition2, eraserCenter, eraserRadius) {
  const localPosition1 = logicalToViewport(logicalPosition1.x, logicalPosition1.y);
  const localPosition2 = logicalToViewport(logicalPosition2.x, logicalPosition2.y);
  const distSquared1 = Math.pow(localPosition1.x - eraserCenter.x, 2) + Math.pow(localPosition1.y - eraserCenter.y, 2);
  const distSquared2 = Math.pow(localPosition2.x - eraserCenter.x, 2) + Math.pow(localPosition2.y - eraserCenter.y, 2);
  const radiusSquared = Math.pow(eraserRadius, 2);
  
  if(distSquared1 < radiusSquared || distSquared2 < radiusSquared) {
    return true;
  };

  //点 (p) と線分 (vp1-vp2) の最短距離を計算
    
  // 線分のベクトル A = vp2 - vp1
  const Ax = localPosition2.x - localPosition1.x;
  const Ay = localPosition2.y - localPosition1.y;

  // 点 p から vp1 へのベクトル B = p - vp1
  const Bx = eraserCenter.x - localPosition1.x;
  const By = eraserCenter.y - localPosition1.y;

  // A と B の内積
  const dotProduct = Ax * Bx + Ay * By;
  
  // A の長さの二乗
  const lenSq = Ax * Ax + Ay * Ay;
  
  let t = dotProduct / lenSq;
  
  // t を 0 から 1 の間にクランプ (最短点が線分上にあることを保証)
  t = Math.max(0, Math.min(1, t));

  // 線分上の最短点 q の座標
  const qx = localPosition1.x + t * Ax;
  const qy = localPosition1.y + t * Ay;

  // p と q の距離の二乗
  const distSquaredSegment = Math.pow(eraserCenter.x - qx, 2) + Math.pow(eraserCenter.y - qy, 2);
  
  // 最短距離が半径より小さいか
  return distSquaredSegment < radiusSquared;
};

function eraseLine(e) {
  const canvasPosition = getPointerLocalPosition(e);

  
  if(!press) {
    return;
  }
  
  const eraserRadius = eraserBoldValue;
  const eraserCenter = {x: canvasPosition.x, y:canvasPosition.y};
  let newDrawnLines = [];

  if (press) {
    drawnLines[selectedFloor].forEach(drawnLine => {
      let currentSegment = [];

      for (let i = 1; i < drawnLine.points.length; i++) {
        const logicalPosition1 = drawnLine.points[i - 1];
        const logicalPosition2 = drawnLine.points[i];


        if (isSegmentColliding(logicalPosition1, logicalPosition2, eraserCenter, eraserRadius)) {
          //衝突時

          if (currentSegment.length > 0) {
            newDrawnLines.push ({
              color: drawnLine.color,
              lineWidth: drawnLine.lineWidth,
              points: currentSegment
            });
          }

          currentSegment = [];

        } else {
          if (currentSegment.length === 0) {
            currentSegment.push(logicalPosition1);
          }
          currentSegment.push(logicalPosition2);
        }
      }

      if(currentSegment.length > 1) {
        newDrawnLines.push({
          color: drawnLine.color,
          lineWidth: drawnLine.lineWidth,
          points: currentSegment
        });
      }
    });

    drawnLines[selectedFloor] = newDrawnLines;

    updateCanvas();
  }
};

function canvasLineClear() {
  drawnLines[selectedFloor] = [];

  updateCanvas();
};

function canvasStampClear() {
  drawnStamps[selectedFloor] = [];

  updateCanvas();
};

function canvasAllClear() {
  drawnLines[selectedFloor] = [];
  drawnStamps[selectedFloor] = [];

  updateCanvas();
};

/*stamp*/
function getStampPositionsToFollowMouse(e) {
  const stampSizePx = window.innerWidth * stampSize / 100;
  const halfStampSize = stampSizePx / 2;
  const viewportX = e.clientX;
  const viewportY = e.clientY;

  const vXadjusted = viewportX - halfStampSize;
  const vYadjusted = viewportY - halfStampSize;

  return { x: vXadjusted, y: vYadjusted};
};

function getStampPositionsToRecord(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const rectX = e.clientX - rect.left;
  const rectY = e.clientY - rect.top;

  return {
    x: rectX,
    y: rectY
  };
};

function mouseStamp(e) {
  const stamp = new Image();
  const selectedImage = e.target;
  const selectedImageURL = selectedImage.getAttribute('src');
  stamp.src = selectedImageURL;
  stamp.id = 'stamp--' + (drawnStamps[selectedFloor].length + 1);
  stamp.style.width = stampSize + 'vw';
  stamp.style.height = stampSize + 'vw';
  stamp.style.display = 'block';
  stamp.style.position = 'fixed';
  stamp.style.zIndex = '900';
  const stampPositionsFollowingMouse = getStampPositionsToFollowMouse(e);
  stamp.style.left = stampPositionsFollowingMouse.x + 'px';
  stamp.style.top  = stampPositionsFollowingMouse.y + 'px';

  canvasContainer.appendChild(stamp);

  const stampPositionsLocal = getStampPositionsToRecord(e);
  const logicalPositions = viewportToLogical(stampPositionsLocal.x, stampPositionsLocal.y);

  const stampData = {
    id: stamp.id,
    img: stamp.src,
    points: logicalPositions
  }

  drawnStamps[selectedFloor].push(stampData);
};

function mouseStampMove(e) {
  const stamp = document.getElementById(`stamp--${drawnStamps[selectedFloor].length}`);
  const stampPositionsOnMouse = getStampPositionsToFollowMouse(e);
  stamp.style.left = stampPositionsOnMouse.x + 'px';
  stamp.style.top  = stampPositionsOnMouse.y + 'px';
};

function drawStamp(e) {
  stampNumber++;

  const stampPositionsLocal = getStampPositionsToRecord(e);

  const stamp = stampRelocateMode ? 
    document.getElementById(currentStamp.id) : 
    document.getElementById(`stamp--${drawnStamps[selectedFloor].length}`)

  const logicalPositions = viewportToLogical(stampPositionsLocal.x, stampPositionsLocal.y);

  if(stampRelocateMode) {
    const id = currentStamp.id;
    const arrayNumber =  drawnStamps[selectedFloor].findIndex((stamp) => stamp.id === id);
    const arrayStamps = drawnStamps[selectedFloor];

    
    currentStamp.id = `stamp--${stampNumber}`
    currentStamp.points = logicalPositions;
    arrayStamps.splice(arrayNumber, 1);

    drawnStamps[selectedFloor].push(currentStamp);

    currentStamp = {};

  } else {
  drawnStamps[selectedFloor][drawnStamps[selectedFloor].length - 1].points = logicalPositions;
  }
  
  stamp.remove();
};

function isStampColliding(stampData, pointerCenter, pointerRadius) {

  const closestX = Math.max(stampData.x, Math.min(pointerCenter.x, stampData.x + stampData.width));
  const closestY = Math.max(stampData.y, Math.min(pointerCenter.y, stampData.y + stampData.height));

  const distSquaredX = pointerCenter.x - closestX;
  const distSquaredY = pointerCenter.y - closestY;
  const distanceSquared = (distSquaredX * distSquaredX) + (distSquaredY * distSquaredY);

  const radiusSquared = pointerRadius * pointerRadius;

  return distanceSquared < radiusSquared;
};

function removeStamp() {
  const id = currentStamp.id;

  const arrayNumber =  drawnStamps[selectedFloor].findIndex((stamp) => stamp.id === id);
  drawnStamps[selectedFloor][arrayNumber] = {
    id: id,
    img: currentStamp.img,
    points: {}
  };

  updateCanvas();
};

function mouseStampForRelocate(e) {
  const id = currentStamp.id;
  const stamp = new Image();

  stamp.src = currentStamp.img;
  stamp.id = id;
  stamp.style.width = stampSize + 'vw';
  stamp.style.height = stampSize + 'vw';
  stamp.style.display = 'block';
  stamp.style.position = 'fixed';
  stamp.style.zIndex = '900';
  const stampPositionsOnMouse = getStampPositionsToFollowMouse(e);
  stamp.style.left = stampPositionsOnMouse.x + 'px';
  stamp.style.top  = stampPositionsOnMouse.y + 'px';

  canvasContainer.appendChild(stamp);
};

function mouseStampMoveForRelocate(e) {
  const id = currentStamp.id;
  const stamp = document.getElementById(id);
  const stampPositionFollowingMouse = getStampPositionsToFollowMouse(e);
  stamp.style.left = stampPositionFollowingMouse.x + 'px';
  stamp.style.top  = stampPositionFollowingMouse.y + 'px';
};


//mousedown, mouseupで操作切り分け？

stamps.forEach(stamp => {
  const modal = document.querySelector('dialog.js-stampSetting');
  stamp.addEventListener('click', (e) => {

    const existingStamp = canvasContainer.lastElementChild;
    const id = existingStamp.getAttribute('id');
    const isCheckMouseStamp = id.slice(0, 7) === 'stamp--'; 

    if(isCheckMouseStamp) {
      elementForCheck.remove();
      const arrayNumber = drawnStamps[selectedFloor].findIndex((stamp) => stamp.id === idForCheck);
      drawnStamps[selectedFloor].splice(arrayNumber, 1);
    }

    const clickedElement = e.target;
    const isCheckOperator = clickedElement.classList.contains('js-stamp--operator');
    const isCheckAbility = clickedElement.classList.contains('js-stamp--ability');
    const isCheckgadget = clickedElement.classList.contains('js-stamp--gadget');
    const isCheckGear = clickedElement.classList.contains('js-stamp--gear');
    const isCheckStamp = clickedElement.classList.contains('js-stamp--stamp');

    const checkWhichStamp = (clickedElement) => {
      if(isCheckOperator){
        return clickedElement.parentNode.previousElementSibling;
      } else if(isCheckAbility) {
        return clickedElement.parentNode;
      } else if(isCheckgadget) {
        return clickedElement.parentNode.parentNode;
      } else if(isCheckGear) {
        return clickedElement.parentNode;
      } else if(isCheckStamp) {
        return clickedElement;
      }
    }

    const container = checkWhichStamp(clickedElement);
    const isCheckItemsActive = container.classList.contains('items--active');
    const isCheckGearsActive = container.classList.contains('p-canvas__gears--active');

    if(isCheckStamp) {
      modal.close();
    }
    
    if(!isCheckItemsActive && !isCheckGearsActive && !isCheckStamp ){
      return;
    } else {
      mouseStamp(e);
      stampRelocateMode = false;
      stampMode = true;
      hookStampLocating = true;
      isCheckInRect = true;
      deleteStampContainer.classList.add('p-canvas__stampDelete--active');
    }

    if(isCheckAbility || isCheckgadget) {
      deactivateItems();
    }

    if(isCheckGearsActive) {
      deactivateGears();
    }
  });
});

canvasContainer.addEventListener('click', (e) => {
  const deleteRect = deleteStampContainer.getBoundingClientRect();
  const isDeleteRectColliding = isRectColliding(e, deleteRect);

  if(isDeleteRectColliding) {
    const existingStamp = canvasContainer.lastElementChild;
    const id = existingStamp.getAttribute('id');
    const isCheckMouseStamp = id.slice(0, 7) === 'stamp--';
    if(isCheckMouseStamp) {
      existingStamp.remove();
      const arrayNumber = drawnStamps[selectedFloor].findIndex((stamp) => stamp.id === id);
      drawnStamps[selectedFloor].splice(arrayNumber, 1);
      setTimeout(() => {
        deleteStampContainer.classList.remove('p-canvas__stampDelete--active');
      }, 500);
      stampMode = false;
      stampRelocateMode = false;
      hookStampLocating = false;
      return;
    }
  }
  
  if(stampMode && hookStampMoving) {
    //console.log('2:stamp描写');
    drawStamp(e);
    stampMode = false;
    stampRelocateMode = true;
    hookStampLocating = false;
    deleteStampContainer.classList.remove('p-canvas__stampDelete--active');

    updateCanvas();

  } else if(stampRelocateMode && hookStampLocating) {
    //console.log('3:stamp再描写');
    hookStampLocating = false;
    drawStamp(e);
    updateCanvas();
    deleteStampContainer.classList.remove('p-canvas__stampDelete--active');

  } else if (stampRelocateMode && !hookStampLocating) {
    const rect = e.target.getBoundingClientRect();
    const vX = e.clientX - rect.left;
    const vY = e.clientY - rect.top;
    const pointerCenter = {x: vX, y: vY};
    const pointerRadius = 1;

    drawnStamps[selectedFloor].forEach(drawnStamp => {
      const stampSizePx = window.innerWidth * stampSize / 100;
      const halfStampSize = stampSizePx / 2;
      const stampPoints = logicalToViewport(drawnStamp.points.x, drawnStamp.points.y)
      const stampData = {
        x: stampPoints.x - halfStampSize,
        y: stampPoints.y - halfStampSize,
        width: stampSizePx,
        height: stampSizePx
      }

      if(isStampColliding(stampData, pointerCenter, pointerRadius)) {
        //console.log('4:stamp再選択')
        
        currentStamps.push(drawnStamp);
        deleteStampContainer.classList.add('p-canvas__stampDelete--active');
      }

      
    })

    for(let i = 0; i < currentStamps.length; i++) {
      if(i !== currentStamps.length - 1) {
        continue;
      }

      currentStamp = currentStamps[i];
      removeStamp(e);
      mouseStampForRelocate(e);
      hookStampLocating = true;
      currentStamps = [];
    }
  }
});

document.addEventListener('mousemove', (e) => {
  const canvasRect = canvasContainer.getBoundingClientRect();
  const deleteRect = deleteStampContainer.getBoundingClientRect();
  const stampSizePx = window.innerWidth * stampSize / 100;
  const halfStampSize = stampSizePx / 2;
  const adjustment = halfStampSize * -1;
  const isCanvasColliding = isRectColliding(e, canvasRect, adjustment);
  const isDeleteRectColliding = isRectColliding(e, deleteRect);

  if(!isCanvasColliding) {
    hookStampMoving = false;
  } else {
    hookStampMoving = true;
  }

  if(isCanvasColliding) {
    isCheckInRect = false;
  }

  if(stampMode && hookStampLocating) {
    if(!hookStampMoving && isCheckInRect) {
      mouseStampMove(e);

    } else if (hookStampMoving && !isCheckInRect){
      mouseStampMove(e);
    }
    
  } else if (stampRelocateMode && hookStampLocating) {
    if(hookStampMoving) {
      mouseStampMoveForRelocate(e);
    }
  }

  if(isDeleteRectColliding) {
    deleteStampContainer.style.opacity = '1.0';
  } else {
    deleteStampContainer.style.opacity = '0.6';
  }
});

/*実行*/
/*load*/
window.addEventListener('load', () => {
  resizeCanvas();
  loadMap();
});
/*resize*/
window.addEventListener('resize', () => {
  resizeCanvas();
  loadMap();
});

/*zoom*/
canvas.addEventListener('wheel', (e) =>  {
  e.preventDefault();
  zoomByWheel(e);
}, { passive: false }); 
canvas.addEventListener('mouseover', disableScroll); 
canvas.addEventListener('mouseout', enableScroll); 

const buttonZoomUp = document.getElementById('js-zoomUp');

buttonZoomUp.addEventListener('click', () => {
  const zoom = buttonZoomUp.getAttribute('id').slice(7).toLowerCase();
  zoomByButton(zoom);
});

const buttonZoomDown = document.getElementById('js-zoomDown');

buttonZoomDown.addEventListener('click', () => {
  const zoom = buttonZoomDown.getAttribute('id').slice(7).toLowerCase();
  zoomByButton(zoom);
});


/*move&draw*/
canvas.addEventListener('mousedown', (e) => {
  if(checkMoveActive) {
    translateXBuf = translateX;
    translateYBuf = translateY;
  } else if(hookSelectedDrawTool === 'pen') {
    drawLineStart(e);
  } else if(hookSelectedDrawTool === 'eraser') {
    eraseLine(e);
  }

  press = true;
});

canvas.addEventListener('mouseup', () => { 
  if(hookSelectedDrawTool === 'pen') {
    drawLineEnd();
  }

  press = false;
});

canvas.addEventListener('mouseout',() => { 
  if(hookSelectedDrawTool === 'pen') {
    drawLineEnd();
  }

  press = false;
});

canvas.addEventListener('mousemove', (e) => { 
  if(checkMoveActive) {
    mouseMove(e);
    updateCanvas();
  } else if (hookSelectedDrawTool === 'pen') {
    drawLine(e);
  } else if (hookSelectedDrawTool === 'eraser') {
    eraseLine(e);
  }
});

/*clear*/
buttonLineClear.addEventListener('click', () => {
  const modal = buttonLineClear.parentElement.parentElement;

  modal.classList.remove('js-setting--active');

  modal.close();
  canvasLineClear();
});

buttonStampClear.addEventListener('click', () => {
  const modal = buttonStampClear.parentElement.parentElement;

  modal.classList.remove('js-setting--active');
  modal.close();
  canvasStampClear();
});

buttonAllClear.addEventListener('click', () => {
  const modal = buttonAllClear.parentElement.parentElement;

  modal.classList.remove('js-setting--active');
  modal.close();
  canvasAllClear();
});