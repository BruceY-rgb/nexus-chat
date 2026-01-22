import React from 'react';

export interface BadgeProps {
  count?: number;
  max?: number;
  showZero?: boolean;
  dot?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Badge({
  count = 0,
  max = 99,
  showZero = false,
  dot = false,
  size = 'md',
  className = ''
}: BadgeProps) {
  // 不显示的条件
  if (!showZero && count === 0) {
    return null;
  }

  // 显示小红点模式
  if (dot) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-red-500 ${
          size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-3 h-3' : 'w-2 h-2'
        } ${className}`}
      />
    );
  }

  // 计算显示的数字
  const displayCount = count > max ? `${max}+` : count;

  // 尺寸样式
  const sizeStyles = {
    sm: 'min-w-[16px] h-4 px-1 text-[10px]',
    md: 'min-w-[20px] h-5 px-1.5 text-xs',
    lg: 'min-w-[24px] h-6 px-2 text-sm'
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center
        rounded-full
        bg-red-500
        text-white
        font-medium
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {displayCount}
    </span>
  );
}
