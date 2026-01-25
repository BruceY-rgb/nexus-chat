/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Slack Design System - 核心色彩
        slack: {
          purple: '#3F0E40',      // 侧边栏经典紫色
          dark: '#19171D',        // 深色备用
          blue: '#1164A3',        // 选中态深蓝色
          green: '#2BAC76',       // 活跃状态绿点
          red: '#E01E5A',         // 未读消息红点
        },

        // 语义化状态颜色
        status: {
          success: '#2BAC76',     // 成功/在线状态
          warning: '#F59E0B',     // 警告状态
          error: '#E01E5A',       // 错误/未读标记
          info: '#1164A3',        // 信息/选中状态
        },

        // 文本颜色系统 - Aubergine 深色主题
        text: {
          primary: '#FFFFFF',     // 主文本（白色）
          secondary: '#D1D2D3',  // 次要文本/标题
          muted: '#ABABAD',      // 弱化文本/副标题
          bold: '#FFFFFF',        // 加粗文本
          tertiary: '#6B7280',    // 第三级文本/占位符
          white: '#FFFFFF',       // 白色文本（侧边栏）
          'white-secondary': '#ABABAD',  // 侧边栏次要文本
        },

        // 背景颜色系统 - Aubergine 深色主题
        background: {
          DEFAULT: '#1A1D21',     // 默认背景（Slack 深色）
          component: '#222529',  // 组件背景（深炭灰）
          elevated: '#2D2D30',   // 浮层背景（稍浅灰黑）
        },

        // 边框颜色系统 - Aubergine 深色主题
        border: {
          DEFAULT: '#3E4144',     // 默认边框
          light: '#4A4A4A',      // 浅色边框
          input: '#3E4144',      // 输入框边框
        },

        // 主要交互色（统一使用 Slack 蓝色）
        primary: {
          DEFAULT: '#1164A3',     // Slack 标准蓝色
          foreground: '#FFFFFF', // 前景色
          50: '#E6F2FA',         // 色阶变体
          100: '#CCE5F5',
          200: '#99CBEB',
          300: '#66B0E0',
          400: '#3396D6',
          500: '#1164A3',
          600: '#0D5288',
          700: '#0A416A',
          800: '#06304D',
          900: '#031F2F',
        },

        // 聚焦环颜色
        ring: {
          DEFAULT: '#1164A3',
          primary: '#1164A3',
          focus: '#1164A3',
        },

        // 输入框颜色
        input: {
          DEFAULT: '#ABABAD',
          focus: '#1164A3',
          border: '#ABABAD',
        },

        // 侧边栏专用颜色（使用 CSS 变量）
        sidebar: {
          bg: 'var(--sidebar-bg-primary)',
          selected: 'var(--sidebar-selected)',
          active: 'var(--active-status)',
        },

        // 消息区域颜色（使用 CSS 变量）
        message: {
          bg: 'var(--message-bg)',
          hover: 'var(--message-hover)',
          border: 'var(--message-border)',
        },
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};