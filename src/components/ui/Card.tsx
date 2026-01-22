'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      hoverable = false,
      padding = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = ['rounded-lg', 'transition-all duration-200'];

    const variantStyles = {
      default: 'bg-background-component border border-border',
      elevated: 'bg-background-elevated border border-border shadow-lg',
      outlined: 'bg-transparent border-2 border-border',
    };

    const paddingStyles = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    const hoverStyles = hoverable
      ? 'hover:bg-background-elevated hover:border-border-light cursor-pointer'
      : '';

    return (
      <div
        ref={ref}
        className={[
          ...baseStyles,
          variantStyles[variant],
          paddingStyles[padding],
          hoverStyles,
          className,
        ].join(' ')}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
