import { memo } from 'react';

export function createMemoizedComponent(Component) {
  return memo(Component, (prevProps, nextProps) => {
    const prevKeys = Object.keys(prevProps);
    const nextKeys = Object.keys(nextProps);
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of prevKeys) {
      if (typeof prevProps[key] === 'function' && typeof nextProps[key] === 'function') continue;
      if (prevProps[key] !== nextProps[key]) return false;
    }
    return true;
  });
}

export function withMemo(Component, propsAreEqual) {
  return memo(Component, propsAreEqual);
}
