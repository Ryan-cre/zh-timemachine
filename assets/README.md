# 图标资源

以时钟回环表示回看，以三个时间节点表示观点沿时间演变。深蓝底色搭配浅色时钟、青色与琥珀色节点。

- `icon-source.png`：内置 ImageGen 生成的原始图像。
- `icon.png`：512 × 512 PNG，用于 README 与 Electron 窗口。
- `icon.ico`：包含 16、24、32、48、64、128、256 像素图层的 Windows 图标。

在 Windows 仓库根目录运行 `powershell -File scripts/build-icons.ps1` 可从源图重新生成 PNG 和 ICO。打包配置直接使用这些资源；发布产物保存在 `release/`。

## 生成提示词

工具：内置 ImageGen（非 CLI）。

```text
Use case: logo-brand. Create one production desktop app icon for ZH-Timemachine, a research tool exploring changing viewpoints over time. Square 1024x1024 canvas, genuinely transparent background outside a large rounded-square deep midnight navy tile with generous safe margins. Center a bold minimal ivory clock/history circular arrow integrated with two cyan timeline nodes, one small warm amber node. Refined flat vector-like geometric design, beautifully balanced optical spacing, subtle blue depth on tile only. Highly recognizable at 32 pixels. No letters, no text, no watermark, no mockup, one icon only.
```
