# AR 浏览器验证

本目录是独立验证入口，不加入应用的正常生产构建。

1. 从 Google MediaPipe 公开测试资源下载人像到本目录（仅本地测试，不提交）：
   `Invoke-WebRequest https://storage.googleapis.com/mediapipe-assets/portrait.jpg -OutFile tests/browser/portrait.jpg`
2. 在 `front_end` 运行 `npm run dev`。
3. 打开 `http://localhost:3000/tests/browser/ar-realism.html`，点击“运行浏览器检查”。

验证使用真实 WebGL2、真实 MediaPipe WASM/模型、本地四款 GLB，以及 canvas.captureStream 合成视频，不请求摄像头权限。页面保留各项结果、四款模型和 AERO X1 两种复用配色的 JPEG 截图。

生产打包验证（同样在 `front_end` 执行）：

```powershell
node tests/browser/build.mjs
npm exec vite -- preview --outDir node_modules/.cache/ar-browser-build --host 127.0.0.1 --port 3001 --strictPort
```

打开 `http://127.0.0.1:3001/tests/browser/ar-realism.html`。构建产物位于被 Git 忽略的缓存目录，不覆盖应用的 `dist`。此模式验证打包后的 Worker、动态 import 和本地 WASM 路径。

功能通过标准：透射保留背景色；深度遮挡不遮掉背景；四款 GLB 编译、加载、渲染和截图成功；黑色和玫瑰金复用 AERO X1 的同一模型；20 个连续视频帧的检测输入与显示像素一致；实际异步检测返回关键点；AERO X1 与真实检测器合跑完成 300 个有效追踪帧。截图必须等生产组件确认 GLB 已替换程序模型并完成渲染，加载错误或超时使检查失败；视频采样也等待 GLB 就绪。页面报告检测器位置（worker 或兼容回退 main）以及有效追踪 FPS，功能通过不等于性能目标达标。采样时避免同时运行构建或测试等 CPU 密集任务。

除 MediaPipe 已知的精确消息 `INFO: Created TensorFlow Lite XNNPACK delegate for CPU.` 外，任何主线程 console.error 都使检查失败；Worker 初始化/运行错误通过协议传播，初始化失败可回退主线程，因此还应检查执行位置。

3D 展台检查等待 `FrameShowcase` 的 GLB 加载后渲染通知，加载失败或 15 秒超时判失败。回调内读取当帧画面，确认存在区别于明亮摄影棚背景的模型像素，且这些像素未触及画布边缘，并保留 JPEG 供目视核查；单纯存在 canvas 或显示程序回退模型不算通过。

测试人像仅验证技术路径，不能代替实物佩戴对照。检测时间只反映当前浏览器和本机，不是手机 FPS；仍需真机测量最终性能。

运行时保持浏览器窗口在前台。视频检查窗固定在右下角，方便观察当前输入和合成；宿主窗口仍可能对动画回调限速。同步超时会附带页面可见性、视频时间、检测状态、动画回调数和已配对帧数，便于区分视频节流与检测错误。
