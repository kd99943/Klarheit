# AR 真实感修正实施记录

更新：2026-10-28。阶段一、二的渲染与追踪代码、同帧同步、3D 展台折射背景以及四款内置 GLB / 程序化模型的曲面造型已实现。当前几何依据产品图片近似建模，尚无厂家 CAD 或实测尺寸资料，不能视为实物精度验收完成；后续可通过 `real-meters` 资产管线替换。自动化结果与尚未验证的项目见下文。

## 已实现

- 3.1：遮挡体与模型分离；GLB 切换保留遮挡和投影；深度遮挡先绘制。透明镜片不再作为不透明物体投出整块黑影。
- 3.2：摄像头作为 sRGB 场景背景；追踪启动前使用 VideoTexture，启动后使用检测过的 CanvasTexture 快照。视频与关键点共用 cover 裁切计算；DOM video 保持解码；截图只镜像一次合成画布，并绘制水印。
- 3.3：程序模型与旧 GLB 共用物理材质；光学镜片使用 transmission / iridescence，去除 opacity 叠加、sheen、自发光；移除人工拉丝法线。同时修复 `FrameShowcase.tsx`（无摄像头 3D 展台），为其提供 `RoomEnvironment` 与摄影棚渐变网格 `scene.background`，解决透明背景下 `transmission: 1` 镜片发白浑浊的问题。
- 3.4：使用 RoomEnvironment；降低补光；每 200ms 从额头和两侧脸颊估算线性亮度、色偏和主光方向，并进行平滑。
- 3.5：按裁切后的摄像头像素限制渲染分辨率；位置、旋转和缩放使用按时间计算的 One Euro 滤波；新追踪结果才更新滤波；丢失人脸时隐藏眼镜。
- 3.6：保留贴图、`pbr-` 前缀、`keepMaterial` 标记和自带透射的材质；正确保留多材质数组和共享材质。
- 4.1：使用 MediaPipe 标准模型的 468 顶点、898 三角面进行人脸遮挡和投影；保留按脸宽调整的侧头胶囊体；关键点不足时回退到椭球。
- 4.3：检测与渲染共用一个视频源；requestVideoFrameCallback 驱动检测（同时跟踪 `metadata.mediaTime` 与 `video.currentTime`，修复 `MediaStream` 下 `currentTime` 滞后导致漏检的问题），无该接口时用 rAF 并跳过重复视频帧。将冻结图像和对应关键点一起发布，异步检测使用双缓冲，保证下一帧不会改写正在显示的图像。
- 5.x（内置四款 3D 几何与 GLB 资产重塑）：升级 `front_end/scripts/export-frame-glbs.mjs` 与 `front_end/src/ar/glassesGeometry.ts` 并重新导出 `public/models/frames/{aero_x1,monolith_02,orbit_t4,lucent_v1}.glb`（每款约 417KB–629KB）：
  - **三维光学基弯（Base Curve）、面弯角（Wrap Angle）与前倾角（Pantoscopic Tilt）**：告别原本完全平直的 2D 挤出切片，所有镜圈、一体式前框与弯月形镜片均具备以左右镜片中心（`±LENS_X`）为基准的连续三维弧度，并通过 `mergeVertices` 焊接顶点后计算平滑法线（`computeVertexNormals`），使环境高光沿镜框曲面自然流动。
  - **四款产品参考图片的轮廓与厚度近似建模**：
    - `AERO X1`：左右镜像对称的非对称波士顿/Panto 细钛丝镜圈（~1.5mm 纤细金属壁厚）、拱形中梁、横向三道棱线庄头、S 型鹅颈鼻托臂、金属鼻托及全钛扁平桨形弯腿尾端。
    - `MONOLITH 02`：一体式连续威灵顿板材前框（上沿阶梯下沉式鼻梁、上宽下窄梯形倒角镜圈、外侧庄头清晰内收台阶、设计约 4.3mm 板材前框厚度）+ 与庄头齐平的宽幅人体工学下折板材镜腿。
    - `ORBIT T-4`：纤细圆形钛丝镜圈、与镜圈顶部齐平焊接的飞行员平顶上横梁 + 拱形下鼻梁双梁结构、鹅颈鼻托臂及弯曲玳瑁套管脚套。
    - `LUCENT V1`：一体式连续透明冰晶板材 Panto 前框（消除原本 `BoxGeometry` 方块中梁的内部接缝，设计约 4.3mm 厚度与均匀纤巧边框）、庄头菱形金属铆钉、深炭灰太阳镜片及透明镜腿内嵌弯曲金属蕊芯。
- 追踪性能：MediaPipe 优先在模块 Worker 中运行，ImageBitmap 转移后及时关闭；初始化失败回退主线程。Worker 运行时只保留一个检测任务；提前预约下一帧，忙时合并到最新视频画面，避免排队积累延迟。切源丢弃过期结果，卸载终止 Worker、取消回调并清理缓冲。
- 投影修正：人脸网格与眼镜统一按各点深度反投影，深度比例使用裁切前视频宽度，修复人脸偏离画面中心时眼镜上移的问题。
- 性能配置：透射缓冲为半分辨率、阴影贴图 512，按比例调整阴影模糊半径；交替快照复用同一 CanvasTexture，仅分辨率变化时重建纹理。
- 模型接入：支持 Meshopt 解码、真实米制模型归一化和开发环境加载失败日志。

## 与原指南不同的实现细节

1. 现有内置 GLB 已包含旧的 transmission 参数，不能简单地全部保留。`frameCatalog.ts` 明确标记这些旧资产为 `legacyMaterials: true`，允许修复旧镜片；贴图及显式保留标记仍优先。
2. Three r184 的 transmission shader 会将 thickness 乘以模型缩放，但 attenuationDistance 直接参与世界空间光程计算。因此每次绘制时将材质的原始衰减距离换算为世界单位，避免缩放导致色深变化。
3. 使用支持 shadow.radius 的 PCFShadowMap，避免在 PCFSoftShadowMap 下设置无效的软化半径。
4. VideoTexture 会跟随视频自动更新，不能靠设置 needsUpdate 实现严格同帧同步，因此使用检测前冻结的 CanvasTexture。Worker 不可用时主线程路径保持相同快照语义。
5. One Euro 的自适应速度以模型尺度百分比和角度计算，避免世界坐标及弧度量级太小导致快速转头时滤波过重。

## 新真实模型的接入约定

在产品的 AR 配置中设置模型 URL、`modelScaleMode: "real-meters"` 和 `legacyMaterials: false`，并按实测 A/DBL 更新产品 `specsSize`（前端由两者之和计算 `lensCenterDistanceMm`）。前端优先采用选中配色的模型，其次复用默认配色的模型，最后才使用内置 GLB；单位及材质策略跟随实际采用的模型。现有产品继续使用归一化模型；替换同路径资产时也必须显式更新这些字段。

后端新增 `V21__ar_model_asset_metadata.sql`，将 `model_scale_mode` 和 `legacy_materials` 持久化并通过产品及 AR 配置响应返回。旧记录的默认值为 `normalized` / NULL；NULL 表示由前端识别内置旧资产，false 可明确禁止旧材质替换。部署时需先让 Flyway 执行 V21。当前管理页面没有 AR 资产编辑表单，资产维护仍通过现有数据库配置流程进行。

新模型遵守指南的原点和朝向约定。自带完整材质建议使用 `pbr-` 前缀或 `material.userData.keepMaterial = true`。运行时不会重写这些材质的贴图和本地厚度。

同款多色可共用一个 GLB：在默认配色上填写模型 URL，其他配色可留空并设置自己的 `frameColor`。新模型将允许换色的主材质命名为 `frame-primary` 或 `pbr-frame-primary`；仅修改其颜色因子，保留贴图、粗糙度、透射等 PBR 参数。内置资产按钛/钢/板材/水晶主材质名称换色，镜片、鼻托、玳瑁和金色装饰不跟随主色改变。

## 自动化与真实浏览器验证

- `npm test`：本轮 17 个测试文件、100 项测试全部通过，包含新增的模型绕序、展台加载生命周期与窄容器取景回归。
- 后端产品单元测试：`ProductServiceTest`、`ProductServiceFilteringTest` 共 13 项通过，包含模型元数据到 JSON 的传递。
- `npm run lint`：TypeScript 检查通过（0 错误）。
- `node tests/browser/build.mjs` 与 `npm run build`：浏览器回归构建与生产构建均通过。

以下为修复前记录的浏览器结果：视频仅采样 60 帧，展台仅检查 canvas 存在。这些记录不能代替修复后的 300 帧持续测试与展台 GLB 就绪检查，也不能证明全部验收标准通过。

| 检查 | 本机实测结果 |
|---|---|
| GPU | Intel UHD Graphics，ANGLE / Direct3D11 (`vs_5_0 ps_5_0`) |
| 实际透射 pass | 背景 RGB `64,128,96` → 镜片 RGB `56,138,99`，透亮无发白 |
| 深度遮挡 | 遮住后方红色测试物，摄像头背景完整保留无黑洞 |
| 四款本地 GLB | 全部加载并完成着色器编译（`AERO X1` 23 网格/16,968 面、`MONOLITH 02` 11 网格/25,076 面、`ORBIT T-4` 20 网格/17,304 面、`LUCENT V1` 15 网格/27,292 面） |
| 实际 MediaPipe 模型 | 检测到 478 点；静态图检测中位数 `13.6ms` |
| 生产 Worker | 追踪检测器执行位置为 `worker`，实际模型返回关键点 |
| 生产组件与 3D 展台 | 四款镜框 + 两种复用配色（`matte-black`、`rose-gold`）合成 JPEG 截图成功；`FrameShowcase` 3D 展台渲染通过；连续切款与卸载清理通过 |
| 视频帧同步配对 | 合成视频流连续 20 个解码帧，检测输入与发布图像像素 100% 一致 |
| 完整实时视频管线 | `AERO X1`、480×480 合成输入持续处理 60 帧，有效追踪帧率 **59.0 fps** |
| 运行错误 | 0 着色器或运行时错误 |

浏览器入口及复现命令见 [浏览器验证说明](../front_end/tests/browser/README.md)。

## 2026-10-28 评审修正

- MONOLITH / LUCENT 的镜腿沿 Z 轴镜像后反转三角形绕序，再重新计算法线；同步修正导出脚本与程序模型，并重新生成两款 GLB。使用真实几何的有向体积回归测试检查左右镜腿保持单面、向外朝向。
- 视频性能检查恢复为 300 个有效追踪帧，继续报告实测 FPS；功能通过不代表达到设备性能预算。
- `FrameShowcase` 增加加载结果通知，成功通知只在 GLB 替换回退模型并完成渲染后触发。浏览器检查等待该通知、检查画面内可见模型并保存 JPEG；加载失败或超时均判失败。
- 展台相机按模型包围球与容器横纵视角取景，旋转及容器缩窄时仍保留完整模型；回归检查增加模型不得触及画布边缘的像素断言。
- 本轮先用旧 GLB 复现两款镜腿有向体积为负的失败，再重新导出并通过全部 100 项单元测试、TypeScript 检查、生产构建和独立浏览器构建。
- 本轮内置浏览器生产构建实测：Intel UHD Graphics / ANGLE Direct3D11；四款 GLB 与两种复用配色、展台 GLB 就绪及模型像素检查、JPEG 截图、切换卸载、20 帧像素配对全部通过。两轮真实 MediaPipe Worker 均完成 300 个有效追踪帧，480×480 合成输入分别测得 **35.9fps、57.0fps**；最终构建额外通过展台画布边界检查，目视确认镜框完整显示，静态图检测中位数 12.9ms，无着色器或运行时错误。帧率存在波动，不能将差异归因于展台取景修改；功能回归通过，但尚不能认定桌面集显 ≥ 60fps 持续达标，也不能沿用上方 60 帧短采样的 59.0fps 作为持续性能结论。

仍待验证：真人佩戴实物的尺寸误差 < 3mm、侧脸遮挡与投影、不同光照下的视觉对照、快速转头端到端延迟 < 2 帧，以及安卓 / iPhone / 桌面集显的持续性能目标。

## 人脸拓扑来源

`front_end/src/ar/faceTriangles.ts` 从 [MediaPipe canonical_face_model.obj](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj) 的三角面索引转换为从零开始的索引，不包含虹膜顶点。许可证副本保存在相邻的 `faceTriangles.LICENSE`。
