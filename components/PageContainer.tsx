import React from 'react';

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageContainer({ children, className = '', ...props }: PageContainerProps) {
  return (
    <div {...props} className={`mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 min-w-0 ${className}`.trim()}>
      {children}
    </div>
  );
}
