"use strict";
const fileInput = document.getElementById("fileInput");
const formulaInput = document.getElementById("formulaInput");
const applyBtn = document.getElementById("applyBtn");
const stopBtn = document.getElementById("stopBtn");
const statusText = document.getElementById("statusText");
const media = document.getElementById("media");
const inputModeSelect = document.getElementById("inputModeSelect");
const formulaSection = document.getElementById("formulaInputSection");
const presetSection = document.getElementById("presetSection");
const drawExtraSettings = document.getElementById("drawExtraSettings");
const closedCurveSettings = document.getElementById("closedCurveSettings");
const drawDirectionSelect = document.getElementById("drawDirectionSelect");
const sourceCanvasLabel = document.getElementById("sourceCanvasLabel");
const maxSpeedInput = document.getElementById("maxSpeedInput");
const presetSelect = document.getElementById("presetSelect");
const sourceCanvas = document.getElementById("sourceCanvas");
const clearDrawBtn = document.getElementById("clearDrawBtn");
const smoothDrawBtn = document.getElementById("smoothDrawBtn");
const previewCanvas = document.getElementById("previewCanvas");
let currentSpeedFunc = null;
let running = false;
let rafId = null;
let videoDuration = 100;
let drawnPoints = [];
let isDrawing = false;
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
media.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(media.duration) && media.duration > 0) {
        videoDuration = media.duration;
        liveUpdate();
    }
});
// ==== 数学语法解析器 ====
function parseMathFormula(expr) {
    let parsed = expr.toLowerCase();
    parsed = parsed.replace(/\^/g, '**');
    parsed = parsed.replace(/\bpi\b/g, 'Math.PI');
    parsed = parsed.replace(/\be\b/g, 'Math.E');
    const mathFuncs = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'exp', 'sqrt', 'abs', 'min', 'max', 'round', 'ceil', 'floor'];
    mathFuncs.forEach(func => {
        const regex = new RegExp(`\\b${func}\\b`, 'g');
        parsed = parsed.replace(regex, `Math.${func}`);
    });
    return parsed;
}
function compileUserFunc(expr) {
    try {
        const jsExpr = parseMathFormula(expr);
        const fn = new Function("t", "d", "Math", `"use strict"; return (${jsExpr});`);
        return (t, d) => fn(t, d, Math);
    }
    catch {
        throw new Error("数学语法错误");
    }
}
function getPresetFunc(key) {
    switch (key) {
        case "constant": return () => 1;
        case "linear": return (t, d) => 1 + (t / d) * 3;
        case "sine": return (t, d) => Math.sin((t / d) * Math.PI * 4) + 2;
        case "pulse": return (t, d) => Math.pow(Math.sin((t / d) * Math.PI * 10), 2) * 2 + 1;
        default: return () => 1;
    }
}
function isClosedCurve(threshold = 0.05) {
    if (drawnPoints.length < 3)
        return false;
    const first = drawnPoints[0], last = drawnPoints[drawnPoints.length - 1];
    const dx = first.x - last.x, dy = first.y - last.y;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
}
function isDrawnClockwise(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i], p2 = points[(i + 1) % points.length];
        sum += (p2.x - p1.x) * (p2.y + p1.y);
    }
    return sum < 0;
}
function computeArcLengths(points, scaleX = 800, scaleY = 300) {
    const lengths = [0];
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = (points[i].x - points[i - 1].x) * scaleX;
        const dy = (points[i].y - points[i - 1].y) * scaleY;
        totalLength += Math.sqrt(dx * dx + dy * dy);
        lengths.push(totalLength);
    }
    return { lengths, totalLength };
}
// ==== 核心：获取速度函数 (支持极值自动映射 Auto-Scaling) ====
function getDrawnFunc(maxSpeed) {
    if (!drawnPoints.length)
        return () => 1;
    const localTop = Math.min(...drawnPoints.map(p => p.y));
    const localBottom = Math.max(...drawnPoints.map(p => p.y));
    const yRange = localBottom - localTop;
    const mapYToSpeed = (y) => {
        if (yRange < 0.01)
            return 1 + (1 - y) * (maxSpeed - 1);
        const mappedFraction = (y - localTop) / yRange;
        return 1 + (1 - mappedFraction) * (maxSpeed - 1);
    };
    if (isClosedCurve()) {
        const points = [...drawnPoints, drawnPoints[0]];
        const { lengths, totalLength } = computeArcLengths(points, 800, 300);
        const shouldReverse = (drawDirectionSelect.value === "cw") !== isDrawnClockwise(points);
        return (t, d) => {
            let normalizedT = clamp(t / Math.max(d, 0.1), 0, 1);
            if (shouldReverse)
                normalizedT = 1 - normalizedT;
            const targetArc = normalizedT * totalLength;
            let interpolatedY = points[0].y;
            for (let i = 0; i < points.length - 1; i++) {
                if (targetArc >= lengths[i] && targetArc <= lengths[i + 1]) {
                    const ratio = (targetArc - lengths[i]) / (lengths[i + 1] - lengths[i]);
                    interpolatedY = points[i].y + (points[i + 1].y - points[i].y) * ratio;
                    break;
                }
            }
            return mapYToSpeed(interpolatedY);
        };
    }
    else {
        const isRightToLeft = drawnPoints[drawnPoints.length - 1].x < drawnPoints[0].x;
        const monotonicPoints = [];
        if (isRightToLeft) {
            let lowestX = Infinity;
            for (const p of drawnPoints) {
                if (p.x < lowestX) {
                    monotonicPoints.push(p);
                    lowestX = p.x;
                }
            }
            monotonicPoints.reverse();
        }
        else {
            let highestX = -Infinity;
            for (const p of drawnPoints) {
                if (p.x > highestX) {
                    monotonicPoints.push(p);
                    highestX = p.x;
                }
            }
        }
        if (monotonicPoints.length === 0)
            return () => 1;
        return (t, d) => {
            const targetX = clamp(t / Math.max(d, 0.1), 0, 1);
            let interpolatedY = monotonicPoints[0].y;
            for (let i = 0; i < monotonicPoints.length - 1; i++) {
                if (targetX >= monotonicPoints[i].x && targetX <= monotonicPoints[i + 1].x) {
                    const ratio = (targetX - monotonicPoints[i].x) / (monotonicPoints[i + 1].x - monotonicPoints[i].x || 1);
                    interpolatedY = monotonicPoints[i].y + (monotonicPoints[i + 1].y - monotonicPoints[i].y) * ratio;
                    break;
                }
            }
            return mapYToSpeed(interpolatedY);
        };
    }
}
// ==== 获取全局源函数画布上的物理坐标 ====
function getCurrentSourcePoint(t, d) {
    const mode = inputModeSelect.value;
    const T = Math.max(d, 0.1);
    if (mode === "draw") {
        if (!drawnPoints.length)
            return null;
        if (isClosedCurve()) {
            const points = [...drawnPoints, drawnPoints[0]];
            const { lengths, totalLength } = computeArcLengths(points, 800, 300);
            const shouldReverse = (drawDirectionSelect.value === "cw") !== isDrawnClockwise(points);
            let normalizedT = clamp(t / T, 0, 1);
            if (shouldReverse)
                normalizedT = 1 - normalizedT;
            const targetArc = normalizedT * totalLength;
            for (let i = 0; i < points.length - 1; i++) {
                if (targetArc >= lengths[i] && targetArc <= lengths[i + 1]) {
                    const ratio = (targetArc - lengths[i]) / (lengths[i + 1] - lengths[i] || 1);
                    return {
                        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
                        y: points[i].y + (points[i + 1].y - points[i].y) * ratio
                    };
                }
            }
            return points[points.length - 1];
        }
        else {
            const targetX = clamp(t / T, 0, 1);
            const isRightToLeft = drawnPoints[drawnPoints.length - 1].x < drawnPoints[0].x;
            const monotonicPoints = [];
            if (isRightToLeft) {
                let lowestX = Infinity;
                for (const p of drawnPoints) {
                    if (p.x < lowestX) {
                        monotonicPoints.push(p);
                        lowestX = p.x;
                    }
                }
                monotonicPoints.reverse();
            }
            else {
                let highestX = -Infinity;
                for (const p of drawnPoints) {
                    if (p.x > highestX) {
                        monotonicPoints.push(p);
                        highestX = p.x;
                    }
                }
            }
            if (monotonicPoints.length === 0)
                return { x: targetX, y: drawnPoints[0].y };
            let targetY = monotonicPoints[0].y;
            for (let i = 0; i < monotonicPoints.length - 1; i++) {
                if (targetX >= monotonicPoints[i].x && targetX <= monotonicPoints[i + 1].x) {
                    const ratio = (targetX - monotonicPoints[i].x) / (monotonicPoints[i + 1].x - monotonicPoints[i].x || 1);
                    targetY = monotonicPoints[i].y + (monotonicPoints[i + 1].y - monotonicPoints[i].y) * ratio;
                    break;
                }
            }
            return { x: targetX, y: targetY };
        }
    }
    else {
        if (!currentSpeedFunc)
            return null;
        const speed = currentSpeedFunc(t, d);
        const maxSpeed = Math.max(1.1, Number(maxSpeedInput.value) || 4);
        return {
            x: clamp(t / T, 0, 1),
            y: 1 - (speed - 1) / (maxSpeed - 1)
        };
    }
}
function buildSpeedFunc() {
    const mode = inputModeSelect.value;
    const maxSpeedLimit = Math.max(1.1, Number(maxSpeedInput.value) || 4);
    let rawFunc;
    try {
        if (mode === "formula")
            rawFunc = compileUserFunc(formulaInput.value.trim());
        else if (mode === "preset")
            rawFunc = getPresetFunc(presetSelect.value);
        else
            rawFunc = getDrawnFunc(maxSpeedLimit);
    }
    catch {
        return null;
    }
    return (t, d) => {
        let v = rawFunc(t, d);
        if (!Number.isFinite(v))
            v = 1;
        return clamp(v, 1, maxSpeedLimit);
    };
}
// ==== 两个画布的双端实时绘制 ====
function drawBothCanvases(currentTime) {
    const w = sourceCanvas.width, h = sourceCanvas.height;
    const padding = 40;
    const plotW = w - padding * 2, plotH = h - padding * 2;
    const mode = inputModeSelect.value;
    const maxSpeed = Math.max(1.1, Number(maxSpeedInput.value) || 4);
    const displayTime = currentTime !== undefined && isFinite(currentTime) ? clamp(currentTime, 0, videoDuration) : undefined;
    let activeSpeed = 1;
    if (displayTime !== undefined && currentSpeedFunc)
        activeSpeed = currentSpeedFunc(displayTime, videoDuration);
    // --- 1. 源画布 ---
    const sCtx = sourceCanvas.getContext("2d");
    if (sCtx) {
        sCtx.clearRect(0, 0, w, h);
        sCtx.strokeStyle = "#1f2937";
        sCtx.lineWidth = 1;
        sCtx.setLineDash([4, 4]);
        sCtx.beginPath();
        sCtx.moveTo(0, h / 2);
        sCtx.lineTo(w, h / 2);
        sCtx.stroke();
        sCtx.setLineDash([]);
        if (mode === "draw" && drawnPoints.length > 0) {
            sCtx.strokeStyle = "#3b82f6";
            sCtx.lineWidth = 2;
            sCtx.beginPath();
            drawnPoints.forEach((p, index) => {
                if (index === 0) sCtx.moveTo(p.x * w, p.y * h);
                else sCtx.lineTo(p.x * w, p.y * h);
            });
            if (isClosedCurve())
                sCtx.lineTo(drawnPoints[0].x * w, drawnPoints[0].y * h);
            sCtx.stroke();
            sCtx.fillStyle = "#10b981";
            sCtx.beginPath();
            sCtx.arc(drawnPoints[0].x * w, drawnPoints[0].y * h, 4, 0, Math.PI * 2);
            sCtx.fill();
        }
        else if (mode !== "draw" && currentSpeedFunc) {
            sCtx.strokeStyle = "#3b82f6";
            sCtx.lineWidth = 2;
            sCtx.beginPath();
            for (let i = 0; i <= w; i++) {
                const t = (i / w) * videoDuration;
                const spd = currentSpeedFunc(t, videoDuration);
                const yFrac = 1 - (spd - 1) / (maxSpeed - 1);
                if (i === 0) sCtx.moveTo(i, yFrac * h);
                else sCtx.lineTo(i, yFrac * h);
            }
            sCtx.stroke();
        }
        if (displayTime !== undefined && currentSpeedFunc) {
            const activePt = getCurrentSourcePoint(displayTime, videoDuration);
            if (activePt) {
                sCtx.fillStyle = "#f59e0b";
                sCtx.beginPath();
                sCtx.arc(activePt.x * w, activePt.y * h, 8, 0, Math.PI * 2);
                sCtx.fill();
                sCtx.strokeStyle = "#ffffff";
                sCtx.lineWidth = 2;
                sCtx.stroke();
            }
        }
    }
    // --- 2. 预览展开图 ---
    const pCtx = previewCanvas.getContext("2d");
    if (pCtx && currentSpeedFunc) {
        pCtx.clearRect(0, 0, w, h);
        pCtx.strokeStyle = "#1f2937";
        pCtx.lineWidth = 1;
        pCtx.setLineDash([2, 2]);
        for (let i = 0; i <= 5; i++) {
            const y = padding + (plotH * i) / 5;
            pCtx.beginPath();
            pCtx.moveTo(padding, y);
            pCtx.lineTo(w - padding, y);
            pCtx.stroke();
        }
        for (let i = 0; i <= 10; i++) {
            const x = padding + (plotW * i) / 10;
            pCtx.beginPath();
            pCtx.moveTo(x, padding);
            pCtx.lineTo(x, h - padding);
            pCtx.stroke();
        }
        pCtx.setLineDash([]);
        pCtx.strokeStyle = "#4b5563";
        pCtx.lineWidth = 2;
        pCtx.beginPath();
        pCtx.moveTo(padding, h - padding);
        pCtx.lineTo(w - padding, h - padding);
        pCtx.stroke();
        pCtx.beginPath();
        pCtx.moveTo(padding, padding);
        pCtx.lineTo(padding, h - padding);
        pCtx.stroke();
        pCtx.fillStyle = "#9ca3af";
        pCtx.font = "12px system-ui";
        pCtx.textAlign = "center";
        for (let i = 0; i <= 10; i++)
            pCtx.fillText(((videoDuration * i) / 10).toFixed(0) + "s", padding + (plotW * i) / 10, h - padding + 20);
        pCtx.textAlign = "right";
        for (let i = 0; i <= 5; i++)
            pCtx.fillText((1 + (maxSpeed - 1) * (5 - i) / 5).toFixed(1) + "x", padding - 10, padding + (plotH * i) / 5 + 4);
        pCtx.strokeStyle = "#3b82f6";
        pCtx.lineWidth = 2;
        pCtx.beginPath();
        for (let i = 0; i <= 400; i++) {
            const t = (videoDuration * i) / 400;
            const spd = currentSpeedFunc(t, videoDuration);
            const px = padding + (plotW * i) / 400;
            const py = padding + plotH * (1 - (spd - 1) / (maxSpeed - 1));
            if (i === 0) pCtx.moveTo(px, py);
            else pCtx.lineTo(px, py);
        }
        pCtx.stroke();
        if (displayTime !== undefined) {
            const px = padding + (plotW * displayTime) / videoDuration;
            const py = padding + plotH * (1 - (activeSpeed - 1) / (maxSpeed - 1));
            pCtx.strokeStyle = "#10b981";
            pCtx.lineWidth = 1;
            pCtx.setLineDash([4, 4]);
            pCtx.beginPath();
            pCtx.moveTo(px, padding);
            pCtx.lineTo(px, h - padding);
            pCtx.stroke();
            pCtx.setLineDash([]);
            pCtx.fillStyle = "#10b981";
            pCtx.beginPath();
            pCtx.arc(px, py, 6, 0, Math.PI * 2);
            pCtx.fill();
            pCtx.strokeStyle = "#ffffff";
            pCtx.lineWidth = 2;
            pCtx.stroke();
            pCtx.fillStyle = "#10b981";
            pCtx.font = "bold 12px system-ui";
            pCtx.textAlign = "center";
            pCtx.fillText(`t=${displayTime.toFixed(1)}s, ${activeSpeed.toFixed(2)}x`, px, py - 10);
        }
    }
}
// ==== UI 更新 ====
function liveUpdate() {
    const f = buildSpeedFunc();
    if (f) {
        currentSpeedFunc = f;
        drawBothCanvases(media.currentTime);
        statusText.style.color = "#10b981";
        statusText.textContent = `实时生效，当前视频时长：${videoDuration.toFixed(1)}s`;
    }
    else {
        statusText.style.color = "#ef4444";
        statusText.textContent = "输入错误，请检查语法结构。";
    }
}
function updateUI() {
    const mode = inputModeSelect.value;
    formulaSection.style.display = mode === "formula" ? "block" : "none";
    drawExtraSettings.style.display = mode === "draw" ? "block" : "none";
    presetSection.style.display = mode === "preset" ? "block" : "none";
    sourceCanvas.style.pointerEvents = mode === "draw" ? "auto" : "none";
    sourceCanvas.style.cursor = mode === "draw" ? "crosshair" : "default";
    if (mode === "draw") {
        sourceCanvasLabel.textContent = "绘制图像曲线";
        closedCurveSettings.style.display = isClosedCurve() ? "block" : "none";
    }
    else if (mode === "formula") {
        sourceCanvasLabel.textContent = "图像曲线预览";
    }
    else {
        sourceCanvasLabel.textContent = "预设波形预览";
    }
    liveUpdate();
}
[inputModeSelect, formulaInput, presetSelect, maxSpeedInput, drawDirectionSelect].forEach(el => {
    el.addEventListener('input', updateUI);
    el.addEventListener('change', updateUI);
});
// ==== 画板操作 ====
function addPointFromEvent(ev) {
    const rect = sourceCanvas.getBoundingClientRect();
    drawnPoints.push({
        x: clamp((ev.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((ev.clientY - rect.top) / rect.height, 0, 1)
    });
    liveUpdate();
}
sourceCanvas.addEventListener("pointerdown", (ev) => {
    if (inputModeSelect.value !== "draw")
        return;
    ev.preventDefault();
    isDrawing = true;
    drawnPoints = [];
    addPointFromEvent(ev);
});
sourceCanvas.addEventListener("pointermove", (ev) => {
    if (!isDrawing || inputModeSelect.value !== "draw")
        return;
    ev.preventDefault();
    addPointFromEvent(ev);
});
const finishDraw = () => { if (isDrawing) {
    isDrawing = false;
    updateUI();
} };
sourceCanvas.addEventListener("pointerup", finishDraw);
sourceCanvas.addEventListener("pointerleave", finishDraw);
clearDrawBtn.addEventListener("click", () => { drawnPoints = []; updateUI(); });
smoothDrawBtn.addEventListener("click", () => {
    if (drawnPoints.length < 3)
        return;
    const smoothed = [];
    for (let i = 0; i < drawnPoints.length; i++) {
        let sumY = 0, sumX = 0, count = 0;
        for (let j = i - 2; j <= i + 2; j++) {
            if (j >= 0 && j < drawnPoints.length) {
                sumX += drawnPoints[j].x;
                sumY += drawnPoints[j].y;
                count++;
            }
        }
        smoothed.push({ x: sumX / count, y: sumY / count });
    }
    drawnPoints = smoothed;
    updateUI();
});
// ==== 媒体控制 ====
function startControl() {
    if (!currentSpeedFunc)
        return;
    if (!media.src) {
        statusText.style.color = "#ef4444";
        statusText.textContent = "请先选择一个音/视频文件。";
        return;
    }
    running = true;
    applyBtn.disabled = true;
    stopBtn.disabled = false;
    statusText.style.color = "#10b981";
    const loop = () => {
        if (!running)
            return;
        const t = media.currentTime;
        if (isFinite(t)) {
            try {
                const speed = currentSpeedFunc(t, videoDuration);
                media.playbackRate = speed;
                drawBothCanvases(t);
                statusText.textContent = `▶ 正在播放 - 时间: ${t.toFixed(1)}s / ${videoDuration.toFixed(1)}s, 当前速率: ${speed.toFixed(2)}x`;
            }
            catch {
                stopControl();
                return;
            }
        }
        rafId = requestAnimationFrame(loop);
    };
    if (!media.paused)
        rafId = requestAnimationFrame(loop);
    media.addEventListener("play", () => { if (running && rafId === null)
        rafId = requestAnimationFrame(loop); }, { once: false });
    media.addEventListener("pause", () => { if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    } }, { once: false });
}
function stopControl() {
    running = false;
    applyBtn.disabled = false;
    stopBtn.disabled = true;
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    media.playbackRate = 1;
    statusText.textContent = "⏹ 已停止变速控制，恢复自然 1x。";
    if (currentSpeedFunc)
        drawBothCanvases(media.currentTime);
}
fileInput.addEventListener("change", () => {
    var _a;
    const file = (_a = fileInput.files) === null || _a === void 0 ? void 0 : _a[0];
    if (!file)
        return;
    media.src = URL.createObjectURL(file);
    media.load();
    media.play().catch(() => { });
});
applyBtn.addEventListener("click", startControl);
stopBtn.addEventListener("click", stopControl);
// ==== 拖拽分割条改变布局宽度的逻辑 ====
const leftCol = document.getElementById("leftCol");
const resizer = document.getElementById("resizer");
let isResizing = false;
resizer.addEventListener("pointerdown", () => {
    isResizing = true;
    resizer.classList.add("active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
});
document.addEventListener("pointermove", (e) => {
    if (!isResizing)
        return;
    const container = leftCol.parentElement;
    if (!container)
        return;
    const containerRect = container.getBoundingClientRect();
    let newWidth = e.clientX - containerRect.left;
    // 限制左右两侧最小宽度为 300px
    if (newWidth < 300)
        newWidth = 300;
    if (newWidth > containerRect.width - 300)
        newWidth = containerRect.width - 300;
    leftCol.style.width = `${(newWidth / containerRect.width) * 100}%`;
    // 如果处于播放状态或画板处于活跃状态，自适应触发画布刷新
    if (currentSpeedFunc) {
        drawBothCanvases(media.currentTime);
    }
});
document.addEventListener("pointerup", () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove("active");
        document.body.style.cursor = "default";
        document.body.style.userSelect = "";
    }
});
updateUI();
