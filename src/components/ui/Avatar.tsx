'use client';

import React from 'react';
import { User } from 'lucide-react';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  fallback?: string;
  online?: boolean;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      size = 'md',
      fallback,
      online,
      className = '',
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      xs: 'w-6 h-6 text-xs',
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-16 h-16 text-xl',
      xl: 'w-24 h-24 text-2xl',
      '2xl': 'w-32 h-32 text-4xl',
    };

    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    const displayText = fallback || alt || 'U';

    return (
      <div
        ref={ref}
        className={[
          'relative inline-flex items-center justify-center',
          'rounded-full overflow-hidden bg-background-elevated',
          'flex-shrink-0',
          sizeStyles[size],
          className,
        ].join(' ')}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-medium text-text-secondary">
            {displayText.length > 2
              ? getInitials(displayText)
              : displayText}
          </span>
        )}
        {online !== undefined && (
          <span
            className={[
              'absolute bottom-0 right-0',
              'w-2.5 h-2.5 rounded-full border-2 border-background-component',
              online ? 'bg-status-success' : 'bg-text-muted',
            ].join(' ')}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export default Avatar;
