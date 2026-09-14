import type { GalaxyData } from './TimeGalaxy3D'

// 启动落地页的内置星图：来自真实研究「AI 编程会取代程序员吗」262 条知乎回答（2020-2026）。
// 与产品实际产出保持一致，仅用于首屏展示；用户自己的研究完成后会替换为其专属星图。
export const GATE_GALAXY: GalaxyData = {
  "question": "AI 编程会取代程序员吗",
  "totalSamples": 262,
  "colors": {
    "AI编程将提升效率但不会取代程序员": "#7061db",
    "无代码和AutoML趋势降低编程门槛": "#4d9bb2",
    "AI可替代低技能、重复性编程工作": "#d3a055",
    "机器编程将使软件创建民主化": "#b7779d",
    "AI的可解释性和安全性问题限制替代": "#75a184",
    "AI编程是辅助工具而非替代者": "#9295a8",
    "前端智能化推动人机协同编程": "#a684db",
    "AI将取代程序员，行业颠覆不可避免": "#769ed0",
    "程序员核心价值转向问题定义与系统设计": "#7061db"
  },
  "periods": [
    {
      "label": "2020",
      "sampleCount": 21,
      "dominantLabel": "AI编程将提升效率但不会取代程序员",
      "dominantShare": 0.286,
      "summary": "多数观点认为，当前AI编程技术（如GPT-3、代码补全工具）主要作为辅助工具，能"
    },
    {
      "label": "2021",
      "sampleCount": 21,
      "dominantLabel": "AI编程是辅助工具而非替代者",
      "dominantShare": 0.429,
      "summary": "样本强调AI工具如Copilot作为“小秘书”或“结对程序员”，帮助开发者提高效"
    },
    {
      "label": "2022",
      "sampleCount": 30,
      "dominantLabel": "AI编程将提升效率但不会取代程序员",
      "dominantShare": 0.333,
      "summary": "多数观点指出，AI如Copilot、ChatGPT能辅助代码补全和生成，显著提升"
    },
    {
      "label": "2023",
      "sampleCount": 40,
      "dominantLabel": "AI编程将提升效率但不会取代程序员",
      "dominantShare": 0.3,
      "summary": "多数观点认为，AI如GPT、Copilot等能自动化重复性编码任务（如生成样板代"
    },
    {
      "label": "2024",
      "sampleCount": 45,
      "dominantLabel": "AI编程将提升效率但不会取代程序员",
      "dominantShare": 0.311,
      "summary": "多数样本强调AI编程工具（如GitHub Copilot、通义灵码等）主要通过自"
    },
    {
      "label": "2025",
      "sampleCount": 54,
      "dominantLabel": "AI编程将提升效率但不会取代程序员",
      "dominantShare": 0.259,
      "summary": "核心观点认为，AI是强大的增效工具，能自动化重复性任务，但无法替代程序员的创造力"
    },
    {
      "label": "2026",
      "sampleCount": 51,
      "dominantLabel": "程序员核心价值转向问题定义与系统设计",
      "dominantShare": 0.235,
      "summary": "在AI承担基础编码后，程序员的核心竞争力转向更高层次的“定义问题”与“系统设计”"
    }
  ]
}
