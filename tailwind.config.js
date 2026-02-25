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
        // Slack Design System - Core Colors
        slack: {
          purple: '#3F0E40',      // Sidebar classic purple
          dark: '#19171D',        // Dark backup
          blue: '#1164A3',        // Selected state deep blue
          green: '#2BAC76',       // Active status green dot
          red: '#E01E5A',         // Unread message red dot
        },

        // Semantic status colors
        status: {
          success: '#2BAC76',     // Success/Online status
          warning: '#F59E0B',     // Warning status
          error: '#E01E5A',      // Error/Unread marker
          info: '#1164A3',       // Info/Selected state
        },

        // Text color system - Aubergine dark theme
        text: {
          primary: '#FFFFFF',     // Primary text (white)
          secondary: '#D1D2D3',  // Secondary text/Title
          muted: '#ABABAD',      // Muted text/Subtitle
          bold: '#FFFFFF',        // Bold text
          tertiary: '#6B7280',    // Tertiary text/Placeholder
          white: '#FFFFFF',       // White text (sidebar)
          'white-secondary': '#ABABAD',  // Sidebar secondary text
        },

        // Background color system - Aubergine dark theme
        background: {
          DEFAULT: '#1A1D21',     // Default background (Slack dark)
          component: '#222529',  // Component background (dark charcoal)
          elevated: '#2D2D30',   // Elevated background (slightly lighter gray-black)
        },

        // Border color system - Aubergine dark theme
        border: {
          DEFAULT: '#3E4144',     // Default border
          light: '#4A4A4A',      // Light border
          input: '#3E4144',      // Input border
        },

        // Primary interaction color (unified Slack blue)
        primary: {
          DEFAULT: '#1164A3',     // Slack standard blue
          foreground: '#FFFFFF', // Foreground color
          50: '#E6F2FA',         // Color shade variants
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

        // Focus ring color
        ring: {
          DEFAULT: '#1164A3',
          primary: '#1164A3',
          focus: '#1164A3',
        },

        // Input colors
        input: {
          DEFAULT: '#ABABAD',
          focus: '#1164A3',
          border: '#ABABAD',
        },

        // Sidebar-specific colors (using CSS variables)
        sidebar: {
          bg: 'var(--sidebar-bg-primary)',
          selected: 'var(--sidebar-selected)',
          active: 'var(--active-status)',
        },

        // Message area colors (using CSS variables)
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