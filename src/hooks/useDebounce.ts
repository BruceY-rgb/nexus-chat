import { useState, useEffect } from 'react';

/**
 * 防抖 Hook
 * @param value 需要防抖处理的值
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 设置定时器，在延迟后更新值
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function：如果 value 发生变化，会清除上一个定时器
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
